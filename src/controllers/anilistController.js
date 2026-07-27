const anilistService = require("../services/anilistService");

const MAX_PER_PAGE = 50;

function clampPerPage(val, defaultVal) {
  return Math.min(parseInt(val) || defaultVal, MAX_PER_PAGE);
}

exports.search = async (req, res, next) => {
  try {
    const { q, page, perPage } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "q is required" });
    const result = await anilistService.search(q, parseInt(page) || 1, clampPerPage(perPage, 20));
    res.json({ success: true, data: result.results, pageInfo: result.pageInfo });
  } catch (err) {
    next(err);
  }
};

exports.getTrending = async (req, res, next) => {
  try {
    const { page, perPage } = req.query;
    const results = await anilistService.getTrending(parseInt(page) || 1, clampPerPage(perPage, 15));
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getPopular = async (req, res, next) => {
  try {
    const { page, perPage } = req.query;
    const results = await anilistService.getPopular(parseInt(page) || 1, clampPerPage(perPage, 20));
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getSeasonal = async (req, res, next) => {
  try {
    const { season, year, page, perPage } = req.query;
    const results = await anilistService.getSeasonal(season, year ? parseInt(year) : null, parseInt(page) || 1, clampPerPage(perPage, 20));
    res.json({ success: true, data: results });
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
    if (!info) return res.status(404).json({ success: false, message: "Anime not found" });
    res.json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
};
