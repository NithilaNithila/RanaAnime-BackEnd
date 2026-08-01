const axios = require("axios");
const { isSafeHttpUrl } = require("../utils/urlSafety");

const CACHE_MAX_AGE = 86400;

async function proxyImage(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }
    if (!isSafeHttpUrl(url)) {
      return res.status(400).json({ error: "Invalid or disallowed URL" });
    }

    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NovaFlix/1.0)",
        Referer: "https://novflix.com/",
      },
    });

    res.set({
      "Content-Type": response.headers["content-type"] || "image/jpeg",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
      "Access-Control-Allow-Origin": "*",
    });

    response.data.pipe(res);
  } catch {
    res.status(404).json({ error: "Failed to fetch image" });
  }
}

module.exports = { proxyImage };
