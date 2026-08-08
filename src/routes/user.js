const router = require("express").Router();
const { protect } = require("../middleware/auth");
const {
  updateWatchProgress,
  getWatchHistory,
  getContinueWatching,
} = require("../controllers/userController");

router.use(protect);

router.post("/history", updateWatchProgress);
router.get("/history", getWatchHistory);
router.get("/continue-watching", getContinueWatching);

module.exports = router;