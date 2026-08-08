const axios = require("axios");
const NodeCache = require("node-cache");
const config = require("../config");

const cache = new NodeCache({ stdTTL: 600 });

const BASE = config.miruroApiUrl;

const client = BASE ? axios.create({
  baseURL: BASE,
  timeout: 12000,
}) : null;

const isConfigured = () => !!BASE && !!client;

const retryGet = async (url, reqConfig = {}, retries = 1, delay = 500) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.get(url, reqConfig);
    } catch (err) {
      if (err.response?.status === 503 || err.response?.status === 403) throw err;
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

const search = async (query) => {
  if (!isConfigured()) return [];
  const cacheKey = `miruro_search_${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await retryGet(`/search`, { params: { query } });
    const raw = data?.results;
    const items = raw?.results || (Array.isArray(raw) ? raw : []);
    const results = items.map((a) => ({
      anilistId: a.id,
      title: a.title?.english || a.title?.romaji || a.title?.native || "",
      image: a.coverImage?.large || a.cover || a.image || "",
      format: a.format || "",
      status: a.status || "",
      totalEpisodes: a.episodes || a.totalEpisodes || 0,
      score: a.averageScore || a.score || 0,
    }));
    cache.set(cacheKey, results, 300);
    return results;
  } catch (err) {
    console.error(`[MiruroAPI] search failed for "${query}":`, err.message);
    return [];
  }
};

const getEpisodes = async (anilistId) => {
  if (!isConfigured()) return {};
  const cacheKey = `miruro_eps_${anilistId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await retryGet(`/episodes/${anilistId}`, {}, 1, 1000);
    const raw = data?.results || data;
    if (raw?.providers) {
      cache.set(cacheKey, raw.providers, 600);
      return raw.providers;
    }
    if (raw?.episodes) {
      const providers = { kiwi: { episodes: { sub: raw.episodes } } };
      cache.set(cacheKey, providers, 600);
      return providers;
    }
    cache.set(cacheKey, {}, 300);
    return {};
  } catch (err) {
    console.error(`[MiruroAPI] getEpisodes failed for id=${anilistId}:`, err.message);
    return {};
  }
};

const getStream = async (anilistId, episodeNumber, language = "sub") => {
  if (!isConfigured()) return { success: false, reason: "MiruroAPI not configured (MIRURO_API_URL is empty)" };
  const cacheKey = `miruro_stream_${anilistId}_${episodeNumber}_${language}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const providers = await getEpisodes(anilistId);
  const category = language === "dub" ? "dub" : "sub";

  const providerOrder = ["kiwi", "arc", "zoro", "jet", "pewe", "bee", "bonk", "bun", "ally", "nun", "twin", "cog"];

  for (const provName of providerOrder) {
    const prov = providers[provName];
    if (!prov?.episodes?.[category]) continue;

    const episodes = prov.episodes[category];
    const ep = episodes.find((e) => e.number === episodeNumber);
    if (!ep) continue;

    const slug = ep.id || ep.slug || ep.url || `${anilistId}-ep-${episodeNumber}`;
    try {
      const { data } = await retryGet(`/stream`, {
        params: { provider: provName, anilistId, category, slug },
      }, 1, 1000);

      if (data?.streams?.length > 0) {
        const stream = data.streams[0];
        const result = {
          success: true,
          source: "miruro",
          provider: provName,
          language,
          m3u8: stream.url,
          quality: stream.quality || null,
          type: stream.type || "hls",
          subtitles: (data.subtitles || []).map((s) => ({
            file: s.file || s.url,
            label: s.label || s.lang || "English",
            kind: s.kind || "captions",
          })),
          intro: data.intro || null,
          outro: data.outro || null,
          episodeNumber,
          anilistId,
        };
        cache.set(cacheKey, result, 600);
        return result;
      }

      const { data: watchData } = await retryGet(`/watch/${provName}/${anilistId}/${category}/${slug}`, {}, 1, 1000);
      if (watchData?.streams?.length > 0) {
        const stream = watchData.streams[0];
        const result = {
          success: true,
          source: "miruro",
          provider: provName,
          language,
          m3u8: stream.url,
          quality: stream.quality || null,
          type: stream.type || "hls",
          subtitles: (watchData.subtitles || []).map((s) => ({
            file: s.file || s.url,
            label: s.label || s.lang || "English",
            kind: s.kind || "captions",
          })),
          intro: watchData.intro || null,
          outro: watchData.outro || null,
          episodeNumber,
          anilistId,
        };
        cache.set(cacheKey, result, 600);
        return result;
      }
    } catch (err) {
      console.error(`[MiruroAPI] watch failed for provider=${provName}, ep=${episodeNumber}:`, err.message);
      continue;
    }
  }

  return { success: false, reason: "No stream found across MiruroAPI providers" };
};

module.exports = { search, getEpisodes, getStream };
