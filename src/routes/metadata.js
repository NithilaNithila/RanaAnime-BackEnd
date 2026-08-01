const router = require("express").Router();
const {
  search,
  getInfo,
  getTrending,
  getPopular,
  getSeasonal,
  getSuggestions,
  getSpotlight,
} = require("../controllers/metadataController");

router.get("/search", search);
router.get("/info/:id", getInfo);
router.get("/trending", getTrending);
router.get("/popular", getPopular);
router.get("/seasonal", getSeasonal);
router.get("/suggestions", getSuggestions);
router.get("/spotlight", getSpotlight);

module.exports = router;
