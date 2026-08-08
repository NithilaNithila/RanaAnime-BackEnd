const axios = require("axios");
const NodeCache = require("node-cache");
const config = require("../config");

const cache = new NodeCache({ stdTTL: 1800 });

const client = axios.create({
  baseURL: config.kitsuApiUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/vnd.api+json",
    Accept: "application/vnd.api+json",
  },
});

const deriveSeason = (dateStr) => {
  if (!dateStr) return null;
  const month = parseInt(dateStr.substring(5, 7));
  if (month >= 1 && month <= 3) return "winter";
  if (month >= 4 && month <= 6) return "spring";
  if (month >= 7 && month <= 9) return "summer";
  return "fall";
};

const transformAnime = (item) => {
  const attr = item.attributes || {};
  return {
    id: item.id,
    title: {
      romaji: attr.canonicalTitle || "",
      english: attr.titles?.en_us || attr.titles?.en || "",
      native: attr.titles?.ja_jp || "",
    },
    coverImage: {
      large: attr.posterImage?.original || attr.posterImage?.large || "",
      medium: attr.posterImage?.medium || attr.posterImage?.small || "",
    },
    bannerImage: attr.coverImage?.original || "",
    description: (attr.description || attr.synopsis || "").replace(/<[^>]+>/g, ""),
    episodes: attr.episodeCount || null,
    status: attr.status ? attr.status.toUpperCase() : "UNKNOWN",
    season: deriveSeason(attr.startDate),
    seasonYear: attr.startDate ? parseInt(attr.startDate.substring(0, 4)) : null,
    genres: [],
    format: attr.showType || "UNKNOWN",
    averageScore: attr.averageRating ? Math.round(parseFloat(attr.averageRating)) : null,
    meanScore: attr.averageRating ? Math.round(parseFloat(attr.averageRating)) : null,
    popularity: attr.userCount || 0,
    trending: 0,
    siteUrl: `https://kitsu.io/anime/${attr.slug || item.id}`,
    ageRating: attr.ageRatingGuide || attr.ageRating || "",
    episodeLength: attr.episodeLength || null,
    totalLength: attr.totalLength || null,
  };
};

const fetchGenres = async (animeId) => {
  try {
    const { data } = await client.get(`/anime/${animeId}/genres`);
    return (data?.data || []).map((g) => g.attributes?.name).filter(Boolean);
  } catch {
    return [];
  }
};

const search = async (query, page = 1, perPage = 20) => {
  const cacheKey = `kitsu_search_${query}_${page}_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const offset = (page - 1) * perPage;
    const { data } = await client.get("/anime", {
      params: {
        "filter[text]": query,
        "page[limit]": Math.min(perPage, 20),
        "page[offset]": offset,
        sort: "-popularityRank",
      },
    });
    const results = (data?.data || []).map(transformAnime);
    const totalCount = data?.meta?.count || 0;
    const totalPages = Math.ceil(totalCount / perPage);
    const result = {
      results,
      pageInfo: {
        total: totalCount,
        lastPage: totalPages,
        hasNextPage: page < totalPages,
        currentPage: page,
        perPage,
      },
    };
    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error("[kitsu] search failed:", err.message);
    return { results: [], pageInfo: {} };
  }
};

const getAnimeById = async (kitsuId) => {
  const cacheKey = `kitsu_info_${kitsuId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await client.get(`/anime/${kitsuId}`);
    if (!data?.data) return null;
    const result = transformAnime(data.data);
    result.genres = await fetchGenres(kitsuId);
    cache.set(cacheKey, result, 1800);
    return result;
  } catch (err) {
    console.error("[kitsu] getAnimeById failed:", err.message);
    return null;
  }
};

const getTopRated = async (page = 1, perPage = 20) => {
  const cacheKey = `kitsu_top_${page}_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const offset = (page - 1) * perPage;
    const { data } = await client.get("/anime", {
      params: {
        sort: "-averageRating",
        "page[limit]": Math.min(perPage, 20),
        "page[offset]": offset,
      },
    });
    const results = (data?.data || []).map(transformAnime);
    cache.set(cacheKey, results, 900);
    return results;
  } catch (err) {
    console.error("[kitsu] getTopRated failed:", err.message);
    return [];
  }
};

const getSeasonal = async (season = null, year = null, page = 1, perPage = 20) => {
  const now = new Date();
  const seasonMap = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"];
  const currentSeason = season || seasonMap[now.getMonth()];
  const currentYear = year || now.getFullYear();

  const cacheKey = `kitsu_seasonal_${currentSeason}_${currentYear}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const offset = (page - 1) * perPage;
    const { data } = await client.get("/anime", {
      params: {
        "filter[season]": currentSeason,
        "filter[year]": currentYear,
        "page[limit]": Math.min(perPage, 20),
        "page[offset]": offset,
        sort: "-startDate",
      },
    });
    const results = (data?.data || []).map(transformAnime);
    cache.set(cacheKey, results, 900);
    return results;
  } catch (err) {
    console.error("[kitsu] getSeasonal failed:", err.message);
    return [];
  }
};

const getByGenre = async (genre, page = 1, perPage = 20) => {
  const cacheKey = `kitsu_genre_${genre}_${page}_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const offset = (page - 1) * perPage;
    const { data } = await client.get("/anime", {
      params: {
        "filter[genres]": genre,
        sort: "-popularityRank",
        "page[limit]": Math.min(perPage, 20),
        "page[offset]": offset,
      },
    });
    const results = (data?.data || []).map(transformAnime);
    const totalCount = data?.meta?.count || 0;
    const totalPages = Math.ceil(totalCount / perPage);
    const result = {
      results,
      pageInfo: {
        total: totalCount,
        lastPage: totalPages,
        hasNextPage: page < totalPages,
        currentPage: page,
        perPage,
      },
    };
    cache.set(cacheKey, result, 900);
    return result;
  } catch (err) {
    console.error("[kitsu] getByGenre failed:", err.message);
    return { results: [], pageInfo: {} };
  }
};

module.exports = { search, getAnimeById, getTopRated, getSeasonal, getByGenre };
