const config = require("../config");

const errorHandler = (err, _req, res, _next) => {
  console.error(err.stack);

  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Resource not found" });
  }

  if (err.code === 11000) {
    return res.status(400).json({ success: false, message: "Duplicate field value" });
  }

  if (err.name === "ValidationError") {
    const messages = err.errors ? Object.values(err.errors).map((e) => e.message) : [err.message];
    return res.status(400).json({ success: false, message: messages.join(", ") });
  }

  const statusCode = err.statusCode || 500;
  const message = config.nodeEnv === "production" && statusCode === 500
    ? "Internal Server Error"
    : err.message || "Internal Server Error";

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
