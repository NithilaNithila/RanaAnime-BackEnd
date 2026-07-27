const watchanimeworldService = require("./src/services/watchanimeworldService");

(async () => {
  const titles = ["Demon Slayer", "Jujutsu Kaisen", "My Hero Academia", "Attack on Titan", "Solo Leveling"];

  for (const title of titles) {
    console.log(`\n================ ${title} ================`);
    const searchRes = await watchanimeworldService.search(title);
    if (!searchRes || searchRes.length === 0) {
      console.log("No search results");
      continue;
    }

    const match = searchRes[0];
    console.log("Match title:", match.title, "slug:", match.slug);
    const details = await watchanimeworldService.getDetails(match.slug);
    if (!details) {
      console.log("No details found");
      continue;
    }

    console.log("Post ID:", details.id);
    console.log("Seasons count:", details.seasons?.length);
    console.log("Seasons:", details.seasons);

    for (const season of details.seasons.slice(0, 3)) {
      console.log(`\n  --- Season ${season.seasonNumber} (id=${season.id}) ---`);
      const eps = await watchanimeworldService.getEpisodesForSeason(details.id, season.id);
      console.log(`  Episode count: ${eps.length}`);
      console.log(`  First 3 episodes:`, eps.slice(0, 3).map(e => ({ title: e.title, epNum: e.episodeNumber, url: e.url })));
      console.log(`  Last 3 episodes:`, eps.slice(-3).map(e => ({ title: e.title, epNum: e.episodeNumber, url: e.url })));
    }
  }
})();
