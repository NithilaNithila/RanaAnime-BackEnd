const watchanimeworldService = require("../services/watchanimeworldService");
const anilistService = require("../services/anilistService");

const MAX_EPISODES = 2000;

function slugToSearchTitle(slug) {
  return slug
    .replace(/^series\/|^movies\//, "")
    .replace(/-dub$/, "")
    .replace(/-/g, " ")
    .trim();
}

async function getWawDetails(slug) {
  const variations = [slug];
  if (!slug.startsWith("series/") && !slug.startsWith("movies/")) {
    variations.unshift(`series/${slug}`, `movies/${slug}`);
  }
  for (const v of variations) {
    try {
      const details = await watchanimeworldService.getDetails(v);
      if (details && details.title) return details;
    } catch {}
  }
  return null;
}

async function getEpisodesFromAnilist(title) {
  try {
    const searchResult = await anilistService.search(title, 1, 5);
    if (!searchResult?.results?.length) return null;

    const match = searchResult.results.find((r) => {
      const names = [r.title?.romaji, r.title?.english, r.title?.native].map((n) => (n || "").toLowerCase());
      const q = title.toLowerCase();
      return names.some((n) => n.includes(q) || q.includes(n));
    }) || searchResult.results[0];

    const mediaInfo = await anilistService.getMediaInfo(match.id);
    if (!mediaInfo) return null;

    const seasons = [...(mediaInfo.seasons || [])];
    const episodes = [];
    let hasUnknownCount = false;

    for (const s of seasons) {
      if (!s.episodeCount || s.episodeCount <= 0) {
        hasUnknownCount = true;
        continue;
      }
      const count = Math.min(s.episodeCount, MAX_EPISODES - episodes.length);
      for (let i = 0; i < count; i++) {
        episodes.push({
          season: s.seasonNumber,
          episode: i + 1,
          title: `S${s.seasonNumber} E${i + 1}`,
          url: "",
        });
      }
      if (episodes.length >= MAX_EPISODES) break;
    }

    if (episodes.length === 0 || hasUnknownCount) {
      let totalEp = mediaInfo.episodes || 0;
      if (!totalEp && mediaInfo.nextAiringEpisode?.episode) {
        totalEp = mediaInfo.nextAiringEpisode.episode - 1;
      }
      if (totalEp > 0 && episodes.length < totalEp) {
        const remaining = Math.min(totalEp - episodes.length, MAX_EPISODES - episodes.length);
        for (let i = 1; i <= remaining; i++) {
          episodes.push({
            season: 1,
            episode: episodes.length + 1,
            title: `Episode ${episodes.length + 1}`,
            url: "",
          });
        }
        if (seasons.length > 0 && seasons[0].seasonNumber === 1) {
          seasons[0].episodeCount = episodes.length;
        }
      }
    }

    if (episodes.length === 0) return null;

    return {
      episodes,
      seasons,
      title: mediaInfo.title?.english || mediaInfo.title?.romaji || null,
      description: mediaInfo.description || null,
      poster: mediaInfo.coverImage?.large || mediaInfo.coverImage?.medium || null,
      genres: mediaInfo.genres || [],
      type: (mediaInfo.format === "MOVIE") ? "movie" : "series",
    };
  } catch (err) {
    console.error("[AnimeController] AniList fallback failed:", err.message);
    return null;
  }
}

exports.getAnimeDetails = async (req, res, next) => {
  try {
    const { slug } = req.query;
    if (!slug) {
      return res.status(400).json({ success: false, message: "slug is required" });
    }

    const details = await getWawDetails(slug);
    let allEpisodes = [];
    let metadata = {};

    if (details) {
      allEpisodes = [...(details.episodes || [])];
      metadata = {
        title: details.title,
        description: details.description || null,
        poster: details.image || null,
      };

      if (details.seasons && details.seasons.length > 1 && details.id) {
        for (const s of details.seasons) {
          const seasonEps = await watchanimeworldService.getEpisodesForSeason(
            details.id,
            s.id || s.seasonNumber
          );
          if (seasonEps && seasonEps.length > 0) {
            for (const ep of seasonEps) {
              if (!allEpisodes.find((e) => e.episodeNumber === ep.episodeNumber && e.seasonNumber === ep.seasonNumber)) {
                allEpisodes.push(ep);
              }
            }
          }
        }
      }
    }

    if (allEpisodes.length === 0) {
      const searchTitle = metadata.title || slugToSearchTitle(slug);
      console.log(`[AnimeController] WAW returned 0 episodes for "${slug}", trying AniList with "${searchTitle}"`);
      const anilistData = await getEpisodesFromAnilist(searchTitle);
      if (anilistData && anilistData.episodes.length > 0) {
        allEpisodes = anilistData.episodes;
        metadata.title = metadata.title || anilistData.title;
        metadata.description = metadata.description || anilistData.description;
        metadata.poster = metadata.poster || anilistData.poster;
        metadata.genres = anilistData.genres || [];
        metadata.type = anilistData.type || "series";
        metadata.seasons = metadata.seasons || anilistData.seasons || [];
        console.log(`[AnimeController] AniList fallback: found ${allEpisodes.length} episodes`);
      }
    }

    allEpisodes.sort((a, b) => {
      const sA = a.seasonNumber || a.season || 0;
      const sB = b.seasonNumber || b.season || 0;
      const eA = a.episodeNumber || a.episode || 0;
      const eB = b.episodeNumber || b.episode || 0;
      return sA === sB ? eA - eB : sA - sB;
    });

    const episodes = allEpisodes.map((ep) => ({
      season: ep.seasonNumber || ep.season,
      episode: ep.episodeNumber || ep.episode,
      title: ep.title || `S${ep.seasonNumber || ep.season} E${ep.episodeNumber || ep.episode}`,
      url: ep.url,
    }));

    if (!metadata.title) {
      return res.status(404).json({ success: false, message: "Anime not found" });
    }

    const isMovie = slug.startsWith("movies/");

    const allSeasons = details?.seasons?.length
      ? details.seasons
      : metadata.seasons?.length
        ? metadata.seasons
        : [];

    res.json({
      success: true,
      data: {
        title: metadata.title,
        slug: details?.slug || slug,
        description: metadata.description || null,
        poster: metadata.poster || null,
        genres: metadata.genres || [],
        year: null,
        runtime: null,
        episodes,
        type: metadata.type || (isMovie ? "movie" : "series"),
        seasons: allSeasons,
      },
    });
  } catch (err) {
    next(err);
  }
};
