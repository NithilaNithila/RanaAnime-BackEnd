const router = require("express").Router();
const { search, getTrending, getPopular, getSeasonal, getMediaInfo, getByGenre } = require("../controllers/anilistController");

router.get("/search", search);
router.get("/trending", getTrending);
router.get("/popular", getPopular);
router.get("/seasonal", getSeasonal);
router.get("/genre/:slug", getByGenre);
router.get("/info/:id", getMediaInfo);

module.exports = router;
