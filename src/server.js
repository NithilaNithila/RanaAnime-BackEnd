require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const config = require("./config");

(async () => {
  await connectDB();

  const server = app.listen(config.port, () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
  });
})();
