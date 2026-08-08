const allAnimeService = require("../services/allAnimeService");
const streamingService = require("../services/streamingService");
const watchanimeworldService = require("../services/watchanimeworldService");
const animoyeService = require("../services/animoyeService");
const NodeCache = require("node-cache");

const ALLOWED_PROXY_HOSTS = [
  "123anime.la",
  "echovideo.ru",
  "play2.echovideo.ru",
  "embtaku.pro",
  "anipub.xyz",
  "megaplay.buzz",
  "dpopdrop89.store",
  "gogoanime.com.by",
  "sbplay1.com",
  "sbplay2.com",
  "sbplay.org",
  "vidcloud.pro",
  "vizcloud.cloud",
  "vizcloud.ru",
  "mycloud.cx",
  "mcloud.to",
  "fembed.com",
  "femax20.com",
  "fcdn.stream",
  "s2.watchasian.cc",
  "asianload.com",
  "gogocdn.net",
  "gogostream.com",
  "gogohd.pro",
  "s3taku.com",
  "zmovies.to",
  "tenshi.dev",
  "aniwatch.to",
  "hianime.to",
  "zoro.to",
  "anicrush.to",
  "miruro.tv",
  "cda-cdn.pl",
  "sxyprn.com",
  "doodcdn.com",
  "doodstream.com",
  "d0000d.com",
  "asnhub.com",
  "embedsito.com",
  "fplayer.info",
  "jwpltx.com",
  "jwpeg.com",
  "vizcloud2.ru",
  "rapid-cloud.co",
  "streamani.net",
  "vidcdn.info",
  "vidstreaming.io",
  "watchasian.cc",
  "whowatch.xyz",
  "bestxstream.info",
  "embedsb.com",
  "playerembed.info",
  "watchanimeworld.org",
  "watchanimeworld.top",
  "watchanimeworld.cc",
  "watchanimeworld.com",
  "watchanimeworld.net",
  "zephyrflick.com",
  "zephyrflick.net",
  "as-cdn.top",
  "as-cdn21.top",
  "iqsmartgames.com",
];

const cdnHeaderCache = new NodeCache({ stdTTL: 600 });
const availabilityCache = new NodeCache({ stdTTL: 300 });

function getSelfBase(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

function isAllowedUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (/^as-cdn\d*\.top$/i.test(parsed.hostname)) return true;
    return ALLOWED_PROXY_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

function injectBaseTag(html, origin) {
  const baseTag = `<base href="${origin}/">`;
  const headMatch = html.match(/<head\b[^>]*>/i);
  if (headMatch) {
    return html.replace(/<head\b[^>]*>/i, (m) => m + baseTag);
  }
  const htmlMatch = html.match(/<html\b[^>]*>/i);
  if (htmlMatch) {
    return html.replace(/<html\b[^>]*>/i, (m) => m + `<head>${baseTag}</head>`);
  }
  return baseTag + html;
}

function getPlaylistBase(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const pathParts = parsed.pathname.split("/");
    pathParts.pop();
    return parsed.origin + pathParts.join("/") + "/";
  } catch {
    return urlStr.substring(0, urlStr.lastIndexOf("/") + 1);
  }
}

function rewriteM3u8(body, playlistBase, selfBase, slug, ep) {
  const lines = body.split("\n");
  const rewritten = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("#")) {
      const uriMatch = trimmed.match(/URI="([^"]+)"/i);
      if (uriMatch) {
        let absolute;
        const uriVal = uriMatch[1];
        if (uriVal.startsWith("http")) {
          absolute = uriVal;
        } else if (uriVal.startsWith("/")) {
          absolute = new URL(playlistBase).origin + uriVal;
        } else {
          absolute = playlistBase + uriVal;
        }
        const proxied = `${selfBase}/api/stream/proxy?url=${encodeURIComponent(absolute)}&slug=${slug || ""}&ep=${ep || ""}`;
        rewritten.push(line.replace(uriMatch[0], `URI="${proxied}"`));
      } else {
        rewritten.push(line);
      }
    } else if (trimmed) {
      let absolute;
      if (trimmed.startsWith("http")) {
        absolute = trimmed;
      } else if (trimmed.startsWith("/")) {
        absolute = new URL(playlistBase).origin + trimmed;
      } else {
        absolute = playlistBase + trimmed;
      }
      rewritten.push(`${selfBase}/api/stream/proxy?url=${encodeURIComponent(absolute)}&slug=${slug || ""}&ep=${ep || ""}`);
    } else {
      rewritten.push(line);
    }
  }
  return rewritten.join("\n");
}

