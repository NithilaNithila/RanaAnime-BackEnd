const NodeCache = require("node-cache");
const allAnimeService = require("./allAnimeService");
const anipubService = require("./anipubService");
const animoyeService = require("./animoyeService");
const watchanimeworldService = require("./watchanimeworldService");
const anilistService = require("./anilistService");

const cache = new NodeCache({ stdTTL: 600 });

const VALID_SOURCES = ["123anime", "anipub", "watchanimeworld", "animoye"];

const SOURCE_FRIENDLY = { "123anime": "123Anime", anipub: "Anipub", watchanimeworld: "WatchAnimeWorld", animoye: "AniMoye" };

function buildEpisodeCandidates(season, episode, seasons = []) {
  if (!season || season <= 1) {
    return [{ episode, season: 1, source: "requested" }];
  }

  const normalizedSeason = Number(season);
  const normalizedEpisode = Number(episode);
  const requested = [{ episode: normalizedEpisode, season: normalizedSeason, source: "requested" }];

  if (!Array.isArray(seasons) || seasons.length === 0) {
    return requested;
  }

  let offset = 0;
  for (const s of seasons) {
    const seasonNumber = Number(s?.seasonNumber || 0);
    if (!seasonNumber || seasonNumber >= normalizedSeason) break;
    offset += Number(s?.episodeCount || 0) || 12;
  }

  const globalEpisode = offset + normalizedEpisode;
  return [
    ...requested,
    { episode: globalEpisode, season: normalizedSeason, source: "global" },
  ];
}

function getSourceCandidates(source = "123anime") {
  const requested = String(source || "").toLowerCase();
  const ordered = VALID_SOURCES.filter((candidate) => candidate !== requested);
  return requested && VALID_SOURCES.includes(requested) ? [requested, ...ordered] : [...VALID_SOURCES];
}

const seasonDataCache = new NodeCache({ stdTTL: 1800 });

