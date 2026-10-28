function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function sendError(res, status, message, extra) {
  const body = { success: false, message, ...(extra || {}) };
  res.status(status).json(body);
}

/**
 * Centralized error handler. Keeps production responses free of stack traces.
 */
// eslint-disable-next-line no-unused-vars -- Express requires 4-arg signature
function errorHandler(err, req, res, _next) {
  // Malformed JSON body (Express body-parser)
  if (err.type === "entity.parse.failed") {
    return sendError(res, 400, "Invalid JSON in request body.");
  }

  // Invalid MongoDB ObjectId (e.g. from :id params)
  if (err.name === "CastError") {
    return sendError(res, 400, `Invalid value for '${err.path}'.`);
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors || {}).map((e) => e.message);
    return sendError(res, 400, "Validation failed.", { errors: details });
  }

  // Duplicate key on unique indexes (username / email)
  if (err.code === 11000) {
    const field = (err.keyValue && Object.keys(err.keyValue)[0]) || "value";
    return sendError(res, 409, `This ${field} is already registered.`);
  }

  // Body larger than the configured limit
  if (err.type === "entity.too.large") {
    return sendError(res, 413, "Request body is too large.");
  }

  const isProd = process.env.NODE_ENV === "production";
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error("[error]", err);
  }

  return sendError(
    res,
    status,
    (status < 500 && err.message) || (isProd ? "Internal server error." : err.message),
    isProd ? undefined : { stack: err.stack }
  );
}

module.exports = { notFoundHandler, errorHandler };
