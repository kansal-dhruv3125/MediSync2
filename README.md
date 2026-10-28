# 💊 MediSync2 — Medication Dosage & Interaction Scheduler

MediSync2 is a full-stack medication management application. Users can organize their daily medicines, manage dosage schedules, and identify potentially unsafe medication combinations based on predefined interaction rules. The frontend is built with HTML, CSS and Vanilla JavaScript; the backend is an Express + MongoDB (Atlas) REST API with JWT authentication.

> ⚠️ **Disclaimer:** MediSync2 is an educational project and is not a replacement for professional medical advice. The interaction warnings come from a basic, hardcoded rules file (`rules.json`) — they are **not clinically validated**. Always consult a qualified healthcare professional about your medication schedule.

---

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Architecture & Folder Structure](#-architecture--folder-structure)
- [Local Setup](#-local-setup)
- [Environment Variables](#-environment-variables)
- [MongoDB Atlas Configuration](#-mongodb-atlas-configuration)
- [Backend Startup Commands](#-backend-startup-commands)
- [API Endpoint Documentation](#-api-endpoint-documentation)
- [Postman Testing](#-postman-testing)
- [Render Deployment (Backend)](#-render-deployment-backend)
- [Frontend Integration](#-frontend-integration)
- [Authentication & Security Notes](#-authentication--security-notes)
- [Run Tests](#-run-tests)
- [Limitations](#-limitations)

---

## ✨ Features

- Sign up with username + email + password (passwords hashed with bcrypt)
- Log in with username **or** email, receive a JWT session
- Per-user medication management (add / edit / delete) persisted in MongoDB
- Today's schedule and a full 24-hour schedule generator
- Drug interaction warnings from `rules.json` (hardcoded educational rules — not clinically validated) plus user-defined minimum spacing between medicines
- "Mark as Taken / Pending" toggles for today's doses (kept as browser UI state)
- Protected REST API: users can only read/modify their own records

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express 5, MVC architecture |
| Database | MongoDB Atlas via Mongoose |
| Auth | JWT (`jsonwebtoken`), bcrypt.js password hashing |
| Config | dotenv, CORS (origin allow-list via environment) |
| Testing | `npm run smoke-test` (API) + headless-Chrome e2e (`e2e-browser.js`), Postman collection |
| Deployment | Render (backend), MongoDB Atlas (data), static host (frontend) |

## 🏗 Architecture & Folder Structure

```text
MediSync2/
├── index.html / login.html / signup.html   ← frontend views (existing UI)
├── style.css / rules.json                  ← existing styles + interaction rules
├── auth.js  login.js  signup.js  script.js ← views' behavior, now API-backed
├── js/api.js                               ← centralized API base URL + fetch helper
├── postman/MediSync2.postman_collection.json
├── backend/                                ← MVC backend (same Git repository)
│   ├── server.js            Express app: middleware, CORS, health, route mounting
│   ├── config/db.js         Mongoose connection
│   ├── models/              User.js, Medication.js (Mongoose schemas)
│   ├── controllers/         authController.js, medicationController.js (logic)
│   ├── routes/              authRoutes.js, medicationRoutes.js, index.js
│   ├── middleware/          authMiddleware.js (JWT), errorMiddleware.js (centralized errors)
│   ├── server.js            startup + GET / and GET /api/health
│   ├── smoke-test.js        API smoke test
│   ├── e2e-browser.js       headless-Chrome end-to-end test
│   ├── .env.example         placeholders only (never commit the real .env)
│   └── package.json
```

Flow: **Views (HTML/JS) → js/api.js fetch → Express routes → controllers → Mongoose models → Atlas**. Controllers never talk to `res` from the models; errors bubble to the centralized error middleware.

## 🚀 Local Setup

1. Clone the repository (frontend + backend live in the same repo).
2. Node.js 18+ required. The backend packages (`express`, `mongoose`, `dotenv`, `cors`, `bcryptjs`, `jsonwebtoken`, `nodemon`) are already declared in `backend/package.json`:

   ```bash
   cd backend
   npm install
   ```

3. Configure environment (see next section).
4. Start the backend (defaults to port 5000).
5. Serve the frontend locally, e.g.:

   ```bash
   node backend/dev-static-server.js 8080
   # open http://localhost:8080
   ```

## 🔑 Environment Variables

Create `backend/.env` (copy from `backend/.env.example`) — **never commit the real .env**:

```ini
PORT=5000
NODE_ENV=development

# MongoDB Atlas connection string (Atlas UI -> Connect -> Drivers)
# Use your existing cluster host and the database name medisync
MONGODB_URI=mongodb+srv://USER:PASSWORD@<your-cluster-host>.mongodb.net/medisync

# Long random string, e.g.:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=your_generated_secret

# Allowed frontend origins for CORS (comma-separated). In production the API
# rejects browser origins that are not listed here.
CLIENT_URL=http://localhost:8080
```

The API **will not start** if `MONGODB_URI` or `JWT_SECRET` is missing — the failure message explains exactly what is missing.

## 🍃 MongoDB Atlas Configuration

1. Create a free cluster at <https://cloud.mongodb.com> (M0 free tier is fine).
2. Database Access → add a database user (username + password).
3. Network Access → allow your IP locally; for Render use `0.0.0.0/0` (or Render's documented egress IPs) since serverless hosts have dynamic IPs.
4. Get the SRV connection string (Connect → Drivers) and paste it into `MONGODB_URI`. URL-encode the password if it contains special characters.
5. Use the database name `medisync` in the connection string (your application database, separate from the cluster's other data) — Mongoose creates collections automatically from the schemas.

## ▶️ Backend Startup Commands

```bash
cd backend
npm run dev     # development with nodemon (auto-restart)
npm start       # production start command (used by Render)
npm run smoke-test
```

Web-check endpoints:

- `GET /` → app info
- `GET /api/health` → `{ data: { status: "ok", server: "ok", database: "connected" | "disconnected", databaseConnected: true/false } }`

## 🌐 API Endpoint Documentation

All responses use the shape `{ "success": boolean, "message": string, "data": object }`.

### Auth

| Method | Path | Auth | Description | Success | Main errors |
|---|---|---|---|---|---|
| POST | `/api/auth/signup` | – | Create account (username, email, password) | 201 → `data.user`, `data.token` | 400 invalid input, 409 username/email taken |
| POST | `/api/auth/login` | – | Login with `identifier` (username or email) + `password` | 200 → `data.user`, `data.token` | 400 missing fields, 401 wrong credentials |
| GET | `/api/auth/me` | Bearer JWT | Current authenticated user | 200 → `data.user` | 401 missing/invalid token |

Passwords are hashed with bcryptjs (10 rounds) and never returned. Emails/username are normalized to lowercase.

### Medications (all protected by Bearer JWT, scoped to the token's user id)

| Method | Path | Description | Success | Main errors |
|---|---|---|---|---|
| GET | `/api/medications` | List my medications | 200 → `data.medications[]` | 401 |
| POST | `/api/medications` | Create (name, dose, frequency 1-4, startTime HH:MM, customGapHours 0-12 optional, notes optional) | 201 → `data.medication` | 400 validation |
| GET | `/api/medications/:id` | Get one of my medications | 200 → `data.medication` | 400 invalid id, 404 unknown/foreign |
| PUT | `/api/medications/:id` | Update (whitelisted fields; `doseTimes` recomputed server-side) | 200 | 400 / 404 |
| DELETE | `/api/medications/:id` | Delete | 200 | 404 |

`userId` is always set server-side from the JWT — request bodies cannot assign it (mass-assignment protection). Records of other users are indistinguishable from missing ones (`404`).

### Double-check list

- `GET /` , `GET /api/health` (no auth, always available)

## 🧪 Postman Testing

1. Import `postman/MediSync2.postman_collection.json`.
2. Set the **baseUrl** variable (`http://localhost:5000` locally, your Render URL in production).
3. Run **Signup** then **Login** — the JWT is captured automatically into the **accessToken** variable.
4. Run the MISCELLANEOUS MEDICATIONS folder: **Create Medication** captures `medId` for the other requests.
5. The MISCELLANEOUS FAILURES folder exercises: unauthorized requests (401), invalid tokens (401), invalid input (400), duplicate signup (409), invalid login (401), invalid/unknown IDs (400/404).

Expected status codes and sample bodies are documented on each request in the collection.

- `GET /api/health` → `{ data: { status: "ok", server: "ok", environment: "development", database: "connected" | "disconnected", databaseConnected: true/false, uptimeSeconds: number } }`

Render's health-check path should be set to `/api/health`.

## 🚢 Render Deployment (Backend)

### Step 1 — Push the repository to GitHub

Frontend and backend live in the same repo; push normally (`git add` … `git commit` … `git push`). The `.gitignore` files already exclude `backend/.env`, `node_modules/` and local test artifacts, so nothing secret is committed. **Before pushing, scan the diff once** to confirm no credential slipped into a tracked file.

### Step 2 — Create the Render Web Service

1. Go to <https://dashboard.render.com> → **New** → **Web Service**.
2. Connect the `kansal-dhruv3125/MediSync2` GitHub repository.
3. Fill the settings exactly like this:

   | Setting | Value |
   |---|---|
   | **Root Directory** | `backend` |
   | **Environment** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Health Check Path** | `/api/health` |
   | **Instance Type** | Free works; it spins down and cold-starts after ~15 minutes idle |

### Step 3 — Add the environment variables in the Render dashboard

(This is under your service → **Environment**. Render values override nothing else — do **not** commit these.)

| Variable | Value | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@<your-cluster-host>.mongodb.net/medisync` | Your real Atlas SRV string, database path **`/medisync`**. URL-encode special characters in the password first (`@`→`%40`, `:`→`%3A`); safest is a password with none. |
| `JWT_SECRET` | a long random string | Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` — use a **different** secret from your local one if you want to invalidate all previously issued local tokens (recommended). |
| `CLIENT_URL` | your frontend's deployed URL | e.g. `https://medisync2-frontend.onrender.com`. Comma-separated for multiple origins. In production the API rejects any browser origin not listed here. |
| `NODE_ENV` | `production` | Needed so the CORS allow-list is enforced (dev defaults let arbitrary origins through). |
| `PORT` | *(leave unset)* | Render injects it automatically; `server.js` already binds `process.env.PORT`. |

### Step 4 — Allow Render's IPs in MongoDB Atlas

1. Atlas → **Network Access** → **Add IP Address** → allow `0.0.0.0/0` when testing (Render's free tier egress IPs are dynamic; Atlas lists them only for paid plans).
2. Remember to later tighten this (Render paid plans have fixed egress IPs) once you're on a paid instance.

> Free-tier note: with `0.0.0.0/0` in Atlas, anyone with the connection string can attempt to connect — your real password is still required, but treat it as confidential and don't share it in screenshots.

### Step 5 — Deploy and verify

1. Click **Deploy** (first build takes a minute or two).
2. Open `https://<your-service>.onrender.com/api/health`.
3. Expected JSON:

   ```json
   { "success": true, "message": "API is running and connected to the database.", "data": { "status": "ok", "server": "ok", "environment": "production", "database": "connected", "databaseConnected": true, "uptimeSeconds": 1 } }
   ```

4. Then point the Postman collection's `baseUrl` at the Render URL and run the full collection against production once (tasks: signup → login → CRUD on sample data → cleanup is manual there — delete the sample medication and use a `render_test_...` throwaway account to keep the DB clean).

> The server binds to `process.env.PORT` automatically. The health endpoint distinguishes server health from database connectivity, so a broken Atlas string is visible immediately instead of the API silently pretending to be ready.

### Quick reminders for Render (specific traps)

- Root Directory **must** be `backend` — with the repo root as Root the build finds no `package.json` and fails.
- In production, on a fresh deploy, requests with a browser `Origin` header not present in `CLIENT_URL` will be rejected by CORS — check that first before suspecting the JWT layer.
- Free instances go cold; keep the launch waiting time in mind when you see a 502/timeout right after opening the service URL.

**Frontend hosting:** if you already host the static frontend (e.g. GitHub Pages), just point it at the deployed API (next section). Otherwise deploy the repo root as a Render **Static Site** (or Netlify) — any static host works.

## 🔗 Frontend Integration

`js/api.js` resolves the API base URL in this order:

1. `window.MEDISYNC_API_URL` — set an inline override before `js/api.js` loads:

   ```html
   <script>window.MEDISYNC_API_URL = "https://medisync2-api.onrender.com";</script>
   <script src="js/api.js"></script>
   ```

2. `localStorage.setItem("medisync_api_url", "https://medisync2-api.onrender.com")` — quick override you can run once in the browser console (used by the e2e test).
3. Default: `http://localhost:5000` (local development).

After deployment, choose option 1 (edit one line) or bake it into your hosting config. The deployed URL is **not** set anywhere yet — supply it and drop it into that one line. No secrets are ever placed in frontend code.

## 🔒 Authentication & Security Notes

- Session tokens (JWT, 7-day expiry) and the user object are stored in `localStorage`. Anything readable by JavaScript in the browser is exposed to **XSS**: if JavaScript is injected into the page, it could read the token, and the token would be re-created for an attacker. Avoid the clear-text storage if the app keeps growing. (HTTP-Only cookies with CSRF protection would be stronger, but require the API and frontend to share a parent domain or a proxy.)
- Protections present: bcrypt password hashing, generic login failures, JWT-protected routes, per-user authorization checks on every medication operation, whitelisted request fields, centralized error handling that hides stack traces in production, JSON body parsing plus malformed-JSON and oversized-body errors, CORS restricted via `CLIENT_URL` in production.
- The backend never logs or returns secrets; no secret is committed (see `.gitignore`).

## ✅ Run Tests

```bash
cd backend
npm run smoke-test     # needs MongoDB (local mongod or Atlas) reachable at MONGODB_URI
node e2e-browser.js    # needs Chrome installed + local MongoDB
```

`smoke-test.js` covers: health, signup/login/validation, JWT protection, medication CRUD, cross-user isolation, invalid IDs, malformed JSON. `e2e-browser.js` drives the real UI with headless Chrome.

## ⚠️ Limitations

- Interaction checks are hardcoded educational rules (`rules.json`) — **not clinically validated**.
- Batching: "Mark as Taken" state is per-browser, per-day, currently not synced to the backend.
- The JWT cannot be revoked server-side before its expiry.
- No automated CI pipeline yet; run the two included test scripts manually.