async function getAnilistSeasonInfo(title, requestedSeason) {
  const seasonNum = Number(requestedSeason) || 1;
  const cacheKey = `season_info_${title}_${seasonNum}`;
  const cached = seasonDataCache.get(cacheKey);
  if (cached) return cached;

  try {
    const searchResult = await anilistService.search(title, 1, 5);
    if (!searchResult?.results?.length) return null;
    const match = searchResult.results.find((r) => {
      const names = [r.title?.romaji, r.title?.english, r.title?.native].map((n) => (n || "").toLowerCase());
      const q = title.toLowerCase();
      return names.some((n) => n.includes(q) || q.includes(n));
    }) || searchResult.results[0];
    if (!match) return null;
    const info = await anilistService.getMediaInfo(match.id);
    if (!info?.seasons?.length) return null;

    const targetSeason = info.seasons.find((s) => Number(s.seasonNumber) === seasonNum) || null;
    const candidates = buildEpisodeCandidates(seasonNum, 1, info.seasons);
    const globalCandidate = candidates.find((c) => c.source === "global");

    const result = {
      seasons: info.seasons.map((s) => ({
        seasonNumber: Number(s.seasonNumber),
        title: s.title || `Season ${s.seasonNumber}`,
        episodeCount: s.episodeCount || null,
        anilistId: s.anilistId || null,
      })),
      seasonAnilistId: targetSeason?.anilistId || null,
      seasonTitle: targetSeason?.title || null,
      globalEpisode: seasonNum > 1 ? (globalCandidate?.episode ?? null) : null,
    };

    seasonDataCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

const sourceHandlers = {
  "123anime": async (title, episode, language, season) => {
    const requestedSeason = Number(season) || 1;
    let seasonsForResponse = null;
    let playedEp = Number(episode) || 1;
    let slug = null;

    const info = await getAnilistSeasonInfo(title, requestedSeason);
    if (info) {
      seasonsForResponse = info.seasons;
    }

    if (requestedSeason > 1 && (!info || !info.seasonAnilistId)) {
      return { success: false, reason: `Season ${requestedSeason} not available on 123Anime` };
    }

    if (requestedSeason > 1 && info.seasonAnilistId) {
      slug = await allAnimeService.resolveSlug(title, language);
      try {
        const seasonSlug = await allAnimeService.resolveSlug(info.seasonTitle, language);
        if (seasonSlug && seasonSlug !== slug) {
          const seasonStream = await allAnimeService.getEpisodeStreamInfo(seasonSlug, playedEp);
          if (seasonStream?.success && seasonStream.data?.embedUrl) {
            return {
              success: true,
              source: "123anime",
              language,
              embedUrl: seasonStream.data.embedUrl,
              directM3u8: seasonStream.data.directM3u8 || null,
              cdnHeaders: seasonStream.data.cdnHeaders || null,
              intro: seasonStream.data.intro || null,
              outro: seasonStream.data.outro || null,
              tracks: seasonStream.data.tracks || [],
              slug: seasonSlug,
              title: info.seasonTitle,
              requestedSeason,
              requestedEpisode: playedEp,
              resolvedEpisode: playedEp,
              season: requestedSeason,
              episode: playedEp,
              seasons: seasonsForResponse,
            };
          }
        }
      } catch (_) {}

      const totalKnown = (info.seasons || []).reduce((sum, s) => sum + (s.episodeCount || 0), 0);
      if (info.globalEpisode && (!totalKnown || info.globalEpisode <= totalKnown)) {
        playedEp = info.globalEpisode;
      } else {
        return { success: false, reason: `Episode ${episode} of season ${requestedSeason} not available on 123Anime` };
      }
    }

    if (!slug) {
      slug = await allAnimeService.resolveSlug(title, language);
      if (!slug) return { success: false, reason: "Anime not found on 123Anime" };
    }

    const stream = await allAnimeService.getEpisodeStreamInfo(slug, playedEp);
    if (!stream?.success || !stream.data?.embedUrl) {
      return { success: false, reason: `Episode ${playedEp} not available on 123Anime` };
    }

    return {
      success: true,
      source: "123anime",
      language,
      embedUrl: stream.data.embedUrl,
      directM3u8: stream.data.directM3u8 || null,
      cdnHeaders: stream.data.cdnHeaders || null,
      intro: stream.data.intro || null,
      outro: stream.data.outro || null,
      tracks: stream.data.tracks || [],
      slug,
      requestedSeason,
      requestedEpisode: Number(episode) || 1,
      resolvedEpisode: playedEp,
      season: requestedSeason,
      episode: Number(episode) || 1,
      seasons: seasonsForResponse,
    };
  },
  anipub: async (title, episode, language, season) => {
    const result = await anipubService.getStream(title, episode, language);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on Anipub" };
  },
  watchanimeworld: async (title, episode, language, season) => {
    const result = await watchanimeworldService.getStream(title, episode, season);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on WatchAnimeWorld" };
  },
  animoye: async (title, episode, language, season) => {
    const result = await animoyeService.getStream(title, episode, language, season);
    if (result?.success) return result;
    return { success: false, reason: result?.reason || "Episode not available on AniMoye" };
  },
};

async function trySource(source, title, episode, language, season) {
  const cacheKey = `stream_src_${title}_${episode}_${language}_${source}_${season || "any"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  try {
    const result = await sourceHandlers[source](title, episode, language, season);
    if (result?.success) {
      cache.set(cacheKey, result, 600);
      return result;
    }
    const failed = { success: false, reason: result?.reason || "No stream available" };
    cache.set(cacheKey, failed, 120);
    return failed;
  } catch (err) {
    const failed = { success: false, reason: err.message };
    cache.set(cacheKey, failed, 120);
    return failed;
  }
}

async function probeEmbedUrl(embedUrl) {
  if (!embedUrl) return true;
  const cacheKey = `embed_probe_${embedUrl}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    let origin = "";
    try { origin = new URL(embedUrl).origin; } catch {}
    const res = await allAnimeService.client.get(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(origin ? { Referer: origin } : {}),
      },
      timeout: 7000,
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const ok = res.status >= 200 && res.status < 400;
    cache.set(cacheKey, ok, 180);
    return ok;
  } catch {
    cache.set(cacheKey, false, 60);
    return false;
  }
}

const getStream = async (title, episode, language = "sub", source = "123anime", season) => {
  const normalizedSource = String(source || "").toLowerCase();

  if (!VALID_SOURCES.includes(normalizedSource)) {
    return {
      success: false,
      message: `Invalid source "${source}". Valid sources: ${VALID_SOURCES.join(", ")}`,
    };
  }

  const sourceCandidates = getSourceCandidates(normalizedSource);
  console.log(`[streaming] getStream: title="${title}" ep=${episode} season=${season || "N/A"} source=${normalizedSource} lang=${language} fallbackOrder=${sourceCandidates.join(",")}`);

  const attemptedSources = [];
  let lastError = null;

  for (const candidate of sourceCandidates) {
    const result = await trySource(candidate, title, episode, language, season);
    attemptedSources.push({
      source: candidate,
      name: SOURCE_FRIENDLY[candidate],
      success: !!result?.success,
      reason: result?.reason || null,
    });

    if (result?.success) {
      if (result.embedUrl) probeEmbedUrl(result.embedUrl).catch(() => {});
      return {
        ...result,
        attemptedSources: attemptedSources.map((entry) => ({ ...entry, success: entry.source === candidate ? true : entry.success })),
      };
    }

    lastError = { source: candidate, reason: result?.reason || "No stream available" };
  }

  return {
    success: false,
    message: "This server is not available for this episode. Try another server.",
    attemptedSources,
    lastError,
  };
};

module.exports = { getStream, buildEpisodeCandidates, getSourceCandidates };