async function getCdnHeaders(slug, ep) {
  if (!slug || !ep) {
    return { Referer: "https://play2.echovideo.ru/", Origin: "https://play2.echovideo.ru" };
  }
  const cacheKey = `cdn_${slug}_${ep}`;
  const cached = cdnHeaderCache.get(cacheKey);
  if (cached) return cached;
  try {
    const resolved = await allAnimeService.resolveM3u8(slug, parseInt(ep));
    const headers = resolved.cdnHeaders || { Referer: "https://play2.echovideo.ru/", Origin: "https://play2.echovideo.ru" };
    cdnHeaderCache.set(cacheKey, headers);
    return headers;
  } catch (_) {
    return { Referer: "https://play2.echovideo.ru/", Origin: "https://play2.echovideo.ru" };
  }
}

function normalizeLanguage(language, fallback = "sub") {
  const normalized = String(language || fallback).toLowerCase().trim();
  const aliases = {
    sub: "sub",
    dub: "dub",
    hindi: "dub",
    tamil: "dub",
    telugu: "dub",
    english: "dub",
  };
  return aliases[normalized] || "sub";
}

function inferSourceFromLanguage(language, requestedSource) {
  const normalizedSource = String(requestedSource || "").toLowerCase().trim();
  if (normalizedSource) return normalizedSource;
  return "123anime";
}

function normalizeStreamRequest(req) {
  const { title, episode, language, source, lang, season } = req.query;
  const requestedLanguage = language || lang || "sub";
  const normalizedSource = String(source || "").toLowerCase().trim();
  const selectedLanguage = normalizeLanguage(requestedLanguage);
  const selectedSource = inferSourceFromLanguage(requestedLanguage, source).toLowerCase();
  const selectedSeason = season ? parseInt(season, 10) : undefined;

  return {
    title,
    episode,
    season: selectedSeason,
    requestedLanguage,
    selectedLanguage,
    selectedSource,
  };
}

exports.getSources = async (req, res) => {
  const checkAvailability = (cacheKey, probe) => {
    const cached = availabilityCache.get(cacheKey);
    if (cached !== undefined) return;
    const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 6000));
    Promise.race([probe(), timeout])
      .then((ok) => availabilityCache.set(cacheKey, ok ? "active" : "inactive"))
      .catch(() => availabilityCache.set(cacheKey, "inactive"));
  };

  checkAvailability("watchanimeworld_status", () => watchanimeworldService.isAvailable());
  checkAvailability("animoye_status", () => animoyeService.isAvailable());

  res.json({
    success: true,
    sources: [
      { id: "123anime", name: "123Anime", status: "active" },
      { id: "anipub", name: "Anipub", status: "active" },
      {
        id: "watchanimeworld",
        name: "WatchAnimeWorld",
        status: availabilityCache.get("watchanimeworld_status") || "inactive",
      },
      {
        id: "animoye",
        name: "AniMoye",
        status: availabilityCache.get("animoye_status") || "inactive",
      },
    ],
  });
};

