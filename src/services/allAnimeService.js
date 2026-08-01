const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const http = require("http");
const https = require("https");
const config = require("../config");

const cache = new NodeCache({ stdTTL: 600 });
const slugCache = new NodeCache({ stdTTL: 3600 });
const m3u8Cache = new NodeCache({ stdTTL: 600 });

const BASE_URL = config.allanimeBaseUrl;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 30, keepAliveMsecs: 30000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 30, keepAliveMsecs: 30000 });

const client = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 6000,
  maxRedirects: 5,
  headers: { "User-Agent": UA },
});

const normalizeTitle = (title) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/\b(dub|sub)\b/gi, "").replace(/-+/g, "-").trim();
};

const searchAnime = async (query) => {
  const cacheKey = `allanime_search_${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data: html } = await client.get(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`, { timeout: 5000 });
    const $ = cheerio.load(html);
    const results = [];

    $(".film-list .item").each((_, el) => {
      const $el = $(el);

      const nameLink = $el.find("a.name").first();
      let title = nameLink.text().trim() || $el.find("img").attr("alt") || "";

      if (/\(Dub\)/i.test(title)) {
        title = title.replace(/\s*\(Dub\)/i, "").trim() + " (Dub)";
      }

      const imgEl = $el.find("a.poster img").first();
      let image = imgEl.attr("data-src") || imgEl.attr("src") || "";
      if (image && !image.startsWith("http")) {
        image = image.startsWith("/") ? BASE_URL + image : BASE_URL + "/" + image;
      }

      let episode = "";
      const epEl = $el.find(".status .ep").first();
      if (epEl.length) {
        episode = epEl.text().trim().replace(/[^\d]/g, "");
      }

      const posterLink = $el.find("a.poster").first();
      let slug = "";
      if (posterLink.length) {
        const href = posterLink.attr("href") || "";
        const m = href.match(/\/anime\/([^/?#]+)/);
        if (m) slug = m[1];
      }
      if (!slug) {
        const nameHref = nameLink.attr("href") || "";
        const m2 = nameHref.match(/\/anime\/([^/?#]+)/);
        if (m2) slug = m2[1];
      }
      if (!slug && title) slug = normalizeTitle(title);

      if (title && title.length > 0 && slug && !INVALID_SLUGS.test(slug) && !INVALID_SLUG_PARTS.test(slug)) {
        results.push({ title, image, episode: episode || null, slug });
      }
    });

    cache.set(cacheKey, results, 300);
    return results;
  } catch (err) {
    console.error("[AllAnime] Search failed:", err.message);
    return [];
  }
};

const getAnimeDetail = async (slug) => {
  const cacheKey = `allanime_detail_${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data: html } = await client.get(`${BASE_URL}/anime/${encodeURIComponent(slug)}`, { timeout: 6000 });
    if (!html || typeof html !== "string" || html.length < 1000) return null;

    const $ = cheerio.load(html);

    const title =
      $(".film-name.dynamic-name, h1.film-name, .detail .film-name, .film-name").first().text().trim() ||
      $("h1").first().text().trim() ||
      "";

    const posterEl = $(".film-poster .film-poster-img, .film-poster img, .detail .film-poster img").first();
    let image = posterEl.attr("data-src") || posterEl.attr("src") || posterEl.attr("data-original") || "";
    if (image && !image.startsWith("http")) {
      image = image.startsWith("/") ? BASE_URL + image : BASE_URL + "/" + image;
    }

    const description =
      $(".film-description, .film-synopsis, .sc-detail .description, .detail .description").first().text().trim() || "";

    let episodeCount = 0;
    const epText =
      $(".film-stats .item:contains('Episode') .name, .film-stats .item:contains('Episodes') .name").first().text().trim() ||
      $(".film-stats .item .name:contains('Episode')").first().text().trim() ||
      $(".episode-list .episode-item").length
        ? String($(".episode-list .episode-item").length)
        : "";
    const epMatch = epText.match(/\d+/);
    if (epMatch) episodeCount = parseInt(epMatch[0], 10);

    if (!title) return null;

    const result = {
      slug,
      title,
      poster: image || "",
      description,
      episodeCount,
    };
    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error("[AllAnime] getAnimeDetail failed for slug:", slug, err.message);
    return null;
  }
};

const generateTitleVariations = (title, language = "sub") => {
  const baseTitle = title.replace(/\s*\(\s*(dub|sub)\s*\)\s*$/i, "").trim();
  const isDub = language === "dub";

  const variations = [];

  if (isDub) {
    variations.push(`${baseTitle} (Dub)`);
    variations.push(`${baseTitle} (dub)`);
  } else {
    variations.push(baseTitle);
    variations.push(`${baseTitle} (Sub)`);
  }

  let t = baseTitle;

  t = t.replace(/\s*:\s*[^:]+$/i, "").trim();
  if (t.length >= 3 && !variations.includes(t)) {
    variations.push(isDub ? `${t} (Dub)` : t);
  }

  t = t.replace(/\s*[-–]\s*(season|cour|part)\s*\d+.*$/i, "").trim();
  if (t.length >= 3 && !variations.includes(t) && !variations.includes(`${t} (Dub)`)) {
    variations.push(isDub ? `${t} (Dub)` : t);
  }

  t = baseTitle.replace(/\s*(season|cour|part)\s*\d+.*$/i, "").trim();
  if (t.length >= 3 && !variations.includes(t) && !variations.includes(`${t} (Dub)`)) {
    variations.push(isDub ? `${t} (Dub)` : t);
  }

  const words = baseTitle.split(/\s+/);
  if (words.length > 4) {
    const short = words.slice(0, Math.ceil(words.length / 2)).join(" ");
    if (short.length >= 3 && !variations.includes(short) && !variations.includes(`${short} (Dub)`)) {
      variations.push(isDub ? `${short} (Dub)` : short);
    }
  }

  if (words.length > 2) {
    const firstWords = words.slice(0, 3).join(" ");
    if (firstWords.length >= 3 && !variations.includes(firstWords) && !variations.includes(`${firstWords} (Dub)`)) {
      variations.push(isDub ? `${firstWords} (Dub)` : firstWords);
    }
  }

  variations.push(baseTitle);

  return [...new Set(variations)];
};

const SEQUEL_KEYWORDS = /\b(season\s*\d+|cour\s*\d+|part\s*\d+|final\s*season|shimetsu|zenpen|kouhen|2nd|3rd|4th|5th|6th|7th|8th|9th)\b/i;

const SEQUEL_SLUG_SPLIT = /[-_]?(season[-_]\d|cour[-_]\d|part[-_]\d|the[-_]final[-_]season|shimetsu|zenpen|kouhen|\d+(?:st|nd|rd|th)[-_]?season|movie|ova|specials|chronicle|kuinaki|lost[-_]girls|guren[-_]no[-_]yumiya|jiyuu[-_]no[-_]tsubasa|how-to-get-stronger|recap|memories|yuuei|heroes-battle|movie)/i;

const INVALID_SLUGS = /^(no-results-found|not-found|404|none)$/i;
const INVALID_SLUG_PARTS = /more[-_]?dub/i;

const KNOWN_ALIASES = {
  "demon slayer": "kimetsu-no-yaiba",
  "demon slayer kimetsu no yaiba": "kimetsu-no-yaiba",
  "solo leveling": "ore-dake-level-up-na-ken",
  "my hero academia": "boku-no-hero-academia",
  "boku no hero academia": "boku-no-hero-academia",
  "one punch man": "one-punch-man",
  "attack on titan": "shingeki-no-kyojin",
  "jujutsu kaisen": "jujutsu-kaisen-tv",
  "frieren": "sousou-no-frieren",
  "bleach": "bleach",
  "naruto": "naruto",
  "one piece": "one-piece",
  "dragon ball z": "dragon-ball-z",
  "death note": "death-note",
  "spy x family": "spy-x-family",
  "chainsaw man": "chainsaw-man",
  "tokyo ghoul": "tokyo-ghoul",
  "fullmetal alchemist": "fullmetal-alchemist-brotherhood",
  "sword art online": "sword-art-online",
  "re:zero": "re-zero-hajimeru-isekai-seikatsu",
  "mob psycho": "mob-psycho-100",
  "hunter x hunter": "hunter-x-hunter",
  "cowboy bebop": "cowboy-bebop",
  "code geass": "code-geass-dhangki-ou-no-akito",
  "gintama": "gintama",
  "haikyuu": "haikyuu",
  "vinland saga": "vinland-saga",
  "devilman crybaby": "devilman-crybaby",
  "castlevania": "castlevania",
};

const deriveBaseSlug = (slug) => {
  if (!slug) return null;
  const parts = slug.split(SEQUEL_SLUG_SPLIT);
  if (parts.length > 0) {
    const base = parts[0].replace(/[-_]$/, "");
    if (base && base.length >= 3 && base !== slug) return base;
  }
  return null;
};

const matchSlug = (title, results) => {
  const lower = title.toLowerCase().trim();
  const hasSequelInQuery = SEQUEL_KEYWORDS.test(lower);

  let best = null;
  let bestScore = -1;

  for (const r of results) {
    if (INVALID_SLUGS.test(r.slug) || INVALID_SLUG_PARTS.test(r.slug)) continue;

    const rt = r.title.toLowerCase().trim();
    let score = 0;

    if (rt === lower) {
      score = 1;
    } else if (rt.includes(lower) && lower.length >= 3) {
      score = 0.8;
      if (!hasSequelInQuery && SEQUEL_KEYWORDS.test(rt)) {
        score = 0.4;
      }
    } else if (lower.includes(rt) && rt.length >= 3) {
      score = 0.7;
      if (!hasSequelInQuery && SEQUEL_KEYWORDS.test(rt)) {
        score = 0.3;
      }
    } else {
      const words = lower.split(/\s+/);
      const matchCount = words.filter(w => w.length >= 2 && rt.includes(w)).length;
      score = (matchCount / Math.max(words.length, 1)) * 0.6;
    }

    if (score > 0 && score === bestScore && best) {
      const currentSlugLen = best.slug.length;
      const newSlugLen = r.slug.length;
      if (newSlugLen < currentSlugLen) {
        score += 0.01;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return { match: best, score: Math.max(bestScore, 0) };
};

const resolveSlug = async (title, language = "sub") => {
  const cacheKey = `${title}_${language}`;
  const cached = slugCache.get(cacheKey);
  if (cached) return cached;

  const baseTitleClean = title.replace(/\s*\(\s*(dub|sub)\s*\)\s*$/i, "").trim().toLowerCase();
  const hasSequelQualifier = SEQUEL_KEYWORDS.test(baseTitleClean);

  const knownSlug = KNOWN_ALIASES[baseTitleClean];
  if (knownSlug) {
    if (language === "dub") {
      const dubSlug = `${knownSlug}-dub`;
      try {
        const probe = await client.get(`${BASE_URL}/anime/${dubSlug}`, { timeout: 5000, validateStatus: (s) => s < 400 });
        const probeBody = typeof probe.data === "string" ? probe.data : "";
        if (probe.status === 200 && !probeBody.includes("No Results Found") && !probeBody.includes("404")) {
          console.log(`[AllAnime] Known alias dub: "${title}" -> ${dubSlug}`);
          slugCache.set(cacheKey, dubSlug);
          return dubSlug;
        }
      } catch (_) {}
    }
    console.log(`[AllAnime] Known alias: "${title}" -> ${knownSlug}`);
    slugCache.set(cacheKey, knownSlug);
    return knownSlug;
  }

  const variations = generateTitleVariations(title, language);
  let bestSlug = null;
  let bestScore = 0;
  let bestLangMatch = false;

  for (const variation of variations) {
    const results = await searchAnime(variation);
    if (!results.length) continue;

    const isDubVariation = /\(dub\)/i.test(variation);
    const { match, score } = matchSlug(variation, results);

    if (match && score >= 0.3 && match.slug) {
      const matchIsDub = /\(dub\)/i.test(match.title);
      const resultLangMatch = (language === "dub") === matchIsDub;
      const effectiveScore = score * (resultLangMatch ? 1 : 0.5);

      if (effectiveScore > bestScore || (effectiveScore === bestScore && resultLangMatch && !bestLangMatch)) {
        bestScore = effectiveScore;
        bestSlug = match.slug;
        bestLangMatch = resultLangMatch;
      }
    }

    if (!bestSlug && results.length > 0 && results[0].slug) {
      const firstIsDub = /\(dub\)/i.test(results[0].title);
      const resultLangMatch = (language === "dub") === firstIsDub;
      if (!bestSlug || (resultLangMatch && !bestLangMatch)) {
        bestSlug = results[0].slug;
        bestLangMatch = resultLangMatch;
      }
    }
  }

  if (bestSlug) {
    if (!hasSequelQualifier && SEQUEL_SLUG_SPLIT.test(bestSlug)) {
      const baseSlug = deriveBaseSlug(bestSlug);
      if (baseSlug) {
        try {
          const probeUrl = `${BASE_URL}/anime/${baseSlug}`;
          const probe = await client.get(probeUrl, { timeout: 5000, validateStatus: (s) => s < 400 });
          if (probe.status === 200) {
            console.log(`[AllAnime] Derived base slug: ${bestSlug} -> ${baseSlug}`);
            slugCache.set(cacheKey, baseSlug);
            return baseSlug;
          }
        } catch (_) {}
      }
    }

    if (!bestLangMatch && language === "dub") {
      const dubSlug = bestSlug.endsWith("-dub") ? bestSlug : `${bestSlug}-dub`;
      if (dubSlug !== bestSlug && !INVALID_SLUGS.test(dubSlug)) {
        try {
          const probe = await client.get(`${BASE_URL}/anime/${dubSlug}`, { timeout: 5000, validateStatus: (s) => s < 400 });
          const probeBody = typeof probe.data === "string" ? probe.data : "";
          const isNotFound = probeBody.includes("no-results-found") || probeBody.includes("No Results Found") || probeBody.includes("404");
          if (probe.status === 200 && !isNotFound) {
            console.log(`[AllAnime] Dub slug found: ${bestSlug} -> ${dubSlug}`);
            slugCache.set(cacheKey, dubSlug);
            return dubSlug;
          }
        } catch (_) {}
      }
    }

    slugCache.set(cacheKey, bestSlug);
    return bestSlug;
  }

  return null;
};

const extractM3u8FromEmbed = async (embedUrl) => {
  const e1 = await client.get(embedUrl, { timeout: 10000 });
  const zrMatch = e1.data.match(/var zrpart2\s*=\s*'([^']+)'/);
  if (!zrMatch) {
    console.error("[AllAnime] extractM3u8: No zrpart2 found in embed page");
    return { directM3u8: null, cdnHeaders: null };
  }

  const zrpart2 = zrMatch[1];
  const baseUrl = embedUrl.split("/").slice(0, 3).join("/");

  const e2 = await client.get(`${baseUrl}/hs/${zrpart2}`, {
    headers: { Referer: embedUrl },
    timeout: 10000,
  });

  const idMatch = e2.data.match(/data-id="([^"]+)"/);
  if (!idMatch) {
    console.error("[AllAnime] extractM3u8: No data-id found in /hs/ page");
    return { directM3u8: null, cdnHeaders: null };
  }

  const e3 = await client.get(`${baseUrl}/hs/getSources?id=${idMatch[1]}`, {
    headers: { Referer: `${baseUrl}/hs/${zrpart2}`, "X-Requested-With": "XMLHttpRequest" },
    timeout: 10000,
  });

  if (!e3.data?.sources) {
    console.error("[AllAnime] extractM3u8: getSources returned no sources (possible anti-bot protection)");
    return { directM3u8: null, cdnHeaders: null };
  }

  let m3u8Url = null;
  const sources = e3.data.sources;
  if (typeof sources === "string") {
    m3u8Url = sources;
  } else if (Array.isArray(sources) && sources.length > 0) {
    m3u8Url = sources[0].file || sources[0].url || sources[0];
  }

  return {
    directM3u8: m3u8Url,
    cdnHeaders: { Referer: baseUrl + "/", Origin: baseUrl },
    intro: e3.data.intro || null,
    outro: e3.data.outro || null,
    tracks: e3.data.tracks || [],
  };
};

const getEpisodeStreamInfo = async (animeSlug, episodeNumber) => {
  const cacheKey = `allanime_stream_${animeSlug}_${episodeNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const paddedEp = String(episodeNumber).padStart(3, "0");
  const referer = `${BASE_URL}/anime/${animeSlug}/episode/${paddedEp}`;

  const ajaxPatterns = [
    `${BASE_URL}/ajax/episode/info?epr=${encodeURIComponent(animeSlug + "/" + episodeNumber + "/vidstreaming.io")}&ts=001`,
    `${BASE_URL}/ajax/film/tooltip/${animeSlug}/${episodeNumber}`,
    `${BASE_URL}/ajax/episode/info?epr=${encodeURIComponent(animeSlug + "/" + episodeNumber)}&ts=001`,
  ];

  let data = null;
  for (const ajaxUrl of ajaxPatterns) {
    try {
      const resp = await client.get(ajaxUrl, {
        headers: { "X-Requested-With": "XMLHttpRequest", Referer: referer },
        timeout: 5000,
      });
      if (resp.data?.target) {
        data = resp.data;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!data?.target) {
    console.error("[AllAnime] No streaming target returned for", animeSlug, "ep", episodeNumber);
    return null;
  }

  const embedUrl = data.target;
  let directM3u8 = null;
  let cdnHeaders = null;
  let intro = null;
  let outro = null;
  let tracks = [];

  try {
    if (embedUrl.includes("echovideo.ru") || embedUrl.includes("embtaku") || embedUrl.includes("embed")) {
      const extracted = await extractM3u8FromEmbed(embedUrl);
      directM3u8 = extracted.directM3u8;
      cdnHeaders = extracted.cdnHeaders;
      intro = extracted.intro;
      outro = extracted.outro;
      tracks = extracted.tracks;
    }
  } catch (err) {
    console.error("[AllAnime] Direct M3U8 extraction failed:", err.message);
  }

  const result = {
    success: true,
    source: "allanime",
    data: { embedUrl, directM3u8, cdnHeaders, intro, outro, tracks, animeSlug, episodeNumber },
  };

  cache.set(cacheKey, result, 600);
  return result;
};

async function resolveM3u8(animeSlug, episodeNumber) {
  const cacheKey = `allanime_m3u8_${animeSlug}_${episodeNumber}`;
  const cached = m3u8Cache.get(cacheKey);
  if (cached) return cached;

  const streamInfo = await getEpisodeStreamInfo(animeSlug, episodeNumber);
  if (!streamInfo?.success) {
    throw new Error("Could not retrieve streaming info for this episode");
  }
  if (!streamInfo.data?.directM3u8) {
    throw new Error("M3U8 source not available (embed URL found at: " + (streamInfo.data?.embedUrl || "unknown") + ")");
  }

  const value = {
    masterUrl: streamInfo.data.directM3u8,
    cdnHeaders: streamInfo.data.cdnHeaders || { Referer: "https://play2.echovideo.ru/", Origin: "https://play2.echovideo.ru" },
    intro: streamInfo.data.intro,
    outro: streamInfo.data.outro,
    tracks: streamInfo.data.tracks,
  };

  m3u8Cache.set(cacheKey, value);
  return value;
}

module.exports = { searchAnime, getAnimeDetail, resolveSlug, getEpisodeStreamInfo, resolveM3u8, client };
