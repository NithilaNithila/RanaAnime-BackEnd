const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const config = require("../config");

const cache = new NodeCache({ stdTTL: 600 });

const BASE_URLS = Array.from(
  new Set([
    config.watchanimeworldBaseUrl || "https://watchanimeworld.org",
    "https://watchanimeworld.top",
    "https://watchanimeworld.cc",
    "https://watchanimeworld.com",
    "https://watchanimeworld.net",
  ].map((url) => url.replace(/\/$/, "")))
);
const BASE_URL = BASE_URLS[0];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const client = axios.create({
  timeout: 20000,
  headers: {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

const isParkedPage = (html) => {
  const normalized = String(html || "").toLowerCase();
  return (
    normalized.includes("for sale") ||
    normalized.includes("domain may be for sale") ||
    normalized.includes("parked") ||
    normalized.includes("find information, resources and relevant links")
  );
};

const normalizeUrl = (path, baseUrl) => {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
};

const requestPage = async (path, options = {}) => {
  const errors = [];
  const normalizedPath = path.startsWith("http") ? path : path.replace(/^\//, "");

  for (const baseUrl of BASE_URLS) {
    const requestUrl = path.startsWith("http") ? path : normalizeUrl(normalizedPath, baseUrl);
    try {
      const response = options.method === "post"
        ? await client.post(requestUrl, options.data, { headers: options.headers })
        : await client.get(requestUrl, { headers: options.headers });

      const html = response.data;
      if (typeof html === "string" && isParkedPage(html)) {
        errors.push(`parked page detected at ${requestUrl}`);
        continue;
      }

      return { html, url: requestUrl, baseUrl };
    } catch (err) {
      errors.push(`${requestUrl}: ${err.message}`);
    }
  }

  throw new Error(`Failed to fetch WatchAnimeWorld page (${errors.join(" | ")})`);
};

const extractAnimeItems = ($) => {
  const results = [];

  $("ul.post-lst li, .post-lst li, article.post, .item, .bsx").each((_, el) => {
    const $el = $(el);
    const linkEl = $el.find("a.lnk-blk").first().length ? $el.find("a.lnk-blk").first() : $el.find("a").first();
    const href = linkEl.attr("href") || "";
    const title =
      $el.find("h2.entry-title, h3.entry-title, .entry-title, .tt, .title").first().text().trim() ||
      linkEl.attr("title")?.trim() ||
      linkEl.text().trim();
    const imgEl = $el.find("img").first();
    const image = imgEl.attr("src") || imgEl.attr("data-src") || "";

    if (title && href) {
      const slug = href.replace(BASE_URL, "").replace(/^\/|\/$/g, "");
      results.push({
        title,
        image,
        slug,
        url: href,
        type: slug.includes("series") ? "series" : "movies",
      });
    }
  });

  const seen = new Set();
  return results.filter((r) => {
    const key = r.slug || r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const search = async (query) => {
  const cacheKey = `waw_search_${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { html } = await requestPage(`/?s=${encodeURIComponent(query)}`);
    const lowerHtml = html.toLowerCase();
    if (isParkedPage(html) || lowerHtml.includes("domain may be for sale")) {
      return [];
    }
    const $ = cheerio.load(html);
    const results = extractAnimeItems($);

    cache.set(cacheKey, results, 300);
    return results;
  } catch (err) {
    console.error("[WatchAnimeWorld] Search failed:", err.message);
    return [];
  }
};

const getHomepage = async (limit = 24) => {
  const cacheKey = `waw_home_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { html } = await requestPage("/");
    const $ = cheerio.load(html);
    const results = extractAnimeItems($).slice(0, limit);
    cache.set(cacheKey, results, 600);
    return results;
  } catch (err) {
    console.error("[WatchAnimeWorld] Homepage scrape failed:", err.message);
    return [];
  }
};

const getDetails = async (slug) => {
  const cacheKey = `waw_detail_${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = slug.startsWith("http") ? slug : `/${slug.replace(/^\//, "")}`;
    const { html } = await requestPage(url);
    const $ = cheerio.load(html);

    const title = $("h1.entry-title, h1, .series-title").first().text().trim();
    const image = $(".wp-post-image, .poster img, article img").first().attr("src") || "";
    const description = $(".entry-content, .description, .synopsis").first().text().trim();

    let postId = "";
    const bodyClass = $("body").attr("class") || "";
    const postIdMatch = bodyClass.match(/postid-(\d+)/);
    if (postIdMatch) postId = postIdMatch[1];

    const seasons = [];
    const seasonLinks = $(
      ".choose-season .sel-temp a[data-post][data-season], " +
      ".s-seasons a[data-season], " +
      ".season-list a[data-season], " +
      ".seasons a.season, " +
      "a[data-season], " +
      "[data-season] a"
    );
    seasonLinks.each((_, el) => {
      const $el = $(el);
      const val = $el.attr("data-season") || $el.data("season") || "";
      const text = $el.text().trim();
      if (val && text) {
        seasons.push({ id: val, title: text, seasonNumber: seasons.length + 1 });
      }
    });

    if (seasons.length === 0) {
      const seasonOptions = $(
        "select[name*='season'] option, " +
        ".season-select option, " +
        "select option, " +
        ".custom-select option, " +
        ".season-dropdown option"
      );
      seasonOptions.each((_, el) => {
        const val = $(el).attr("value") || "";
        const text = $(el).text().trim();
        if (val && text && !/select/i.test(text)) {
          const existing = seasons.find((s) => s.id === val);
          if (!existing) {
            seasons.push({ id: val, title: text, seasonNumber: seasons.length + 1 });
          }
        }
      });
    }

    if (seasons.length === 0) {
      seasons.push({ id: "1", title: "Season 1", seasonNumber: 1 });
    }

    const episodes = [];
    const episodeItems = $("#episode_by_temp > li, #aa-episodes li, .episodes li");
    const targetItems = episodeItems.length
      ? episodeItems
      : $(
          ".post-lst > li, " +
          ".section.episodes li, " +
          ".eplister ul li, " +
          ".episode-list li, " +
          ".list-episode li, " +
          ".listing li, " +
          "ul.episodes li, " +
          ".episode-list-item"
        );

    let perSeasonIndex = 1;
    targetItems.each((_, el) => {
      const $el = $(el);
      const epLink = $el.find("a.lnk-blk").length ? $el.find("a.lnk-blk").first() : $el.find("a").first();
      const epHref = epLink.attr("href") || "";
      if (!epHref || epHref.includes("javascript:")) return;

      const numEpi = $el.find(".num-epi, .ep-number, .e-num, .eptag").first().text().trim();
      const entryTitle = $el.find(".entry-title, .ep-title, .tt").first().text().trim();
      const epTitle = numEpi || entryTitle;

      let episodeNumber = perSeasonIndex;
      let seasonNumber = 1;
      const sxxExxMatch = epTitle.match(/[sS](\d+)\s*[eE](\d+)/);
      const multiMatch = numEpi.match(/(\d+)[xX](\d+)/) || entryTitle.match(/(\d+)[xX](\d+)/) || epTitle.match(/(\d+)[xX](\d+)/);
      if (sxxExxMatch) {
        seasonNumber = parseInt(sxxExxMatch[1], 10);
        episodeNumber = parseInt(sxxExxMatch[2], 10);
      } else if (multiMatch) {
        seasonNumber = parseInt(multiMatch[1], 10);
        episodeNumber = parseInt(multiMatch[2], 10);
      } else {
        const epNumMatch = epTitle.match(/episode\s*(\d+)/i) || epTitle.match(/^(\d+)/);
        if (epNumMatch) {
          episodeNumber = parseInt(epNumMatch[1], 10);
        }
      }

      const isDuplicate = episodes.some(
        (e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber
      );
      if (isDuplicate) return;

      episodes.push({
        id: epHref.replace(BASE_URL, "").replace(/^\//, ""),
        title: epTitle,
        seasonNumber,
        episodeNumber,
        url: epHref,
      });

      perSeasonIndex++;
    });

    const result = {
      id: postId || slug,
      title,
      image,
      description,
      slug,
      seasons,
      episodeCount: episodes.length || 0,
      episodes,
    };

    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error("[WatchAnimeWorld] getDetails failed:", err.message);
    return null;
  }
};

const getEpisodesForSeason = async (postId, seasonNumber) => {
  const cacheKey = `waw_eps_${postId}_${seasonNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { html } = await requestPage("/wp-admin/admin-ajax.php", {
      method: "post",
      data: new URLSearchParams({
        action: "action_select_season",
        season: String(seasonNumber),
        post: String(postId),
      }).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const $ = cheerio.load(html);
    const episodes = [];
    const episodeItems = $("li").length
      ? $("li")
      : $("#episode_by_temp > li, #aa-episodes li, .post-lst > li, .episodes li");

    let perSeasonIndex = 1;
    episodeItems.each((_, el) => {
      const $el = $(el);
      const epLink = $el.find("a.lnk-blk").length ? $el.find("a.lnk-blk").first() : $el.find("a").first();
      const epHref = epLink.attr("href") || "";
      if (!epHref || epHref.includes("javascript:")) return;

      const numEpi = $el.find(".num-epi, .ep-number, .e-num, .eptag").first().text().trim();
      const entryTitle = $el.find(".entry-title, .ep-title, .tt").first().text().trim();
      const epTitle = numEpi || entryTitle;

      const seasonNum = parseInt(seasonNumber, 10) || 1;
      let episodeNumber = perSeasonIndex;

      const sxxExxMatch = epTitle.match(/[sS](\d+)\s*[eE](\d+)/);
      const numOnlyMatch = epTitle.match(/^(\d+)/);
      if (sxxExxMatch) {
        episodeNumber = parseInt(sxxExxMatch[2], 10);
      } else if (numOnlyMatch) {
        episodeNumber = parseInt(numOnlyMatch[1], 10);
      }

      const isDuplicate = episodes.some((e) => e.episodeNumber === episodeNumber);
      if (isDuplicate) return;

      episodes.push({
        id: epHref.replace(BASE_URL, "").replace(/^\//, ""),
        title: epTitle,
        seasonNumber: seasonNum,
        episodeNumber,
        url: epHref,
      });

      perSeasonIndex++;
    });

    cache.set(cacheKey, episodes, 300);
    return episodes;
  } catch (err) {
    console.error("[WatchAnimeWorld] getEpisodesForSeason failed:", err.message);
    return [];
  }
};

const extractEmbedFromEpisode = async (episodeUrl) => {
  try {
    const { html } = await requestPage(episodeUrl);
    const $ = cheerio.load(html);

    const iframeSelectors = [
      'iframe[src*="as-cdn"]',
      'iframe[src*="zephyrflick"]',
      'iframe[src*="embed"]',
      'iframe[src*="video"]',
      ".player-embed iframe",
      ".video-container iframe",
      "#player iframe",
      "iframe[src]",
    ];

    for (const sel of iframeSelectors) {
      const iframes = $(sel);
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes.eq(i);
        let src = iframe.attr("src") || iframe.attr("data-src") || "";
        if (src && !src.includes("player1.php") && src !== "undefined") {
          if (!src.startsWith("http")) {
            src = src.startsWith("//") ? `https:${src}` : normalizeUrl(src, episodeUrl);
          }
          return src;
        }
      }
    }

    const srcMatch = html.match(/iframe[^>]*src="?([^">\s]+)"?/i);
    if (srcMatch) {
      let src = srcMatch[1];
      if (src && !src.includes("player1.php") && src !== "undefined") {
        if (!src.startsWith("http")) {
          src = src.startsWith("//") ? `https:${src}` : normalizeUrl(src, episodeUrl);
        }
        return src;
      }
    }

    return null;
  } catch (err) {
    console.error("[WatchAnimeWorld] extractEmbed failed:", err.message);
    return null;
  }
};

const pickBestSearchResult = (results, query) => {
  if (results.length === 0) return null;
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  const scored = results.map((r) => {
    const t = r.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    let score = 0;
    if (t === q) score = 100;
    else if (t.startsWith(q)) score = 90;
    else if (t.includes(q)) score = 70;
    else if (q.includes(t)) score = 60;
    else {
      const qWords = q.split(/\s+/);
      const tWords = t.split(/\s+/);
      const matchedWords = qWords.filter((w) => tWords.some((tw) => tw.includes(w) || w.includes(tw)));
      score = (matchedWords.length / qWords.length) * 50;
    }
    if (r.type === "series") score += 10;
    return { ...r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
};

const getStream = async (title, episode, season) => {
  const effectiveSeason = season || 1;
  const cacheKey = `waw_stream_${title}_${episode}_${effectiveSeason}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  console.log(`[WatchAnimeWorld] getStream called: title="${title}" episode=${episode} season=${effectiveSeason}`);

  try {
    const searchResults = await search(title);
    if (!searchResults || searchResults.length === 0) {
      console.log(`[WatchAnimeWorld] No search results for "${title}"`);
      return { success: false, source: "watchanimeworld", reason: "WatchAnimeWorld is currently unavailable or has no matching results" };
    }

    const match = pickBestSearchResult(searchResults, title);
    console.log(`[WatchAnimeWorld] Search matched: "${match.title}" slug="${match.slug}"`);
    const details = await getDetails(match.slug);
    if (!details) {
      return { success: false, source: "watchanimeworld", reason: "Could not load anime details" };
    }

    console.log(`[WatchAnimeWorld] Details loaded: postId=${details.id} seasons=${details.seasons.length} defaultEps=${details.episodes.length}`);

    const isMovie = match.slug.startsWith("movies/");
    if (isMovie) {
      console.log(`[WatchAnimeWorld] Detected movie: ${match.slug}`);
      const movieUrl = `${BASE_URL}/${match.slug}`;
      const embedUrl = await extractEmbedFromEpisode(movieUrl);
      if (!embedUrl) {
        return { success: false, source: "watchanimeworld", reason: "Could not extract embed URL for this movie" };
      }
      console.log(`[WatchAnimeWorld] Movie success: embedUrl=${embedUrl}`);
      const result = {
        success: true,
        source: "watchanimeworld",
        embedUrl,
        title: details.title,
        image: details.image,
        slug: match.slug,
        episode: 1,
        season: 1,
        seasons: details.seasons,
        episodeId: match.slug,
      };
      cache.set(cacheKey, result, 600);
      return result;
    }

    let epEntry = null;

    if (details.seasons && details.seasons.length > 0 && details.id) {
      const targetSeason = details.seasons.find((s) => s.seasonNumber === effectiveSeason || String(s.id) === String(effectiveSeason));
      console.log(`[WatchAnimeWorld] Looking for season=${effectiveSeason}, found targetSeason:`, targetSeason ? `${targetSeason.title} (id=${targetSeason.id})` : "NOT FOUND");
      if (targetSeason) {
        const seasonEps = await getEpisodesForSeason(details.id, targetSeason.id || targetSeason.seasonNumber);
        console.log(`[WatchAnimeWorld] Season ${effectiveSeason} has ${seasonEps.length} episodes via AJAX`);
        epEntry = seasonEps.find((e) => e.episodeNumber === episode && e.seasonNumber === effectiveSeason);
        if (epEntry) {
          console.log(`[WatchAnimeWorld] Matched: S${epEntry.seasonNumber}E${epEntry.episodeNumber} → ${epEntry.url}`);
        } else {
          epEntry = seasonEps.find((e) => e.episodeNumber === episode);
          if (epEntry) {
            console.log(`[WatchAnimeWorld] Fallback match (any season): S${epEntry.seasonNumber}E${epEntry.episodeNumber} → ${epEntry.url}`);
          }
        }
      }
    }

    if (!epEntry) {
      let allEpisodes = [...(details.episodes || [])];
      epEntry = allEpisodes.find((e) => e.episodeNumber === episode && e.seasonNumber === effectiveSeason);
      if (epEntry) {
        console.log(`[WatchAnimeWorld] Found in default episodes: S${epEntry.seasonNumber}E${epEntry.episodeNumber} → ${epEntry.url}`);
      }

      if (!epEntry && details.seasons && details.seasons.length > 0 && details.id) {
        for (const s of details.seasons) {
          if (s.seasonNumber === effectiveSeason || String(s.id) === String(effectiveSeason)) {
            const seasonEps = await getEpisodesForSeason(details.id, s.id || s.seasonNumber);
            allEpisodes = allEpisodes.concat(seasonEps);
            epEntry = allEpisodes.find((e) => e.episodeNumber === episode && e.seasonNumber === effectiveSeason);
            if (epEntry) {
              console.log(`[WatchAnimeWorld] Found via fallback season scan: S${epEntry.seasonNumber}E${epEntry.episodeNumber} → ${epEntry.url}`);
              break;
            }
          }
        }
        if (!epEntry) {
          for (const s of details.seasons) {
            const seasonEps = await getEpisodesForSeason(details.id, s.id || s.seasonNumber);
            allEpisodes = allEpisodes.concat(seasonEps);
            epEntry = allEpisodes.find((e) => e.episodeNumber === episode && e.seasonNumber === effectiveSeason);
            if (epEntry) {
              console.log(`[WatchAnimeWorld] Found via full season scan: S${epEntry.seasonNumber}E${epEntry.episodeNumber} → ${epEntry.url}`);
              break;
            }
          }
        }
      }
    }

    if (!epEntry) {
      console.log(`[WatchAnimeWorld] Episode S${effectiveSeason}E${episode} NOT FOUND`);
      return { success: false, source: "watchanimeworld", reason: `Episode S${effectiveSeason}E${episode} not found` };
    }

    const embedUrl = await extractEmbedFromEpisode(epEntry.url);
    if (!embedUrl) {
      return { success: false, source: "watchanimeworld", reason: "Could not extract embed URL" };
    }

    console.log(`[WatchAnimeWorld] Success: embedUrl=${embedUrl}`);

    const result = {
      success: true,
      source: "watchanimeworld",
      embedUrl,
      title: details.title,
      image: details.image,
      slug: match.slug,
      episode,
      season: epEntry.seasonNumber,
      seasons: details.seasons,
      episodeId: epEntry.id,
    };

    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error("[WatchAnimeWorld] getStream failed:", err.message);
    return { success: false, source: "watchanimeworld", reason: err.message };
  }
};

const isAvailable = async () => {
  try {
    const { html } = await requestPage("/");
    return !isParkedPage(html);
  } catch {
    return false;
  }
};

module.exports = { search, getHomepage, getDetails, getEpisodesForSeason, extractEmbedFromEpisode, getStream, isAvailable };
