const NodeCache = require("node-cache");
const watchanimeworldService = require("./watchanimeworldService");
const anipubService = require("./anipubService");
const animoyeService = require("./animoyeService");
const allAnimeService = require("./allAnimeService");
const anilistService = require("./anilistService");
const jikanService = require("./jikanService");
const kitsuService = require("./kitsuService");
const miruroService = require("./miruroService");

const cache = new NodeCache({ stdTTL: 600 });

const SOURCE_PRIORITY = ["watchanimeworld", "anipub", "allanime", "animoye", "jikan", "kitsu", "miruro"];

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

const search = async (query, limit = 20) => {
  const cacheKey = `meta_search_${norm(query)}_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [waw, anipub, allanime, animoye, jikan, kitsu, miruro] = await Promise.allSettled([
    watchanimeworldService.search(query),
    anipubService.search(query),
    allAnimeService.searchAnime(query),
    animoyeService.search(query),
    jikanService.search(query, 1, 10),
    kitsuService.search(query, 1, 10),
    miruroService.search(query),
  ]);

  const entries = [];

  const isRelevant = (title) => {
    const q = norm(query);
    const t = norm(title);
    if (!t || !q) return false;
    return t.includes(q) || q.includes(t);
  };

  for (const r of waw.value || []) {
    entries.push({ source: "watchanimeworld", slug: r.slug, title: r.title, image: r.image || "", type: r.type || "series", url: r.url || null, year: null, episodeCount: null });
  }
  for (const r of anipub.value || []) {
    entries.push({ source: "anipub", slug: String(r.id || ""), title: r.title, image: r.image || "", type: r.type || "series", url: null, year: r.year || null, episodeCount: r.episodeCount || null });
  }
  for (const r of allanime.value || []) {
    entries.push({ source: "allanime", slug: r.slug, title: r.title, image: r.image || "", type: "series", url: null, year: null, episodeCount: r.episode ? parseInt(r.episode, 10) || null : null });
  }
  for (const r of animoye.value || []) {
    entries.push({ source: "animoye", slug: r.slug, title: r.title, image: "", type: r.slug && r.slug.includes("movie") ? "movie" : "series", url: r.url || null, year: null, episodeCount: null });
  }
  for (const r of jikan.value?.results || []) {
    const title = r.title?.english || r.title?.romaji || r.title?.native || "";
    if (!isRelevant(title)) continue;
    entries.push({ source: "jikan", slug: `jikan:${r.id}`, title, image: r.coverImage?.large || r.coverImage?.medium || "", type: r.format === "Movie" ? "movie" : "series", url: null, year: r.seasonYear || null, episodeCount: r.episodes || null });
  }
  for (const r of kitsu.value?.results || []) {
    const title = r.title?.english || r.title?.romaji || r.title?.native || "";
    if (!isRelevant(title)) continue;
    entries.push({ source: "kitsu", slug: `kitsu:${r.id}`, title, image: r.coverImage?.large || r.coverImage?.medium || "", type: r.format === "movie" ? "movie" : "series", url: null, year: r.seasonYear || null, episodeCount: r.episodes || null });
  }
  for (const r of miruro.value || []) {
    const title = r.title || "";
    if (!isRelevant(title)) continue;
    entries.push({ source: "miruro", slug: `miruro:${r.anilistId}`, title, image: r.image || "", type: r.format === "MOVIE" ? "movie" : "series", url: null, year: null, episodeCount: r.totalEpisodes || null });
  }

  const map = new Map();
  for (const e of entries) {
    if (!e.title) continue;
    const key = norm(e.title);
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, {
        title: e.title,
        image: e.image,
        slug: e.slug,
        source: e.source,
        type: e.type,
        year: e.year,
        episodeCount: e.episodeCount,
        sources: [{ source: e.source, slug: e.slug }],
      });
      continue;
    }

    const merged = map.get(key);
    if (!merged.image && e.image) merged.image = e.image;
    if (!merged.year && e.year) merged.year = e.year;
    if (!merged.episodeCount && e.episodeCount) merged.episodeCount = e.episodeCount;
    if (!merged.sources.some((s) => s.source === e.source)) merged.sources.push({ source: e.source, slug: e.slug });
    if (SOURCE_PRIORITY.indexOf(e.source) < SOURCE_PRIORITY.indexOf(merged.source)) {
      merged.source = e.source;
      merged.slug = e.slug;
      merged.type = e.type || merged.type;
    }
  }

  const results = [...map.values()].slice(0, limit);
  const out = { results, total: results.length };
  cache.set(cacheKey, out, 300);
  return out;
};

const resolvePrefixedSlug = async (slug) => {
  const [provider, id] = String(slug || "").split(":");
  if (!provider || !id) return null;
  try {
    if (provider === "jikan") {
      const info = await jikanService.getAnimeById(id);
      if (!info) return null;
      return {
        source: "jikan",
        title: info.title?.english || info.title?.romaji || info.title?.native || "",
        slug: String(info.id),
        info,
      };
    }
    if (provider === "kitsu") {
      const info = await kitsuService.getAnimeById(id);
      if (!info) return null;
      return {
        source: "kitsu",
        title: info.title?.english || info.title?.romaji || info.title?.native || "",
        slug: String(info.id),
        info,
      };
    }
    if (provider === "miruro") {
      const anilist = await anilistService.getMediaInfo(id);
      if (!anilist) return null;
      return {
        source: "miruro",
        title: anilist.title?.english || anilist.title?.romaji || anilist.title?.native || "",
        slug: String(anilist.id),
        info: anilist,
      };
    }
  } catch (err) {
    console.error("[StreamingMetadata] prefixed slug resolve failed:", err.message);
  }
  return null;
};

const isPrefixedSlug = (slug) => /^(jikan|kitsu|miruro):\d+$/.test(String(slug || ""));

const resolveWaw = async (slug) => {
  if (isPrefixedSlug(slug)) return { details: null, slug };
  try {
    let details = await watchanimeworldService.getDetails(slug);
    let resolvedSlug = slug;
    if (!details) {
      const sr = await watchanimeworldService.search(slug);
      const match = (sr || []).find((r) => norm(r.title) === norm(slug)) || (sr || [])[0];
      if (match) {
        details = await watchanimeworldService.getDetails(match.slug);
        if (details) resolvedSlug = match.slug;
      }
    }
    return { details, slug: resolvedSlug };
  } catch (err) {
    console.error("[StreamingMetadata] WAW resolve failed:", err.message);
    return { details: null, slug };
  }
};

const findAnipub = async (title) => {
  try {
    const results = await anipubService.search(title);
    if (!results || !results.length) return null;
    const match = results.find((r) => norm(r.title) === norm(title)) || results[0];
    const details = await anipubService.getSeriesDetails(match.id);
    if (!details) return null;
    const episodes = await anipubService.getEpisodes(match.id);
    return { ...details, episodes };
  } catch (err) {
    console.error("[StreamingMetadata] anipub resolve failed:", err.message);
    return null;
  }
};

const findAnimoye = async (title) => {
  try {
    const results = await animoyeService.search(title);
    if (!results || !results.length) return null;
    return await animoyeService.getDetails(results[0].slug);
  } catch (err) {
    console.error("[StreamingMetadata] animoye resolve failed:", err.message);
    return null;
  }
};

const findAllAnime = async (title) => {
  try {
    const slug = await allAnimeService.resolveSlug(title);
    if (!slug) return null;
    const detail = await allAnimeService.getAnimeDetail(slug);
    return detail;
  } catch (err) {
    console.error("[StreamingMetadata] allanime resolve failed:", err.message);
    return null;
  }
};

const enrichWithAnilist = async (title) => {
  try {
    const searchResult = await anilistService.search(title, 1, 5);
    if (!searchResult?.results?.length) return null;
    const match = searchResult.results.find((r) => {
      const names = [r.title?.romaji, r.title?.english, r.title?.native].map((n) => (n || "").toLowerCase());
      const q = title.toLowerCase();
      return names.some((n) => n.includes(q) || q.includes(n));
    }) || searchResult.results[0];
    return await anilistService.getMediaInfo(match.id);
  } catch (err) {
    console.error("[StreamingMetadata] AniList enrich failed:", err.message);
    return null;
  }
};

const findJikan = async (title) => {
  try {
    const result = await jikanService.search(title, 1, 5);
    if (!result?.results?.length) return null;
    const match = result.results.find((r) => {
      const names = [r.title?.romaji, r.title?.english, r.title?.native].map((n) => (n || "").toLowerCase());
      const q = title.toLowerCase();
      return names.some((n) => n.includes(q) || q.includes(n));
    }) || result.results[0];
    const info = await jikanService.getAnimeById(match.id);
    if (!info) return null;
    return { source: "jikan", slug: `jikan:${info.id}`, title: info.title?.english || info.title?.romaji || "", info };
  } catch (err) {
    console.error("[StreamingMetadata] Jikan enrich failed:", err.message);
    return null;
  }
};

const findKitsu = async (title) => {
  try {
    const result = await kitsuService.search(title, 1, 5);
    if (!result?.results?.length) return null;
    const match = result.results.find((r) => {
      const names = [r.title?.romaji, r.title?.english, r.title?.native].map((n) => (n || "").toLowerCase());
      const q = title.toLowerCase();
      return names.some((n) => n.includes(q) || q.includes(n));
    }) || result.results[0];
    const info = await kitsuService.getAnimeById(match.id);
    if (!info) return null;
    return { source: "kitsu", slug: `kitsu:${info.id}`, title: info.title?.english || info.title?.romaji || "", info };
  } catch (err) {
    console.error("[StreamingMetadata] Kitsu enrich failed:", err.message);
    return null;
  }
};

const findMiruro = async (title) => {
  try {
    const results = await miruroService.search(title);
    if (!results?.length) return null;
    const match = results.find((r) => norm(r.title) === norm(title)) || results[0];
    return { source: "miruro", slug: `miruro:${match.anilistId}`, title: match.title, info: match };
  } catch (err) {
    console.error("[StreamingMetadata] Miruro enrich failed:", err.message);
    return null;
  }
};

const getInfo = async (slug) => {
  const cacheKey = `meta_info_${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { details: waw, slug: wawSlug } = await resolveWaw(slug);
  let title = waw?.title || slug;
  let prefixed = null;

  if (!waw) {
    prefixed = await resolvePrefixedSlug(slug);
    if (prefixed) title = prefixed.title;
  }

  const [anipubR, animoyeR, allanimeR, anilistR, jikanR, kitsuR, miruroR] = await Promise.allSettled([
    findAnipub(title),
    findAnimoye(title),
    findAllAnime(title),
    enrichWithAnilist(title),
    prefixed?.source === "jikan" ? Promise.resolve(prefixed) : findJikan(title),
    prefixed?.source === "kitsu" ? Promise.resolve(prefixed) : findKitsu(title),
    prefixed?.source === "miruro" ? Promise.resolve(prefixed) : findMiruro(title),
  ]);

  const anipub = anipubR.status === "fulfilled" ? anipubR.value : null;
  const animoye = animoyeR.status === "fulfilled" ? animoyeR.value : null;
  const allanime = allanimeR.status === "fulfilled" ? allanimeR.value : null;
  const anilist = anilistR.status === "fulfilled" ? anilistR.value : null;
  const jikan = jikanR.status === "fulfilled" ? jikanR.value : null;
  const kitsu = kitsuR.status === "fulfilled" ? kitsuR.value : null;
  const miruro = miruroR.status === "fulfilled" ? miruroR.value : null;

  const anilistInfo = anilist?.info || anilist;
  const jikanInfo = jikan?.info || null;
  const kitsuInfo = kitsu?.info || null;
  const miruroInfo = miruro?.info || null;

  const genres = [
    ...(anipub?.genres || []),
    ...(anilistInfo?.genres || []),
    ...(jikanInfo?.genres || []),
    ...(kitsuInfo?.genres || []),
  ];
  const mergedGenres = [...new Set(genres.filter(Boolean))];

  const enriched = {
    anilistId: anilistInfo?.id || miruroInfo?.anilistId || null,
    malId: jikanInfo?.id || null,
    kitsuId: kitsuInfo?.id || null,
    bannerImage: anilistInfo?.bannerImage || jikanInfo?.bannerImage || kitsuInfo?.bannerImage || null,
    averageScore: anilistInfo?.averageScore || jikanInfo?.averageScore || kitsuInfo?.averageScore || null,
    status: anilistInfo?.status || jikanInfo?.status || kitsuInfo?.status || null,
    format: anilistInfo?.format || jikanInfo?.format || kitsuInfo?.format || null,
    characters: (anilistInfo?.characters?.length ? anilistInfo.characters : jikanInfo?.characters || []).slice(0, 12),
    nextAiringEpisode: anilistInfo?.nextAiringEpisode || null,
  };

  const seasonsMap = new Map();
  const pushSeason = (seasonNumber, title, episodeCount) => {
    const num = parseInt(seasonNumber, 10);
    if (!num) return;
    const existing = seasonsMap.get(num);
    if (!existing) {
      seasonsMap.set(num, { seasonNumber: num, title: title || `Season ${num}`, episodeCount: episodeCount || null });
    } else if (!existing.episodeCount && episodeCount) {
      existing.episodeCount = episodeCount;
    }
  };

  for (const s of waw?.seasons || []) pushSeason(s.seasonNumber, s.title, s.episodeCount);
  for (const s of anipub?.seasons || []) pushSeason(s.seasonNumber, s.title, s.episodeCount);
  for (const s of animoye?.seasons || []) pushSeason(s.seasonNumber, `Season ${s.seasonNumber}`, s.episodeCount);
  for (const s of anilistInfo?.seasons || []) pushSeason(s.seasonNumber, s.title, s.episodeCount);

  const seasons = [...seasonsMap.values()].sort((a, b) => a.seasonNumber - b.seasonNumber);

  const episodesMap = new Map();
  const addEpisodes = (eps) => {
    for (const e of eps || []) {
      const s = e.seasonNumber || e.season || 1;
      const n = e.episodeNumber || e.episode;
      if (!n) continue;
      const k = `${s}:${n}`;
      const rawTitle = (e.title || "").trim();
      const isGeneric = /^S\d+\s*E\d+$/i.test(rawTitle) || /^Episode \d+$/i.test(rawTitle);
      const title = rawTitle && !isGeneric ? rawTitle : `Episode ${n}`;
      const existing = episodesMap.get(k);
      if (!existing) {
        episodesMap.set(k, { season: s, episode: n, title, url: e.url || "" });
      } else {
        if (!existing.url && e.url) existing.url = e.url;
        if (!/^Episode \d+$/.test(existing.title) && title && !isGeneric && existing.title !== title) existing.title = title;
      }
    }
  };

  addEpisodes(waw?.episodes);
  addEpisodes(anipub?.episodes);

  let episodes = [...episodesMap.values()].sort((a, b) => a.season - b.season || a.episode - b.episode);

  if (episodes.length === 0 && animoye?.seasons?.length) {
    for (const s of animoye.seasons) {
      for (let i = 1; i <= (s.episodeCount || 0); i++) {
        episodes.push({ season: s.seasonNumber, episode: i, title: `Episode ${i}`, url: "" });
      }
    }
    episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
  }

  const isMovie = wawSlug.startsWith("movies/") || (waw && !waw.episodes?.length && !waw.seasons?.length) || anilistInfo?.format === "MOVIE" || jikanInfo?.format === "Movie" || kitsuInfo?.format === "movie";

  const result = {
    title,
    slug: wawSlug,
    description: waw?.description || anipub?.description || allanime?.description || anilistInfo?.description || jikanInfo?.description || kitsuInfo?.description || "",
    poster: waw?.image || allanime?.poster || anipub?.image || anilistInfo?.coverImage?.large || anilistInfo?.coverImage?.medium || kitsuInfo?.coverImage?.large || jikanInfo?.coverImage?.large || miruroInfo?.image || "",
    genres: mergedGenres,
    year: anipub?.year || anilistInfo?.seasonYear || jikanInfo?.seasonYear || kitsuInfo?.seasonYear || null,
    type: isMovie ? "movie" : "series",
    seasons,
    episodes,
    episodeCount: episodes.length || anilistInfo?.episodes || jikanInfo?.episodes || kitsuInfo?.episodes || miruroInfo?.totalEpisodes || null,
    enriched,
    sources: [],
  };

  const srcs = [];
  if (waw) srcs.push({ source: "watchanimeworld", slug: wawSlug, available: true });
  else srcs.push({ source: "watchanimeworld", slug: wawSlug, available: false });
  if (anipub) srcs.push({ source: "anipub", slug: anipub.id || "", available: true });
  if (animoye) srcs.push({ source: "animoye", slug: animoye.slug || "", available: true });
  if (allanime) srcs.push({ source: "allanime", slug: allanime.slug || "", available: true });
  result.sources = srcs;

  cache.set(cacheKey, result, 600);
  return result;
};

const getRecentlyAdded = async (limit = 24) => {
  const cacheKey = `meta_recent_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const items = await watchanimeworldService.getHomepage(limit);
  const results = items.map((r) => ({
    source: "watchanimeworld",
    slug: r.slug,
    title: r.title,
    image: r.image || "",
    type: r.type || "series",
    url: r.url || null,
    year: null,
    episodeCount: null,
  }));

  const out = { results, total: results.length };
  cache.set(cacheKey, out, 600);
  return out;
};

module.exports = { search, getInfo, getRecentlyAdded };
