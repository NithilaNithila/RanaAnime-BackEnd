const router = require("express").Router();
const { getStream, getSources, getHlsProxy, getGenericHlsProxy, getProxy, getEmbedProxy } = require("../controllers/streamController");

router.get("/sources", getSources);
router.get("/", getStream);
router.get("/hls", getHlsProxy);
router.get("/hls-proxy", getGenericHlsProxy);
router.get("/embed", getEmbedProxy);
router.get("/proxy", getProxy);

module.exports = router;
