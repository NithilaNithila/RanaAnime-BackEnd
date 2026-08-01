const router = require("express").Router();
const {
  search,
  getInfo,
  getRecentlyAdded,
} = require("../controllers/streamingMetadataController");

router.get("/search", search);
router.get("/info", getInfo);
router.get("/recently-added", getRecentlyAdded);

module.exports = router;