exports.getStream = async (req, res, next) => {
  try {
    const { title, episode, season, requestedLanguage, selectedLanguage, selectedSource } = normalizeStreamRequest(req);
    if (!title || !episode) {
      return res.status(400).json({ success: false, message: "title and episode are required" });
    }

    const parsedEpisode = parseInt(episode, 10);
    if (isNaN(parsedEpisode) || parsedEpisode < 1) {
      return res.status(400).json({ success: false, message: "episode must be a positive integer" });
    }

    const validSources = ["123anime", "anipub", "watchanimeworld", "animoye"];
    if (!validSources.includes(selectedSource)) {
      return res.status(400).json({ success: false, message: `Invalid source "${selectedSource}". Valid sources: ${validSources.join(", ")}` });
    }

    const stream = await streamingService.getStream(title, parsedEpisode, selectedLanguage, selectedSource, season);

    if (!stream?.success) {
      return res.status(404).json({
        success: false,
        message: stream?.message || "No stream available",
        sourceErrors: stream?.sourceErrors || [],
        attemptedSources: stream?.attemptedSources || [],
      });
    }

    const reqBase = getSelfBase(req);

    let embedProxyUrl = null;
    let providerEmbedUrl = null;
    if (stream.embedUrl) {
      providerEmbedUrl = stream.embedUrl;
      embedProxyUrl = `${reqBase}/api/stream/embed?url=${encodeURIComponent(stream.embedUrl)}`;
    }

    let hlsProxyUrl = null;
    const hlsSource = stream.m3u8 || stream.directM3u8;
    if (hlsSource) {
      const hlsParams = new URLSearchParams({ url: hlsSource });
      if (stream.slug) hlsParams.set("slug", stream.slug);
      if (stream.episode) hlsParams.set("ep", String(stream.episode));
      hlsProxyUrl = `${reqBase}/api/stream/hls-proxy?${hlsParams.toString()}`;
    }

    const hasPlayableUrl = Boolean(embedProxyUrl || hlsProxyUrl);
    const playbackMode = hlsProxyUrl ? "hls" : embedProxyUrl ? "iframe" : "none";

    res.json({
      success: true,
      data: {
        source: stream.source,
        language: selectedLanguage,
        requestedLanguage,
        m3u8: stream.m3u8 || null,
        hlsProxyUrl,
        embedUrl: embedProxyUrl || hlsProxyUrl || null,
        embedProxyUrl,
        providerEmbedUrl,
        iframeUrl: embedProxyUrl || null,
        directUrl: providerEmbedUrl || null,
        directM3u8: stream.directM3u8 || null,
        intro: stream.intro || null,
        outro: stream.outro || null,
        subtitles: stream.subtitles || [],
        tracks: stream.tracks || [],
        provider: stream.provider || null,
        quality: stream.quality || null,
        slug: stream.slug || null,
        seriesId: stream.seriesId || null,
        episodeId: stream.episodeId || null,
        season: stream.season || season || null,
        episode: stream.episode || parsedEpisode || null,
        requestedSeason: stream.requestedSeason || season || null,
        requestedEpisode: stream.requestedEpisode || parsedEpisode || null,
        resolvedEpisode: stream.resolvedEpisode || stream.episode || parsedEpisode || null,
        title: stream.title || title,
        image: stream.image || null,
        seasons: stream.seasons || [],
        attemptedSources: stream.attemptedSources || [],
        playbackMode,
        hasPlayableUrl,
        canPlay: hasPlayableUrl,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.normalizeStreamRequest = normalizeStreamRequest;

exports.getHlsProxy = async (req, res, next) => {
  try {
    const { slug, ep } = req.query;
    if (!slug || !ep) {
      return res.status(400).json({ error: "slug and ep are required" });
    }

    let masterUrl, cdnHeaders;
    try {
      ({ masterUrl, cdnHeaders } = await allAnimeService.resolveM3u8(slug, parseInt(ep)));
    } catch (resolveErr) {
      console.error("[HLS Proxy] M3U8 resolve failed:", resolveErr.message);
      let embedUrl = null;
      try {
        const streamInfo = await allAnimeService.getEpisodeStreamInfo(slug, parseInt(ep));
        embedUrl = streamInfo?.data?.embedUrl || null;
      } catch (_) {}
      if (!res.headersSent) {
        res.status(502).json({
          error: "HLS stream not available",
          reason: resolveErr.message,
          embedUrl,
          message: embedUrl
            ? "Direct M3U8 extraction failed. Use the embedUrl to play in an iframe player."
            : "Could not extract streaming info for this episode.",
        });
      }
      return;
    }

    const m3u8Res = await allAnimeService.client.get(masterUrl, {
      headers: { ...cdnHeaders },
      timeout: 10000,
      responseType: "text",
    });

    const masterBase = getPlaylistBase(masterUrl);
    const selfBase = getSelfBase(req);

    const rewritten = rewriteM3u8(m3u8Res.data, masterBase, selfBase, slug, ep);

    res.set({
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    });
    res.send(rewritten);
  } catch (err) {
    console.error("[HLS Proxy] Error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to fetch HLS playlist" });
    }
  }
};

exports.getGenericHlsProxy = async (req, res, next) => {
  try {
    const { url, slug, ep } = req.query;
    if (!url) {
      return res.status(400).json({ error: "url parameter is required" });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Only HTTP/HTTPS URLs allowed" });
    }

    if (!isAllowedUrl(url) && !(slug && ep)) {
      return res.status(403).json({ error: "Upstream host not allowed" });
    }

    let m3u8Headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (slug && ep) {
      try {
        const cdnH = await getCdnHeaders(slug, ep);
        if (cdnH) m3u8Headers = { ...m3u8Headers, ...cdnH };
      } catch (_) {}
    }

    const m3u8Res = await allAnimeService.client.get(url, {
      headers: m3u8Headers,
      timeout: 10000,
      responseType: "text",
    });

    const content = typeof m3u8Res.data === "string" ? m3u8Res.data : "";
    const playlistBase = getPlaylistBase(url);
    const selfBase = getSelfBase(req);
    const rewritten = rewriteM3u8(content, playlistBase, selfBase, slug || "", ep || "");

    res.set({
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    });
    res.send(rewritten);
  } catch (err) {
    console.error("[Generic HLS Proxy] Error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to proxy HLS playlist" });
    }
  }
};

exports.getProxy = async (req, res, next) => {
  const { url, slug, ep } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  if (!isAllowedUrl(url) && !(slug && ep)) {
    return res.status(403).json({ error: "Upstream host not allowed" });
  }

  try {
    const cdnHeaders = await getCdnHeaders(slug, ep);
    const upstreamHeaders = { ...cdnHeaders, "Accept-Encoding": "identity" };
    if (req.headers.range) {
      upstreamHeaders["Range"] = req.headers.range;
    }

    const probe = await allAnimeService.client.get(url, {
      headers: { ...upstreamHeaders, Range: "bytes=0-255" },
      responseType: "text",
      timeout: 5000,
      validateStatus: (s) => s < 500,
    }).catch(() => null);

    const probeContent = probe?.data || "";
    const probeContentType = (probe?.headers?.["content-type"] || "").toLowerCase();
    const isLikelyM3u8 = probeContent.trimStart().startsWith("#EXTM3U") || probeContentType.includes("mpegurl") || url.endsWith(".m3u8") || url.includes("master.m3u8");

    if (isLikelyM3u8) {
      const rangeHeader = req.headers.range;
      if (rangeHeader) delete upstreamHeaders["Range"];
      const body = await allAnimeService.client.get(url, {
        headers: upstreamHeaders,
        responseType: "text",
        timeout: 10000,
      });
      const content = typeof body.data === "string" ? body.data : "";
      const playlistBase = getPlaylistBase(url);
      const selfBase = getSelfBase(req);
      const rewritten = rewriteM3u8(content, playlistBase, selfBase, slug, ep);
      res.set({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=120",
        "Access-Control-Allow-Origin": "*",
      });
      res.send(rewritten);
      return;
    }

    const upstream = await allAnimeService.client.get(url, {
      headers: upstreamHeaders,
      responseType: "stream",
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });

    const upstreamContentType = (upstream.headers["content-type"] || "").toLowerCase();
    const responseHeaders = {
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Content-Type",
      "Cache-Control": "public, max-age=86400",
    };
    if (upstreamContentType) responseHeaders["Content-Type"] = upstreamContentType;
    if (upstream.headers["content-length"]) responseHeaders["Content-Length"] = upstream.headers["content-length"];
    if (upstream.headers["content-range"]) responseHeaders["Content-Range"] = upstream.headers["content-range"];

    res.writeHead(upstream.status, responseHeaders);
    upstream.data.pipe(res);
    upstream.data.on("error", (err) => {
      console.error("[Proxy] Stream error:", err.message);
      if (!res.headersSent) res.status(502).json({ error: "Stream interrupted" });
    });
  } catch (err) {
    console.error("[Proxy] Error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to fetch upstream resource" });
    }
  }
};

