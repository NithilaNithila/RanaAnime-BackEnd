const axios = require("axios");
const NodeCache = require("node-cache");
const config = require("../config");

const cache = new NodeCache({ stdTTL: 1800 });

const client = axios.create({
  baseURL: config.anilistApiUrl,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

const transformMedia = (m) => ({
  id: m.id,
  idMal: m.idMal || null,
  title: {
    romaji: m.title?.romaji || "",
    english: m.title?.english || "",
    native: m.title?.native || "",
  },
  coverImage: {
    large: m.coverImage?.large || "",
    medium: m.coverImage?.medium || "",
  },
  bannerImage: m.bannerImage || "",
  description: (m.description || "").replace(/<[^>]+>/g, ""),
  episodes: m.episodes || null,
  status: m.status || "UNKNOWN",
  season: m.season || null,
  seasonYear: m.seasonYear || null,
  genres: m.genres || [],
  format: m.format || "UNKNOWN",
  averageScore: m.averageScore || null,
  meanScore: m.meanScore || null,
  popularity: m.popularity || 0,
  trending: m.trending || 0,
  siteUrl: m.siteUrl || "",
  nextAiringEpisode: m.nextAiringEpisode
    ? { episode: m.nextAiringEpisode.episode, timeUntilAiring: m.nextAiringEpisode.timeUntilAiring }
    : null,
});

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total lastPage hasNextPage currentPage perPage }
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id idMal title { romaji english native }
      coverImage { large medium }
      bannerImage episodes status season seasonYear genres format averageScore popularity
      nextAiringEpisode { episode timeUntilAiring }
    }
  }
}`;

const TRENDING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id idMal title { romaji english native }
      coverImage { large medium }
      bannerImage episodes status season seasonYear genres format averageScore popularity trending
      nextAiringEpisode { episode timeUntilAiring }
    }
  }
}`;

const POPULAR_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC) {
      id idMal title { romaji english native }
      coverImage { large medium }
      bannerImage episodes status season seasonYear genres format averageScore popularity trending
    }
  }
}`;

const SEASONAL_QUERY = `
query ($season: MediaSeason, $year: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC) {
      id idMal title { romaji english native }
      coverImage { large medium }
      bannerImage episodes status season seasonYear genres format averageScore popularity trending
      nextAiringEpisode { episode timeUntilAiring }
    }
  }
}`;

const INFO_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { romaji english native }
    coverImage { large extraLarge medium }
    bannerImage description episodes status season seasonYear genres format averageScore meanScore popularity trending siteUrl synonyms
    characters(sort: ROLE, perPage: 10) {
      edges { role node { name { full } image { medium } } }
    }
    relations { edges { relationType node { id title { romaji english } episodes format } } }
    nextAiringEpisode { episode timeUntilAiring }
  }
}`;

const post = async (query, variables = {}) => {
  const { data } = await client.post("", { query, variables });
  return data?.data;
};

const search = async (query, page = 1, perPage = 20) => {
  const cacheKey = `anilist_search_${query}_${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await post(SEARCH_QUERY, { search: query, page, perPage });
    const results = data?.Page?.media?.map(transformMedia) || [];
    const pageInfo = data?.Page?.pageInfo || {};
    const result = { results, pageInfo };
    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error("[anilist] search failed:", err.message);
    return { results: [], pageInfo: {} };
  }
};

const getTrending = async (page = 1, perPage = 15) => {
  const cacheKey = `anilist_trending_${page}_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await post(TRENDING_QUERY, { page, perPage });
    const results = data?.Page?.media?.map(transformMedia) || [];
    cache.set(cacheKey, results, 900);
    return results;
  } catch (err) {
    console.error("[anilist] getTrending failed:", err.message);
    return [];
  }
};

const getPopular = async (page = 1, perPage = 20) => {
  const cacheKey = `anilist_popular_${page}_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await post(POPULAR_QUERY, { page, perPage });
    const results = data?.Page?.media?.map(transformMedia) || [];
    cache.set(cacheKey, results, 900);
    return results;
  } catch (err) {
    console.error("[anilist] getPopular failed:", err.message);
    return [];
  }
};

const getSeasonal = async (season = null, year = null, page = 1, perPage = 20) => {
  const now = new Date();
  const seasonMap = ["WINTER", "WINTER", "SPRING", "SPRING", "SPRING", "SUMMER", "SUMMER", "SUMMER", "FALL", "FALL", "FALL", "WINTER"];
  const currentSeason = season || seasonMap[now.getMonth()];
  const currentYear = year || now.getFullYear();

  const cacheKey = `anilist_seasonal_${currentSeason}_${currentYear}_${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await post(SEASONAL_QUERY, { season: currentSeason, year: currentYear, page, perPage });
    const results = data?.Page?.media?.map(transformMedia) || [];
    cache.set(cacheKey, results, 900);
    return results;
  } catch (err) {
    console.error("[anilist] getSeasonal failed:", err.message);
    return [];
  }
};

const buildSeasons = (media) => {
  const seasons = [];
  let episodeOffset = 0;

  seasons.push({
    seasonNumber: 1,
    title: media.title?.english || media.title?.romaji || "Season 1",
    anilistId: media.id,
    episodeCount: media.episodes || 0,
    startEpisode: episodeOffset + 1,
  });
  episodeOffset += media.episodes || 0;

  const sequelEdges = (media.relations?.edges || []).filter(
    (e) => e.relationType === "SEQUEL"
  );

  let seasonNum = 2;
  for (const edge of sequelEdges) {
    const node = edge.node;
    if (!node || !node.episodes) continue;

    seasons.push({
      seasonNumber: seasonNum,
      title: node.title?.english || node.title?.romaji || `Season ${seasonNum}`,
      anilistId: node.id,
      episodeCount: node.episodes,
      startEpisode: episodeOffset + 1,
    });
    episodeOffset += node.episodes;
    seasonNum++;
  }

  return seasons;
};

const getMediaInfo = async (id) => {
  const cacheKey = `anilist_info_${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await post(INFO_QUERY, { id: parseInt(id) });
    const media = data?.Media;
    if (!media) return null;
    const result = transformMedia(media);
    result.characters = (media.characters?.edges || []).map(e => ({ ...e.node, role: e.role }));
    result.synonyms = media.synonyms || [];
    result.seasons = buildSeasons(media);
    cache.set(cacheKey, result, 1800);
    return result;
  } catch (err) {
    console.error("[anilist] getMediaInfo failed:", err.message);
    return null;
  }
};

module.exports = { search, getTrending, getPopular, getSeasonal, getMediaInfo };
