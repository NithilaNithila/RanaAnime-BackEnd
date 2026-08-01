const axios = require("axios");
const NodeCache = require("node-cache");
const config = require("../config");

const cache = new NodeCache({ stdTTL: 1800 });

const client = axios.create({
  baseURL: config.jikanApiUrl,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 400;

const rateLimitedGet = async (url, params = {}) => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
  return client.get(url, { params });
};

const transformAnime = (item) => ({
  id: item.mal_id,
  title: {
    romaji: item.title || "",
    english: item.title_english || "",
    native: item.title_japanese || "",
  },
  coverImage: {
    large: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || "",
    medium: item.images?.webp?.small_image_url || item.images?.jpg?.small_image_url || "",
  },
  bannerImage: item.images?.jpg?.large_image_url || "",
  description: (item.synopsis || "").replace(/<[^>]+>/g, ""),
  episodes: item.episodes || null,
  status: item.status || "UNKNOWN",
  season: item.season || null,
  seasonYear: item.year || null,
  genres: (item.genres || []).map((g) => g.name),
  format: item.type || "UNKNOWN",
  averageScore: item.score ? Math.round(item.score * 10) : null,
  meanScore: item.score ? Math.round(item.score * 10) : null,
  popularity: item.members || 0,
  trending: 0,
  siteUrl: item.url || "",
  rating: item.rating || "",
  studio: (item.studios || []).map((s) => s.name),
});

const search = async (query, page = 1, perPage = 20) => {
  const cacheKey = `jikan_search_${query}_${page}_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await rateLimitedGet("/anime", { q: query, page, limit: perPage });
    const results = (data?.data || []).map(transformAnime);
    const pageInfo = {
      total: data?.pagination?.items?.total || 0,
      lastPage: data?.pagination?.last_visible_page || 1,
      hasNextPage: data?.pagination?.has_next_page || false,
      currentPage: data?.pagination?.current_page || page,
      perPage,
    };
    const result = { results, pageInfo };
    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error("[jikan] search failed:", err.message);
    return { results: [], pageInfo: {} };
  }
};

const getAnimeById = async (malId) => {
  const cacheKey = `jikan_info_${malId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await rateLimitedGet(`/anime/${malId}/full`);
    if (!data?.data) return null;
    const item = data.data;
    const result = transformAnime(item);
    result.characters = (item.characters || []).map((c) => ({
      name: c.character?.name || "",
      image: c.character?.images?.jpg?.image_url || "",
      role: c.role || "",
      voiceActors: (c.voice_actors || []).map((va) => ({
        name: va.person?.name || "",
        image: va.person?.images?.jpg?.image_url || "",
        language: va.language || "",
      })),
    }));
    result.staff = (item.staff || []).map((s) => ({
      name: s.person?.name || "",
      role: s.positions?.[0] || "",
    }));
    result.relations = (item.relations || []).map((r) => ({
      relation: r.relation || "",
      entries: (r.entry || []).map((e) => ({
        id: e.mal_id,
        name: e.name || "",
        type: e.type || "",
      })),
    }));
    cache.set(cacheKey, result, 1800);
    return result;
  } catch (err) {
    console.error("[jikan] getAnimeById failed:", err.message);
    return null;
  }
};

const getTopAnime = async (page = 1, perPage = 20) => {
  const cacheKey = `jikan_top_${page}_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await rateLimitedGet("/top/anime", { page, limit: perPage });
    const results = (data?.data || []).map(transformAnime);
    cache.set(cacheKey, results, 900);
    return results;
  } catch (err) {
    console.error("[jikan] getTopAnime failed:", err.message);
    return [];
  }
};

const getSeasonal = async (season = null, year = null, page = 1, perPage = 20) => {
  const now = new Date();
  const seasonMap = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"];
  const currentSeason = season || seasonMap[now.getMonth()];
  const currentYear = year || now.getFullYear();

  const cacheKey = `jikan_seasonal_${currentSeason}_${currentYear}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await rateLimitedGet(`/seasons/${currentYear}/${currentSeason}`);
    const results = (data?.data || []).map(transformAnime);
    cache.set(cacheKey, results, 900);
    return results;
  } catch (err) {
    console.error("[jikan] getSeasonal failed:", err.message);
    return [];
  }
};

module.exports = { search, getAnimeById, getTopAnime, getSeasonal };
