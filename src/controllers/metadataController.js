const jikanService = require("../services/jikanService");
const kitsuService = require("../services/kitsuService");
const miruroService = require("../services/miruroService");
const anilistService = require("../services/anilistService");

const MAX_PER_PAGE = 50;

function clampPerPage(val, defaultVal) {
  return Math.min(Math.max(parseInt(val) || defaultVal, 1), MAX_PER_PAGE);
}

const sources = {
  anilist: anilistService,
  jikan: jikanService,
  kitsu: kitsuService,
  miruro: miruroService,
};

const searchServices = {
  anilist: "search",
  jikan: "search",
  kitsu: "search",
  miruro: "search",
};

const infoServices = {
  anilist: "getMediaInfo",
  jikan: "getAnimeById",
  kitsu: "getAnimeById",
  miruro: "getAnimeInfo",
};

const trendingServices = {
  anilist: "getTrending",
  jikan: "getTopAnime",
  kitsu: "getTopRated",
  miruro: "getTrending",
};

const popularServices = {
  anilist: "getPopular",
  jikan: "getTopAnime",
  kitsu: "getTopRated",
  miruro: "getPopular",
};

const seasonalServices = {
  anilist: "getSeasonal",
  jikan: "getSeasonal",
  kitsu: "getSeasonal",
  miruro: "getSeasonal",
};

async function callService(service, methodName, fallback, args) {
  if (!service || typeof service[methodName] !== "function") return fallback;
  return service[methodName](...args);
}

exports.search = async (req, res, next) => {
  try {
    const { q, page, perPage, source = "anilist" } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "q is required" });

    const service = sources[source];
    const methodName = searchServices[source];
    if (!service || !methodName) {
      return res.status(400).json({ success: false, message: `Invalid source: ${source}. Valid: ${Object.keys(sources).join(", ")}` });
    }

    const result = await callService(service, methodName, { results: [], pageInfo: {} }, [q, parseInt(page) || 1, clampPerPage(perPage, 20)]);
    res.json({ success: true, source, data: result.results, pageInfo: result.pageInfo });
  } catch (err) {
    next(err);
  }
};

exports.getInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { source = "anilist" } = req.query;
    const parsedId = parseInt(id);
    if (!parsedId || isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: "Valid numeric id is required" });
    }

    const service = sources[source];
    const methodName = infoServices[source];
    if (!service || !methodName) {
      return res.status(400).json({ success: false, message: `Invalid source: ${source}. Valid: ${Object.keys(sources).join(", ")}` });
    }

    const info = await callService(service, methodName, null, [parsedId]);
    if (!info) return res.status(404).json({ success: false, message: "Anime not found" });
    res.json({ success: true, source, data: info });
  } catch (err) {
    next(err);
  }
};

exports.getTrending = async (req, res, next) => {
  try {
    const { page, perPage, source = "anilist" } = req.query;

    const service = sources[source];
    const methodName = trendingServices[source];
    if (!service || !methodName) {
      return res.status(400).json({ success: false, message: `Invalid source: ${source}. Valid: ${Object.keys(sources).join(", ")}` });
    }

    const results = await callService(service, methodName, [], [parseInt(page) || 1, clampPerPage(perPage, 20)]);
    res.json({ success: true, source, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getPopular = async (req, res, next) => {
  try {
    const { page, perPage, source = "anilist" } = req.query;

    const service = sources[source];
    const methodName = popularServices[source];
    if (!service || !methodName) {
      return res.status(400).json({ success: false, message: `Invalid source: ${source}. Valid: ${Object.keys(sources).join(", ")}` });
    }

    const results = await callService(service, methodName, [], [parseInt(page) || 1, clampPerPage(perPage, 20)]);
    res.json({ success: true, source, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getSeasonal = async (req, res, next) => {
  try {
    const { season, year, page, perPage, source = "anilist" } = req.query;

    const service = sources[source];
    const methodName = seasonalServices[source];
    if (!service || !methodName) {
      return res.status(400).json({ success: false, message: `Invalid source: ${source}. Valid: ${Object.keys(sources).join(", ")}` });
    }

    const results = await callService(service, methodName, [], [season, year ? parseInt(year) : null, parseInt(page) || 1, clampPerPage(perPage, 20)]);
    res.json({ success: true, source, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "q is required" });

    const results = await callService(miruroService, "getSuggestions", [], [q]);
    res.json({ success: true, source: "miruro", data: results });
  } catch (err) {
    next(err);
  }
};

exports.getSpotlight = async (req, res, next) => {
  try {
    const results = await callService(miruroService, "getTrending", [], [1, 10]);
    res.json({ success: true, source: "miruro", data: results });
  } catch (err) {
    next(err);
  }
};
