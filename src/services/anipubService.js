const axios = require("axios");
const NodeCache = require("node-cache");
const config = require("../config");

const cache = new NodeCache({ stdTTL: 600 });

const ANIPUB_BASE = config.anipubApiUrl || "https://anipub.xyz";

const client = axios.create({
  baseURL: ANIPUB_BASE,
  timeout: 10000,
});

const retryGet = async (url, reqConfig = {}, retries = 2, delay = 1000) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.get(url, reqConfig);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

const fixImage = (p) => {
  if (!p) return "";
  return p.startsWith("https://") ? p : `https://anipub.xyz/${p}`;
};

const parseVideoPageForEmbed = async (videoUrl) => {
  try {
    const { data: html, status } = await axios.get(videoUrl, {
      headers: { Referer: `${ANIPUB_BASE}/` },
      timeout: 8000,
    });
    if (status >= 400 || typeof html !== "string") return null;

    const iframeMatch = html.match(/iframe[^>]*src="?([^">\s]+)"?/i);
    if (iframeMatch) {
      let embedUrl = iframeMatch[1];
      if (!embedUrl.startsWith("http")) {
        embedUrl = `https://${embedUrl}`;
      }
      return embedUrl;
    }

    return null;
  } catch {
    return null;
  }
};

const search = async (query) => {
  const cacheKey = `search_${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await retryGet(`/api/search/${encodeURIComponent(query)}`);

    const items = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : [];
    const results = items.map((a) => ({
      id: a.Id,
      title: a.Name,
      image: fixImage(a.Image),
      type: "series",
      episodeCount: 0,
      year: null,
    }));

    const queryLower = query.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    results.sort((a, b) => {
      const aLower = a.title.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      const bLower = b.title.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      const aExact = aLower === queryLower ? 0 : aLower.includes(queryLower) ? 1 : 2;
      const bExact = bLower === queryLower ? 0 : bLower.includes(queryLower) ? 1 : 2;
      return aExact - bExact;
    });

    cache.set(cacheKey, results, 300);
    return results;
  } catch (err) {
    console.error(`[anipub] search failed for query "${query}":`, err.message);
    return [];
  }
};

const getSeriesDetails = async (id) => {
  const seriesId = String(id || "").replace(/^season_/, "").replace(/_\d+$/, "");
  const cacheKey = `series_${seriesId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await retryGet(`/v1/api/details/${seriesId}`);
    const local = data?.local;
    if (!local) return null;

    const totalEpisodes = local.ep ? local.ep.length + 1 : (local.epCount || 1);

    const genres = data?.jikan?.genres?.map((g) => g.name) ||
      (Array.isArray(local.Genres) ? local.Genres : []) ||
      (Array.isArray(local.genres) ? local.genres : []);

    const result = {
      id: local._id || seriesId,
      title: local.Name || local.name || local.title || "",
      description: local.DescripTion || local.description || "",
      image: fixImage(local.ImagePath || local.image || local.poster),
      wideImage: fixImage(local.Cover || local.ImagePath || local.image),
      year: local.Premiered ? parseInt(local.Premiered.match(/\d{4}/)?.[0]) || null : (local.year || null),
      episodeCount: local.epCount || totalEpisodes,
      seasonCount: 1,
      genres,
      seasons: [
        {
          id: `season_${id}_1`,
          title: "Season 1",
          seasonNumber: 1,
          episodeCount: totalEpisodes,
        },
      ],
    };

    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error(`[anipub] getSeriesDetails failed for id="${seriesId}":`, err.message);
    return null;
  }
};

const getEpisodes = async (seriesId) => {
  const cacheKey = `eps_${seriesId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const animeId = String(seriesId).replace("season_", "").replace(/_\d+$/, "");

    const { data } = await retryGet(`/v1/api/details/${animeId}`);
    const local = data?.local;
    if (!local) return [];

    const episodes = [];

    episodes.push({
      id: `${animeId}_1`,
      title: local.title || local.name || "Episode 1",
      description: "",
      episodeNumber: 1,
      duration: 0,
      isSubbed: true,
      isDubbed: false,
      videoLink: local.link || null,
    });

    if (local.ep) {
      local.ep.forEach((ep, i) => {
        episodes.push({
          id: `${animeId}_${i + 2}`,
          title: ep.title || `Episode ${i + 2}`,
          description: "",
          episodeNumber: i + 2,
          duration: 0,
          isSubbed: true,
          isDubbed: false,
          videoLink: ep.link || null,
        });
      });
    }

    cache.set(cacheKey, episodes, 600);
    return episodes;
  } catch (err) {
    console.error(`[anipub] getEpisodes failed for seriesId="${seriesId}":`, err.message);
    return [];
  }
};

const getStream = async (title, episode, language = "sub") => {
  const cacheKey = `stream_${title}_${episode}_${language}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const searchResults = await search(title);
    if (!searchResults || searchResults.length === 0) {
      return { success: false, source: "anipub", reason: "No search results" };
    }

    const match = searchResults[0];
    const episodes = await getEpisodes(match.id);
    const ep = episodes?.find((e) => e.episodeNumber === episode);

    if (!ep) {
      return { success: false, source: "anipub", reason: `Episode ${episode} not found` };
    }

    const videoLink = ep.videoLink;
    if (!videoLink) {
      return { success: false, source: "anipub", reason: "No video link for this episode" };
    }

    const srcMatch = videoLink.match(/src=(.+)/);
    let videoUrl = srcMatch ? srcMatch[1].trim() : null;

    if (!videoUrl) {
      return { success: false, source: "anipub", reason: "Could not parse video URL" };
    }

    if (videoUrl.includes("type=")) {
      videoUrl = videoUrl.replace(/type=(sub|dub)/i, `type=${language}`);
    } else if (videoUrl.includes("/sub") || videoUrl.includes("/dub")) {
      videoUrl = videoUrl.replace(/\/(dub|sub)$/i, `/${language}`);
    }

    let embedUrl = await parseVideoPageForEmbed(videoUrl);
    if (!embedUrl && language !== "dub") {
      const fallbackUrl = videoUrl.replace(/\/(sub)$/i, "/dub");
      embedUrl = await parseVideoPageForEmbed(fallbackUrl);
      if (embedUrl) videoUrl = fallbackUrl;
    }

    if (!embedUrl) {
      return { success: false, source: "anipub", reason: "Could not extract embed URL from video page" };
    }

    const details = await getSeriesDetails(match.id);

    const result = {
      success: true,
      source: "anipub",
      language,
      embedUrl,
      videoUrl,
      seriesId: match.id,
      episodeId: ep.id,
      title: match.title,
      image: match.image,
      episode,
      seasons: details?.seasons || [],
    };

    cache.set(cacheKey, result, 600);
    return result;
  } catch (err) {
    console.error(`[anipub] getStream failed:`, err.message);
    return { success: false, source: "anipub", reason: err.message };
  }
};

module.exports = { search, getSeriesDetails, getEpisodes, getStream };
