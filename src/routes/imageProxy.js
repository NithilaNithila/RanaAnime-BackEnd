const router = require("express").Router();
const { proxyImage } = require("../controllers/imageProxyController");

router.get("/", proxyImage);

module.exports = router;
