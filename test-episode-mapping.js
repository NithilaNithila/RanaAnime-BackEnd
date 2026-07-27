const watchanimeworldService = require("./src/services/watchanimeworldService");

(async () => {
  console.log("=== Testing Attack on Titan Episode 26 (Season 2 Ep 1) ===");
  const aot26 = await watchanimeworldService.getStream("Attack on Titan", 26, "sub");
  console.log("AOT 26 result:", aot26.success, aot26.reason || aot26.embedUrl);

  console.log("\n=== Testing Solo Leveling Episode 13 (Season 2 Ep 1) ===");
  const sl13 = await watchanimeworldService.getStream("Solo Leveling", 13, "sub");
  console.log("SL 13 result:", sl13.success, sl13.reason || sl13.embedUrl);

  console.log("\n=== Testing Naruto Shippuden Episode 33 ===");
  const ns33 = await watchanimeworldService.getStream("Naruto Shippuden", 33, "sub");
  console.log("NS 33 result:", ns33.success, ns33.reason || ns33.embedUrl);
})();
