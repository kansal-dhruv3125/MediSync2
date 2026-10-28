/**
 * Fallback masked password prompt for the MediSync2 Atlas connection
 * (works where readline hangs, e.g. some Windows terminal setups).
 *
 * Run from the backend folder:  npm run enter-password:node
 * - Reads stdin in raw mode, char by char: masked with '*', supports Enter,
 *   Backspace and Ctrl+C (cancellation leaves .env untouched).
 * - URL-encodes automatically for the mongodb+srv URI.
 * - Writes ONLY into backend/.env (git-ignored).
 * - The password is never printed, logged or committed.
 */
const fs = require("fs");
const path = require("path");

const ENV_FILE = path.join(__dirname, "..", ".env");
const PLACEHOLDER = "<db_password>";

if (!fs.existsSync(ENV_FILE)) {
  console.error("ERROR: backend/.env not found. Run this from the backend folder.");
  process.exit(1);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("ERROR: this script needs an interactive terminal. Run it in the VS Code terminal:");
  console.error("  cd backend && npm run enter-password:node");
  process.exit(1);
}

const PROMPT = "Atlas DB password (input is hidden): ";
let typed = "";
let finished = false;
let activeSession = true;

function urlEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*~]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")
  );
}

function applyPassword(password) {
  const encoding = urlEncode(password);
  const content = fs.readFileSync(ENV_FILE, "utf8");
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.replace(/\n$/, "").split("\n");
  const idx = lines.findIndex((line) => line.startsWith("MONGODB_URI="));

  if (idx < 0) {
    console.error("\nERROR: no MONGODB_URI line found in backend/.env. Nothing was modified.");
    process.exit(1);
  }

  let action = "";
  const line = lines[idx];

  if (line.indexOf(PLACEHOLDER) !== -1) {
    // Targeted only at the MONGODB_URI line (comments may mention the placeholder too)
    const at = line.indexOf(PLACEHOLDER);
    lines[idx] = line.slice(0, at) + encoding + line.slice(at + PLACEHOLDER.length);
    action = "replaced the <db_password> placeholder in the MONGODB_URI line";
  } else if (/^MONGODB_URI=mongodb\+srv:\/\/kansaldhruv3125_db_user:/.test(line)) {
    const colonAt = line.indexOf(":", line.indexOf("://") + 3);
    const userAt = line.indexOf("@");
    if (colonAt >= 0 && userAt > colonAt) {
      lines[idx] = line.slice(0, colonAt + 1) + encoding + line.slice(userAt);
      action = "updated the password stored in MONGODB_URI";
    }
  }

  if (action === "") {
    console.error("\nERROR: could not locate the password slot in backend/.env. Nothing was modified.");
    process.exit(1);
  }

  const output = lines.join("\n") + (hadFinalNewline ? "\n" : "");
  fs.writeFileSync(ENV_FILE, output, { mode: 0o600 });
  console.log("\nDone: backend/.env updated (git-ignored). " + action + ". Value never displayed.");
  process.exit(0);
}

function quit(code) {
  if (!activeSession) return;
  activeSession = false;
  try { process.stdin.setRawMode && process.stdin.setRawMode(false); } catch (e) {}
  process.stdin.pause();
  process.exit(code);
}

process.stdout.write(PROMPT);

try {
  process.stdin.setRawMode(true);
} catch (rawError) {
  console.error("\nERROR: could not enable hidden input in this terminal. Use the PowerShell script instead: npm run enter-password");
  process.exit(1);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  if (finished) return;
  for (const ch of chunk) {
    if (ch === "\r" || ch === "\n") {
      finished = true;
      process.stdout.write("\n");
      const password = typed;
      typed = "";
      if (!password) {
        console.error("ERROR: no password entered. backend/.env was NOT modified.");
        quit(1);
        return;
      }
      applyPassword(password);
      return;
    }
    if (ch === "\x03") {
      // Ctrl+C: cancel without touching .env
      console.log("\nCancelled. backend/.env was NOT modified.");
      quit(1);
      return;
    }
    if (ch === "\x7f" || ch === "\x08") {
      typed = typed.slice(0, -1);
      process.stdout.write("\b \b");
      continue;
    }
    if (ch === "\x1b") { continue; } // escape sequences ignored (arrows etc.)
    if (ch < " ") { continue; }     // other control characters ignored
    typed += ch;
    process.stdout.write("*");
  }
});

process.stdin.on("end", () => {
  if (!finished && activeSession) {
    console.log("\nCancelled. backend/.env was NOT modified.");
    quit(1);
  }
});

process.on("SIGINT", () => {
  console.log("\nCancelled. backend/.env was NOT modified.");
  quit(1);
});
