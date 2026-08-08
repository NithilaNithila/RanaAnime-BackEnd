const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const config = require("./config");
const errorHandler = require("./middleware/errorHandler");
const rateLimiter = require("./middleware/rateLimiter");

const anilistRoutes = require("./routes/anilist");
const streamRoutes = require("./routes/stream");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const animeRoutes = require("./routes/anime");
const newsRoutes = require("./routes/news");
const streamingMetadataRoutes = require("./routes/streamingMetadata");
const metadataRoutes = require("./routes/metadata");
const imageProxyRoutes = require("./routes/imageProxy");

const app = express();

app.set("trust proxy", 1);

const corsOptions = {};
if (Array.isArray(config.corsOrigin)) {
  corsOptions.origin = (origin, callback) => {
    if (config.nodeEnv === "production" && !origin) {
      return callback(new Error("No origin"));
    }
    if (!origin || config.corsOrigin.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  };
} else {
  corsOptions.origin = config.corsOrigin;
}

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
    frameguard: false,
  })
);
app.use(cors({ ...corsOptions, credentials: true }));
app.use(express.json());
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
app.use(rateLimiter);

app.use("/api/anilist", anilistRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/anime", animeRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/metadata", streamingMetadataRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/image", imageProxyRoutes);

app.all("/cdn-cgi/*", (_req, res) => {
  res.status(204).end();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

module.exports = app;
