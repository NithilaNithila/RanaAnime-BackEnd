const router = require("express").Router();
const { protect } = require("../middleware/auth");
const {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  updateWatchProgress,
  getWatchHistory,
  getContinueWatching,
} = require("../controllers/userController");

router.use(protect);

router.get("/watchlist", getWatchlist);
router.post("/watchlist", addToWatchlist);
router.delete("/watchlist/:anilistId", removeFromWatchlist);

router.post("/history", updateWatchProgress);
router.get("/history", getWatchHistory);
router.get("/continue-watching", getContinueWatching);

module.exports = router;
