const NodeCache = require("node-cache");
const allAnimeService = require("./allAnimeService");
const anipubService = require("./anipubService");
const animoyeService = require("./animoyeService");
const watchanimeworldService = require("./watchanimeworldService");
const anilistService = require("./anilistService");

const cache = new NodeCache({ stdTTL: 600 });

const VALID_SOURCES = ["123anime", "anipub", "watchanimeworld", "animoye"];

const SOURCE_FRIENDLY = { "123anime": "123Anime", anipub: "Anipub", watchanimeworld: "WatchAnimeWorld", animoye: "AniMoye" };

async function toGlobalEpisode(title, season, episode) {
  if (!season || season <= 1) return episode;
  try {
    const searchResult = await anilistService.search(title, 1, 5);
    if (!searchResult?.results?.length) return episode;
    const match = searchResult.results.find((r) => {
      const names = [r.title?.romaji, r.title?.english, r.title?.native].map((n) => (n || "").toLowerCase());
      const q = title.toLowerCase();
      return names.some((n) => n.includes(q) || q.includes(n));
    }) || searchResult.results[0];
    if (!match) return episode;
    const info = await anilistService.getMediaInfo(match.id);
    if (!info?.seasons) return episode;
    let offset = 0;
    for (const s of info.seasons) {
      if (s.seasonNumber >= season) break;
      offset += s.episodeCount || 12;
    }
    return offset + episode;
  } catch {
    return episode;
  }
}

const sourceHandlers = {
  "123anime": async (title, episode, language, season) => {
    const globalEp = await toGlobalEpisode(title, season, episode);
    const slug = await allAnimeService.resolveSlug(title, language);
    if (!slug) return { success: false, reason: "Anime not found on 123Anime" };
    const stream = await allAnimeService.getEpisodeStreamInfo(slug, globalEp);
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
      episode: globalEp,
    };
  },
  anipub: async (title, episode, language, season) => {
    const globalEp = await toGlobalEpisode(title, season, episode);
    const result = await anipubService.getStream(title, globalEp, language);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on Anipub" };
  },
  watchanimeworld: async (title, episode, language, season) => {
    const result = await watchanimeworldService.getStream(title, episode, season);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on WatchAnimeWorld" };
  },
  animoye: async (title, episode, language, season) => {
    const result = await animoyeService.getStream(title, episode, language, season);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on AniMoye" };
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
