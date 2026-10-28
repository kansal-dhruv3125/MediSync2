require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const CLIENT_URL = process.env.CLIENT_URL || "";

const app = express();

// --- Core middleware ---
app.use(express.json({ limit: "50kb" }));


// Production: only browser origins listed in CLIENT_URL (comma-separated) are
// allowed. Non-browser clients (Postman) send no Origin header and are allowed
// so APIs stay testable. Development defaults to the local frontend.
function buildAllowedOrigins() {
  return CLIENT_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const corsOptions = {
  origin(origin, callback) {
    // No Origin header => not a browser request (Postman, curl) => allow
    if (!origin) return callback(null, true);

    if (NODE_ENV !== "production" && buildAllowedOrigins().length === 0) {
      // Development without CLIENT_URL configured: allow any local origin
      return callback(null, true);
    }

    if (buildAllowedOrigins().includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(
        `Origin not allowed by CORS. Add it to CLIENT_URL (NODE_ENV=${NODE_ENV}).`
      )
    );
  },
};
app.use(cors(corsOptions));

// --- Health and app info ---
const READY_STATES = {
  0: { database: "disconnected", connected: false },
  1: { database: "connected", connected: true },
  2: { database: "connecting", connected: false },
  3: { database: "disconnecting", connected: false },
  99: { database: "uninitialized", connected: false },
};

function databaseStatus() {
  const state = READY_STATES[mongoose.connection.readyState];
  return state || READY_STATES[99];
}

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the MediSync2 API.",
    data: {
      name: "MediSync2 API",
      environment: NODE_ENV,
      endpoints: ["/api/health", "/api/auth", "/api/medications"],
    },
  });
});

app.get("/api/health", (_req, res) => {
  const db = databaseStatus();
  // The API is healthy when running; database connectivity is reported
  // separately so callers are never told the API is "database-ready" when
  // MongoDB is disconnected.
  res.status(200).json({
    success: true,
    message: db.connected ? "API is running and connected to the database." : "API is running, but MongoDB is not connected.",
    data: {
      status: "ok",
      server: "ok",
      environment: NODE_ENV,
      database: db.database,
      databaseConnected: db.connected,
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
});

// --- API routes ---
app.use("/api", routes);

// --- 404 + centralized error handling (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`MediSync2 API listening on port ${PORT} (${NODE_ENV})`);
    });
  } catch (err) {
    console.error("Failed to start the server:", err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
