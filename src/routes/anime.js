const router = require("express").Router();
const { getAnimeDetails } = require("../controllers/animeController");

router.get("/", getAnimeDetails);
router.get("/details", getAnimeDetails);
router.get("/:slug", getAnimeDetails);

module.exports = router;
