require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const config = require("./config");

(async () => {
  await connectDB();

  const server = app.listen(config.port, () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });

  const forceExit = () => {
    console.error("Forcing exit after timeout");
    process.exit(1);
  };

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
    server.close(() => process.exit(1));
    setTimeout(forceExit, 5000);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    server.close(() => process.exit(1));
    setTimeout(forceExit, 5000);
  });
})();