exports.getEmbedProxy = async (req, res, next) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  if (!isAllowedUrl(url)) {
    return res.status(403).json({ error: "Upstream host not allowed" });
  }

  try {
    let upstreamOrigin = "";
    try { upstreamOrigin = new URL(url).origin; } catch {}

    const MAX_RETRIES = 3;
    let upstream = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        upstream = await allAnimeService.client.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            ...(upstreamOrigin ? { Referer: upstreamOrigin } : {}),
          },
          timeout: 15000,
          responseType: "text",
        });
        break;
      } catch (err) {
        if (attempt === MAX_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, 700 * attempt));
      }
    }

    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    });

    let html = upstream.data;
    if (upstreamOrigin && typeof html === "string") {
      html = html.replace(
        /((?:src|href|poster|action|data-src|data-link|data-poster|data-iframe|data-href|data-video)\s*=\s*["'])\/(?!\/)/gi,
        `$1${upstreamOrigin}/`
      );
      html = html.replace(
        /(["'`])\/(?!\/|\s|>|["'`])/g,
        `$1${upstreamOrigin}/`
      );
      html = injectBaseTag(html, upstreamOrigin);
    }
    res.send(html);
  } catch (err) {
    console.error("[Embed Proxy] Error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to fetch embed page" });
    }
  }
};
