const User = require("../models/User");

exports.updateWatchProgress = async (req, res, next) => {
  try {
    const { anilistId, title, coverImage, season, episode, progress } = req.body;
    if (!anilistId || !title || episode === undefined) {
      return res.status(400).json({ success: false, message: "anilistId, title, and episode are required" });
    }

    const user = req.user;
    const numericAnilistId = Number(anilistId);
    const numericSeason = season !== undefined ? Number(season) : 1;
    const numericEpisode = Number(episode);

    if (isNaN(numericAnilistId) || isNaN(numericSeason) || isNaN(numericEpisode)) {
      return res.status(400).json({ success: false, message: "anilistId, season, and episode must be numbers" });
    }

    const existing = user.watchHistory.find(
      (h) => h.anilistId === numericAnilistId && h.season === numericSeason && h.episode === numericEpisode
    );
    if (existing) {
      existing.progress = progress || 0;
      existing.lastWatched = new Date();
    } else {
      user.watchHistory.push({
        anilistId: numericAnilistId,
        title,
        coverImage: coverImage || "",
        season: numericSeason,
        episode: numericEpisode,
        progress: progress || 0,
        lastWatched: new Date(),
      });
    }

    if (user.watchHistory.length > 100) {
      user.watchHistory = user.watchHistory.slice(-100);
    }

    await user.save();
    res.json({ success: true, message: "Watch progress updated" });
  } catch (err) {
    next(err);
  }
};

exports.getWatchHistory = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const user = req.user;
    const sorted = [...user.watchHistory].sort((a, b) => new Date(b.lastWatched) - new Date(a.lastWatched));
    const perPage = Math.min(parseInt(limit) || 50, 100);
    const pageNum = parseInt(page) || 1;
    const start = (pageNum - 1) * perPage;
    const paged = sorted.slice(start, start + perPage);

    res.json({
      success: true,
      data: paged,
      pagination: { page: pageNum, limit: perPage, total: sorted.length },
    });
  } catch (err) {
    next(err);
  }
};

exports.getContinueWatching = async (req, res, next) => {
  try {
    const user = req.user;

    const latestByAnime = {};
    for (const entry of user.watchHistory) {
      const key = `${entry.anilistId}-${entry.season || 1}`;
      if (!latestByAnime[key] || new Date(entry.lastWatched) > new Date(latestByAnime[key].lastWatched)) {
        latestByAnime[key] = entry;
      }
    }

    const continueWatching = Object.values(latestByAnime)
      .sort((a, b) => new Date(b.lastWatched) - new Date(a.lastWatched))
      .slice(0, 20);

    res.json({ success: true, data: continueWatching });
  } catch (err) {
    next(err);
  }
};