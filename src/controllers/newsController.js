const newsService = require("../services/newsService");

async function getNews(req, res, next) {
  try {
    const source = req.query.source || "all";
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;

    const articles = await newsService.fetchAllFeeds(source);
    const total = articles.length;
    const paged = articles.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paged,
      meta: { total, returned: paged.length, hasMore: offset + limit < total },
    });
  } catch (err) {
    next(err);
  }
}

async function getNewsBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const articles = await newsService.fetchAllFeeds("all");
    const article = articles.find((a) => a.slug === slug);

    if (!article) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }

    res.json({ success: true, data: article });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNews, getNewsBySlug };
