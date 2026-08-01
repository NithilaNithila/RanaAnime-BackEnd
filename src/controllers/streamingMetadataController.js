const streamingMetadataService = require("../services/streamingMetadataService");

exports.search = async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "q is required" });
    const data = await streamingMetadataService.search(q, Math.min(parseInt(limit) || 20, 50));
    res.json({ success: true, source: "all", data });
  } catch (err) {
    next(err);
  }
};

exports.getInfo = async (req, res, next) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false, message: "slug is required" });
    const data = await streamingMetadataService.getInfo(slug);
    if (!data) return res.status(404).json({ success: false, message: "Anime not found" });
    res.json({ success: true, source: "all", data });
  } catch (err) {
    next(err);
  }
};

exports.getRecentlyAdded = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const data = await streamingMetadataService.getRecentlyAdded(Math.min(parseInt(limit) || 24, 50));
    res.json({ success: true, source: "watchanimeworld", data });
  } catch (err) {
    next(err);
  }
};
