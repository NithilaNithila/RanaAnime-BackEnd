const streamingService = require("./src/services/streamingService");

(async () => {
  // Test with a less popular/newer anime that might not be on 123anime
  const tests = [
    { title: "Oshi no Ko", ep: 1 },
    { title: "Frieren", ep: 1 },
    { title: "Solo Leveling", ep: 1 },
    { title: "Dandadan", ep: 1 },
    { title: "Sousou no Frieren", ep: 1 },
  ];

  for (const t of tests) {
    console.log(`\n--- ${t.title} ep${t.ep} ---`);
    const r = await streamingService.getStream(t.title, t.ep, "sub");
    console.log(`success=${r.success} source=${r.source || "none"}`);
    if (r.attemptedSources) {
      r.attemptedSources.forEach(s => console.log(`  ${s.name}: ${s.success ? "OK" : "FAIL - " + s.reason}`));
    }
    if (r.embedUrl) console.log(`  embed: ${r.embedUrl}`);
  }
})();
