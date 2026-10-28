const jwt = require("jsonwebtoken");

function getTokenFromHeader(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}

function jwtSecret() {
  return process.env.JWT_SECRET;
}

/**
 * Verifies the Authorization: Bearer <token> header and attaches the
 * authenticated user id to req.user. Responds 401 for missing/invalid tokens.
 */
function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const secret = jwtSecret();
  if (!secret) {
    // Not the client's fault: server misconfiguration
    console.error("JWT_SECRET is not configured on the server.");
    return res.status(500).json({
      success: false,
      message: "Server authentication is not configured. Contact the administrator.",
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or has expired. Please log in again.",
    });
  }

  if (!payload || typeof payload.id !== "string") {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or has expired. Please log in again.",
    });
  }

  req.user = { id: payload.id };
  return next();
}

module.exports = { requireAuth };
