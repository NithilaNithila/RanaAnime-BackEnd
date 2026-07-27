const corsOriginValue = process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173";
const corsOrigins = corsOriginValue.split(",").map((uri) => uri.trim()).filter(Boolean);

const nodeEnv = process.env.NODE_ENV || "development";

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/anime-streaming",
  jwtSecret: process.env.JWT_SECRET || "fallback-dev-secret-change-in-production",
  jwtExpire: process.env.JWT_EXPIRE || "7d",
  corsOrigin: nodeEnv === "development" ? "*" : (corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins),
  nodeEnv,

  anilistApiUrl: process.env.ANILIST_API_URL || "https://graphql.anilist.co",
  anipubApiUrl: process.env.ANIPUB_API_URL || "https://anipub.xyz",
  allanimeBaseUrl: process.env.ALLANIME_BASE_URL || "https://123anime.la",

  watchanimeworldBaseUrl: process.env.WATCHANIMEWORLD_BASE_URL || "https://watchanimeworld.org",
  miruroApiUrl: process.env.MIRURO_API_URL || "",
};
