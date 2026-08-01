const router = require("express").Router();
const axios = require("axios");
const { isSafeHttpUrl } = require("../utils/urlSafety");
const { getNews, getNewsBySlug } = require("../controllers/newsController");

router.get("/", getNews);
router.get("/image", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Missing url" });
    if (!isSafeHttpUrl(url)) return res.status(400).json({ error: "Invalid or disallowed url" });
    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://news.google.com/",
      },
    });
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    response.data.on("error", () => res.end());
    response.data.pipe(res);
  } catch {
    if (!res.headersSent) res.status(404).json({ error: "Failed to fetch image" });
  }
});
router.get("/:slug", getNewsBySlug);

module.exports = router;
