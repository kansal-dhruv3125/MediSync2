/**
 * End-to-end API smoke test. Requires a reachable MongoDB at MONGODB_URI
 * (e.g. a local mongod or an in-memory server). Run: npm run smoke-test
 * Verifies health, auth flows, and user-scoped medication CRUD.
 */
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medisync2_smoke_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || require("crypto").randomBytes(32).toString("hex");
process.env.PORT = process.env.PORT || "5777";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.CLIENT_URL = "";

const BASE = `http://127.0.0.1:${process.env.PORT}`;

let failures = 0;
function check(name, condition, detail) {
  const status = condition ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${detail !== undefined ? " -> " + detail : ""}`);
  if (!condition) failures++;
}

async function api(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* leave null */ }
  return { status: res.status, json, text };
}

function med(token) {
  return api("POST", "/api/medications", {
    token,
    body: { name: "Aspirin", dose: "500mg", frequency: 2, startTime: "08:00", customGapHours: 4 },
  });
}

(async () => {
  require("./server.js"); // listens on process.env.PORT
  await new Promise((r) => setTimeout(r, 800)); // allow DB connection + listen

  // --- Health & root ---
  const health = await api("GET", "/api/health");
  check("GET /api/health returns 200", health.status === 200, health.status);
  check("health reports database connected", health.json?.data?.databaseConnected === true, health.json?.data?.database);

  const root = await api("GET", "/");
  check("GET / returns 200", root.status === 200, root.status);

  // --- Auth ---
  // Unique suffix per run so the test is repeatable against a persistent DB
  const run = Date.now();
  const userA = { username: `alice_${run}`, email: `alice_${run}@test.com`, password: "secret123" };
  const signupA = await api("POST", "/api/auth/signup", { body: userA });
  check("signup returns 201", signupA.status === 201, signupA.status);
  check("signup returns token", typeof signupA.json?.data?.token === "string");
  check("signup does not return password hash", JSON.stringify(signupA.json).toLowerCase().includes("passwordhash") === false);
  check("signup normalizes email to lowercase", signupA.json?.data?.user?.email === userA.email, signupA.json?.data?.user?.email);

  const dupEmail = await api("POST", "/api/auth/signup", {
    body: { username: "other_user", email: "alice@test.com", password: "secret123" },
  });
  check("duplicate email signup rejected 409", dupEmail.status === 409, dupEmail.status);

  const shortPw = await api("POST", "/api/auth/signup", {
    body: { username: "pw_user", email: "pw@example.com", password: "123" },
  });
  check("invalid signup rejected 400", shortPw.status === 400, shortPw.status);

  const badLogin = await api("POST", "/api/auth/login", {
    body: { identifier: userA.username, password: "wrongpass" },
  });
  check("invalid login rejected 401", badLogin.status === 401, badLogin.status);

  const loginA = await api("POST", "/api/auth/login", {
    body: { identifier: userA.username, password: "secret123" },
  });
  check("login with username returns 200 + JWT", loginA.status === 200 && !!loginA.json?.data?.token, loginA.status);

  const loginEmail = await api("POST", "/api/auth/login", {
    body: { identifier: userA.email, password: "secret123" },
  });
  check("login with email works", loginEmail.status === 200, loginEmail.status);

  const tokenA = loginA.json.data.token;

  const meNoToken = await api("GET", "/api/auth/me");
  check("GET /me without token rejected 401", meNoToken.status === 401, meNoToken.status);

  const meBadToken = await api("GET", "/api/auth/me", { token: "not.a.jwt" });
  check("GET /me with invalid token rejected 401", meBadToken.status === 401, meBadToken.status);

  const me = await api("GET", "/api/auth/me", { token: tokenA });
  check("GET /me returns 200", me.status === 200, me.status);
  check("GET /me returns correct user", me.json?.data?.user?.username === userA.username, me.json?.data?.user?.username);

  // --- Medication CRUD (user A) ---
  const medsNoAuth = await api("GET", "/api/medications");
  check("medications list without token rejected 401", medsNoAuth.status === 401, medsNoAuth.status);

  const created = await med(tokenA);
  check("create medication returns 201", created.status === 201, created.status);
  check("server computes doseTimes", JSON.stringify(created.json?.data?.medication?.doseTimes) === JSON.stringify(["08:00", "20:00"]),
    JSON.stringify(created.json?.data?.medication?.doseTimes));
  const medId = created.json?.data?.medication?.id;

  const listA = await api("GET", "/api/medications", { token: tokenA });
  check("list medications returns 1 for user A", listA.status === 200 && listA.json?.data?.medications?.length === 1,
    listA.json?.data?.medications?.length);

  const got = await api("GET", `/api/medications/${medId}`, { token: tokenA });
  check("get medication by id returns 200", got.status === 200, got.status);

  const updated = await api("PUT", `/api/medications/${medId}`, {
    token: tokenA,
    body: { name: "Aspirin", dose: "100mg", frequency: 3, startTime: "09:30", customGapHours: 2, userId: "hacked", notes: "" },
  });
  check("update medication returns 200", updated.status === 200, updated.status);
  check("update ignores mass-assigned userId", updated.json?.data?.medication?.dose === "100mg", updated.status);
  check("update recomputes doseTimes", JSON.stringify(updated.json?.data?.medication?.doseTimes) === JSON.stringify(["09:30", "17:30", "01:30"]),
    JSON.stringify(updated.json?.data?.medication?.doseTimes));

  const invalidId = await api("GET", "/api/medications/not-valid-id", { token: tokenA });
  check("invalid ObjectId rejected 400", invalidId.status === 400, invalidId.status);

  const deleted = await api("DELETE", `/api/medications/${medId}`, { token: tokenA });
  check("delete medication returns 200", deleted.status === 200, deleted.status);
  const gone = await api("GET", `/api/medications/${medId}`, { token: tokenA });
  check("deleted medication returns 404", gone.status === 404, gone.status);
  check("list is empty after delete", (await api("GET", "/api/medications", { token: tokenA })).json?.data?.medications?.length === 0);

  // --- Ownership isolation (user B must not access user A's records) ---
  const signupB = await api("POST", "/api/auth/signup", {
    body: { username: `bob_${run}`, email: `bob_${run}@test.com`, password: "secret456" },
  });
  const tokenB = signupB.json.data.token;
  const again = await med(tokenA);
  const medIdA = again.json.data.medication.id;

  const crossGet = await api("GET", `/api/medications/${medIdA}`, { token: tokenB });
  check("user B cannot read user A's medication (404)", crossGet.status === 404, crossGet.status);
  const crossPut = await api("PUT", `/api/medications/${medIdA}`, { token: tokenB, body: { dose: "999mg" } });
  check("user B cannot update user A's medication (404)", crossPut.status === 404, crossPut.status);
  const crossDel = await api("DELETE", `/api/medications/${medIdA}`, { token: tokenB });
  check("user B cannot delete user A's medication (404)", crossDel.status === 404, crossDel.status);

  // --- Bad input & bad payloads ---
  const badBody = await api("POST", "/api/medications", { token: tokenA, body: { name: "X", dose: "1mg", frequency: 9, startTime: "25:99" } });
  check("invalid medication input rejected 400", badBody.status === 400, badBody.status);

  const res404 = await api("GET", "/api/does-not-exist");
  check("unknown route returns 404 JSON", res404.status === 404 && res404.json?.success === false, res404.status);

  const malformed = await fetch(BASE + "/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid json",
  });
  check("malformed JSON returns 400", malformed.status === 400, malformed.status);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
