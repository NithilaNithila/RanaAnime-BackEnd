const NodeCache = require("node-cache");
const allAnimeService = require("./allAnimeService");
const anipubService = require("./anipubService");
const watchanimeworldService = require("./watchanimeworldService");

const cache = new NodeCache({ stdTTL: 600 });

const VALID_SOURCES = ["123anime", "anipub", "watchanimeworld"];

const SOURCE_FRIENDLY = { "123anime": "123Anime", anipub: "Anipub", watchanimeworld: "WatchAnimeWorld" };

const sourceHandlers = {
  "123anime": async (title, episode, language) => {
    const slug = await allAnimeService.resolveSlug(title, language);
    if (!slug) return { success: false, reason: "Anime not found on 123Anime" };
    const stream = await allAnimeService.getEpisodeStreamInfo(slug, episode);
    if (!stream?.success || !stream.data?.embedUrl) return { success: false, reason: "Episode not available on 123Anime" };
    return {
      success: true,
      source: "123anime",
      language,
      embedUrl: stream.data.embedUrl,
      directM3u8: stream.data.directM3u8 || null,
      cdnHeaders: stream.data.cdnHeaders || null,
      intro: stream.data.intro || null,
      outro: stream.data.outro || null,
      tracks: stream.data.tracks || [],
      slug,
      episode,
    };
  },
  anipub: async (title, episode, language) => {
    const result = await anipubService.getStream(title, episode, language);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on Anipub" };
  },
  watchanimeworld: async (title, episode, language, season) => {
    const result = await watchanimeworldService.getStream(title, episode, season);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on WatchAnimeWorld" };
  },
};

const getStream = async (title, episode, language = "sub", source = "123anime", season) => {
  const normalizedSource = source.toLowerCase();

  if (!VALID_SOURCES.includes(normalizedSource)) {
    return {
      success: false,
      message: `Invalid source "${source}". Valid sources: ${VALID_SOURCES.join(", ")}`,
    };
  }

  const cacheKey = `stream_${title}_${episode}_${language}_${normalizedSource}_${season || "any"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  console.log(`[streaming] getStream: title="${title}" ep=${episode} season=${season || "N/A"} source=${normalizedSource} lang=${language}`);

  try {
    const result = await sourceHandlers[normalizedSource](title, episode, language, season);
    if (result?.success) {
      cache.set(cacheKey, result, 600);
      return result;
    }
    const friendlyName = SOURCE_FRIENDLY[normalizedSource] || normalizedSource;
    const failed = {
      success: false,
      message: `${friendlyName} is not available for this episode. Try another server.`,
      sourceErrors: [{ source: normalizedSource, name: friendlyName, success: false, reason: result?.reason || "No stream available" }],
    };
    cache.set(cacheKey, failed, 120);
    return failed;
  } catch (err) {
    const friendlyName = SOURCE_FRIENDLY[normalizedSource] || normalizedSource;
    const failed = {
      success: false,
      message: `${friendlyName} is not available for this episode. Try another server.`,
      sourceErrors: [{ source: normalizedSource, name: friendlyName, success: false, reason: err.message }],
    };
    cache.set(cacheKey, failed, 120);
    return failed;
  }
};

module.exports = { getStream };
