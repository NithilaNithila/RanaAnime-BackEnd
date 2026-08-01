const axios = require("axios");
const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 600 });

const RSS_FEEDS = {
  ann: {
    url: "https://www.animenewsnetwork.com/news/rss.xml",
    name: "Anime News Network",
    isGoogle: false,
  },
  crunchyroll: {
    url: "https://news.google.com/rss/search?q=anime+crunchyroll&hl=en-US&gl=US&ceid=US:en",
    name: "Crunchyroll",
    isGoogle: true,
  },
  animecorner: {
    url: "https://animecorner.me/feed",
    name: "Anime Corner",
    isGoogle: false,
  },
  animeherald: {
    url: "https://animeherald.com/feed",
    name: "Anime Herald",
    isGoogle: false,
  },
};

function extractTag(xml, tag) {
  const cdataMatch = xml.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`)
  );
  if (cdataMatch) return cdataMatch[1].trim();
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : "";
}

function extractAttr(xml, tag, attr) {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`));
  return match ? match[1] : "";
}

function extractMediaUrl(itemXml) {
  const media = extractAttr(itemXml, "media:content", "url");
  if (media) return media;
  const enclosure = extractAttr(itemXml, "enclosure", "url");
  if (enclosure) return enclosure;
  const mediaThumb = extractAttr(itemXml, "media:thumbnail", "url");
  if (mediaThumb) return mediaThumb;
  const imgMatch = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : null;
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseGoogleRssItems(xml, sourceKey, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = stripHtml(extractTag(itemXml, "title"));
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const description = extractTag(itemXml, "description");
    const sourceTag = extractAttr(itemXml, "source", "url");

    const articleLink = link || sourceTag;
    const originalSource = sourceTag || null;
    const excerpt = stripHtml(description);
    const slug = slugify(title);

    items.push({
      title,
      slug,
      excerpt: excerpt.length > 200 ? excerpt.slice(0, 200) + "..." : excerpt,
      content: description,
      source: sourceName,
      sourceKey,
      date: pubDate ? new Date(pubDate).toISOString() : null,
      image: extractMediaUrl(itemXml),
      link: articleLink,
      originalSource,
    });
  }
  return items;
}

function parseDirectRssItems(xml, sourceKey, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = stripHtml(extractTag(itemXml, "title"));
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const description = extractTag(itemXml, "description");
    const image = extractMediaUrl(itemXml);
    const slug = slugify(title);
    const excerpt = stripHtml(description);

    items.push({
      title,
      slug,
      excerpt: excerpt.length > 200 ? excerpt.slice(0, 200) + "..." : excerpt,
      content: description,
      source: sourceName,
      sourceKey,
      date: pubDate ? new Date(pubDate).toISOString() : null,
      image,
      link,
    });
  }
  return items;
}

async function fetchFeed(sourceKey) {
  const feed = RSS_FEEDS[sourceKey];
  if (!feed) return [];
  try {
    const res = await axios.get(feed.url, {
      timeout: 10000,
      headers: { "User-Agent": "NovaFlix/1.0 News Aggregator" },
    });
    const xml = res.data;
    return feed.isGoogle
      ? parseGoogleRssItems(xml, sourceKey, feed.name)
      : parseDirectRssItems(xml, sourceKey, feed.name);
  } catch {
    return [];
  }
}

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchWithTimeout(url, signal) {
  const res = await axios.get(url, {
    timeout: 8000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NovaFlix/1.0)" },
    signal,
  });
  return res.data;
}

async function extractOgImage(url, signal) {
  try {
    const html = await fetchWithTimeout(url, signal);
    if (!html) return null;

    let ogImage = extractMeta(html, "og:image");

    if (ogImage && ogImage.includes("googleusercontent.com")) {
      const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      if (canonical && !canonical[1].includes("news.google.com")) {
        try {
          const realHtml = await fetchWithTimeout(canonical[1], signal);
          if (realHtml) {
            const realOg = extractMeta(realHtml, "og:image");
            if (realOg) ogImage = realOg;
          }
        } catch {}
      }
    }

    return ogImage;
  } catch {
    return null;
  }
}

const SOURCE_COLORS = {
  "Anime News Network": ["#0ea5e9", "#0284c7"],
  Crunchyroll: ["#f97316", "#ea580c"],
  "Anime Corner": ["#a855f7", "#9333ea"],
  "Anime Herald": ["#10b981", "#059669"],
};

function svgFallback(source) {
  const colors = SOURCE_COLORS[source] || ["#0ea5e9", "#0284c7"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors[0]}"/>
      <stop offset="100%" style="stop-color:${colors[1]}"/>
    </linearGradient></defs>
    <rect width="800" height="450" fill="url(#g)"/>
    <text x="400" y="225" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.15)" font-size="80" font-family="Arial,sans-serif" font-weight="bold">NEWS</text>
    <text x="400" y="260" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="20" font-family="Arial,sans-serif" font-weight="bold">${source || "News"}</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

async function fetchAllFeeds(sourceFilter) {
  const cacheKey = `news_${sourceFilter}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const sourceKeys =
    sourceFilter === "all" ? Object.keys(RSS_FEEDS) : [sourceFilter];

  const results = await Promise.all(sourceKeys.map(fetchFeed));
  let articles = results.flat();

  articles.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const toEnrich = articles.filter((a) => !a.image && a.link).slice(0, 20);
  if (toEnrich.length > 0) {
    const ogResults = await Promise.allSettled(
      toEnrich.map((article) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        return extractOgImage(article.link, controller.signal).finally(() =>
          clearTimeout(timer)
        );
      })
    );

    const imageMap = {};
    toEnrich.forEach((article, i) => {
      if (ogResults[i].status === "fulfilled" && ogResults[i].value) {
        imageMap[article.slug] = ogResults[i].value;
      }
    });

    articles = articles.map((a) => {
      if (imageMap[a.slug]) return { ...a, image: imageMap[a.slug] };
      if (!a.image) return { ...a, image: svgFallback(a.source) };
      return a;
    });
  }

  cache.set(cacheKey, articles);
  return articles;
}

module.exports = { fetchAllFeeds, RSS_FEEDS };
