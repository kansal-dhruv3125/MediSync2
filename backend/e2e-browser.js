/**
 * Browser end-to-end test for MediSync2. Requires Chrome installed and a
 * reachable MongoDB at MONGODB_URI. Boots the API and the static frontend,
 * then drives signup -> add medication -> persistence -> logout -> login
 * with headless Chrome (puppeteer-core, installed with --no-save so it is
 * not a project dependency). Run: node e2e-browser.js
 */
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medisync2_e2e";
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-secret";
process.env.PORT = process.env.PORT || "5777";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer-core");

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const FRONTEND_PORT = 8090;
const API_PORT = Number(process.env.PORT);

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

let failures = 0;
function check(name, condition, detail) {
  const status = condition ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${detail !== undefined ? " -> " + detail : ""}`);
  if (!condition) failures++;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(FRONTEND_DIR, decodeURIComponent(req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]));
      if (req.url === "/" || req.url.startsWith("/?")) filePath = path.join(FRONTEND_DIR, "index.html");
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found (dev static server)");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(FRONTEND_PORT, () => resolve(server));
  });
}

function startApi() {
  const child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: process.env,
    stdio: "inherit",
  });
  return child;
}

(async () => {
  const server = await startStaticServer();
  const api = startApi();
  await new Promise((r) => setTimeout(r, 1200));

  const username = "e2e_user_" + Date.now();
  const email = username + "@test.com";
  const password = "secret123";

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
      args: ["--disable-gpu", "--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    // Demonstrates the API URL override mechanism described in README.md
    await page.evaluateOnNewDocument(
      (apiUrl) => {
        localStorage.setItem("medisync_api_url", apiUrl);
      },
      "http://127.0.0.1:" + API_PORT
    );

    // --- Signup ---
    await page.goto(`http://127.0.0.1:${FRONTEND_PORT}/signup.html`, { waitUntil: "networkidle0" });
    await page.type("#signup-username", username);
    await page.type("#signup-email", email);
    await page.type("#signup-password", password);
    await page.type("#signup-confirm", password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
      page.click("#signup-form button[type=submit]"),
    ]);
    check("signup redirects to index.html", page.url().includes("index.html"), page.url());

    const who = await page.waitForFunction(
      () => document.getElementById("current-user-label") && document.getElementById("current-user-label").textContent.includes("Logged in as"),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
    check("header shows logged-in user", who);

    // --- Add medication via the existing form ---
    await page.type("#med-name", "Aspirin");
    await page.type("#med-dose", "500mg");
    await page.select("#med-frequency", "2");
    await page.select("#med-start-time", "08:00").catch(() => {});
    await page.evaluate(() => { document.getElementById("med-start-time").value = "08:00"; });
    await page.select("#med-gap", "4");
    await page.click("#save-btn");
    const added = await page.waitForFunction(
      () => document.getElementById("medication-list").textContent.includes("Aspirin"),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
    check("adding medication renders it in list", added);

    const doseTimes = await page.evaluate(() => {
      const li = document.querySelector("#medication-list .med-details");
      return li ? li.textContent : "";
    });
    check("rendered dose times come from server record (08:00, 20:00)", doseTimes.includes("08:00") && doseTimes.includes("20:00"), doseTimes);

    // --- Persistence: reload and confirm it is loaded back from the API ---
    await page.reload({ waitUntil: "networkidle0" });
    const persisted = await page.waitForFunction(
      () => document.getElementById("medication-list").textContent.includes("Aspirin"),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
    check("medication persists after reload (MongoDB-backed)", persisted);

    // --- Today tab: interaction/schedule engine still renders ---
    await page.click('.tab-btn[data-tab="tab-today"]');
    const schedule = await page.waitForFunction(
      () => document.getElementById("schedule").textContent.includes("Aspirin"),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
    check("today schedule renders from API data", schedule);

    // --- Logout ---
    await page.click("#logout-btn");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 }).catch(() => {});
    check("logout returns to login page", page.url().includes("login.html"), page.url());

    // --- Login again; data must still be there ---
    await page.type("#login-username", username);
    await page.type("#login-password", password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
      page.click("#login-form button[type=submit]"),
    ]);
    check("login redirects to index.html", page.url().includes("index.html"), page.url());
    const stillThere = await page.waitForFunction(
      () => document.getElementById("medication-list").textContent.includes("Aspirin"),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
    check("medications reload from API after re-login", stillThere);

    // --- Wrong password shows a clear inline error ---
    await page.click("#logout-btn");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 }).catch(() => {});
    await page.type("#login-username", username);
    await page.type("#login-password", "wrongpassword");
    await page.click("#login-form button[type=submit]");
    const errorShown = await page.waitForFunction(
      () => document.getElementById("login-error").textContent.includes("Incorrect username or password"),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
    check("wrong password shows clear inline error", errorShown);
  } catch (err) {
    failures++;
    console.error("[FAIL] unexpected error:", err.message);
  } finally {
    if (browser) await browser.close();
    api && api.kill();
    server && server.close();
  }

  console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} E2E CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error("E2E test crashed:", err);
  process.exit(1);
});
