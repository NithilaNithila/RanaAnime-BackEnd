const router = require("express").Router();
const { getAnimeDetails } = require("../controllers/animeController");

router.get("/details", getAnimeDetails);

module.exports = router;
