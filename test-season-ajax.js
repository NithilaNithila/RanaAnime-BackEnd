const watchanimeworldService = require("./src/services/watchanimeworldService");

(async () => {
  console.log("Fetching Season 2 episodes for post 352 (Naruto Shippuden)...");
  const eps = await watchanimeworldService.getEpisodesForSeason("352", "2");
  console.log("Season 2 episodes count:", eps.length);
  console.log("Sample Season 2 episode:", JSON.stringify(eps.slice(0, 3), null, 2));
})();
