const anilistService = require("../services/anilistService");
const kitsuService = require("../services/kitsuService");

const MAX_PER_PAGE = 50;

function clampPerPage(val, defaultVal) {
  return Math.min(Math.max(parseInt(val) || defaultVal, 1), MAX_PER_PAGE);
}

const isEmptyArray = (arr) => !arr || arr.length === 0;

const isEmptySearchResult = (r) => !r || isEmptyArray(r.results);

exports.search = async (req, res, next) => {
  try {
    const { q, page, perPage } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "q is required" });
    const pageNum = parseInt(page) || 1;
    const perPageNum = clampPerPage(perPage, 20);

    const result = await anilistService.search(q, pageNum, perPageNum);
    if (isEmptySearchResult(result)) {
      const fallback = await kitsuService.search(q, pageNum, perPageNum);
      if (!isEmptySearchResult(fallback)) {
        return res.json({ success: true, source: "kitsu", data: fallback.results, pageInfo: fallback.pageInfo });
      }
    }
    res.json({ success: true, source: "anilist", data: result.results, pageInfo: result.pageInfo });
  } catch (err) {
    next(err);
  }
};

exports.getTrending = async (req, res, next) => {
  try {
    const { page, perPage } = req.query;
    const pageNum = parseInt(page) || 1;
    const perPageNum = clampPerPage(perPage, 15);

    let results = await anilistService.getTrending(pageNum, perPageNum);
    let source = "anilist";
    if (isEmptyArray(results)) {
      const fallback = await kitsuService.getTopRated(pageNum, perPageNum);
      if (!isEmptyArray(fallback)) {
        results = fallback;
        source = "kitsu";
      }
    }
    res.json({ success: true, source, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getPopular = async (req, res, next) => {
  try {
    const { page, perPage } = req.query;
    const pageNum = parseInt(page) || 1;
    const perPageNum = clampPerPage(perPage, 20);

    let results = await anilistService.getPopular(pageNum, perPageNum);
    let source = "anilist";
    if (isEmptyArray(results)) {
      const fallback = await kitsuService.getTopRated(pageNum, perPageNum);
      if (!isEmptyArray(fallback)) {
        results = fallback;
        source = "kitsu";
      }
    }
    res.json({ success: true, source, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getSeasonal = async (req, res, next) => {
  try {
    const { season, year, page, perPage } = req.query;
    const pageNum = parseInt(page) || 1;
    const perPageNum = clampPerPage(perPage, 20);

    let results = await anilistService.getSeasonal(season, year ? parseInt(year) : null, pageNum, perPageNum);
    let source = "anilist";
    if (isEmptyArray(results)) {
      const fallback = await kitsuService.getSeasonal(season, year ? parseInt(year) : null, pageNum, perPageNum);
      if (!isEmptyArray(fallback)) {
        results = fallback;
        source = "kitsu";
      }
    }
    res.json({ success: true, source, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getMediaInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id);
    if (!parsedId || isNaN(parsedId)) return res.status(400).json({ success: false, message: "Valid numeric id is required" });

    const info = await anilistService.getMediaInfo(parsedId);
    if (!info) {
      const fallback = await kitsuService.getAnimeById(parsedId);
      if (fallback) return res.json({ success: true, source: "kitsu", data: fallback });
      return res.status(404).json({ success: false, message: "Anime not found" });
    }
    res.json({ success: true, source: "anilist", data: info });
  } catch (err) {
    next(err);
  }
};

exports.getByGenre = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page, perPage } = req.query;
    const genreName = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const pageNum = parseInt(page) || 1;
    const perPageNum = clampPerPage(perPage, 20);

    const result = await anilistService.getByGenre(genreName, pageNum, perPageNum);
    if (isEmptySearchResult(result)) {
      const fallback = await kitsuService.getByGenre(genreName, pageNum, perPageNum);
      if (!isEmptySearchResult(fallback)) {
        return res.json({ success: true, source: "kitsu", data: fallback.results, pageInfo: fallback.pageInfo });
      }
    }
    res.json({ success: true, source: "anilist", data: result.results, pageInfo: result.pageInfo });
  } catch (err) {
    next(err);
  }
};
