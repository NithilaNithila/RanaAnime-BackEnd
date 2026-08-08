const test = require("node:test");
const assert = require("node:assert/strict");
const { buildEpisodeCandidates, getSourceCandidates } = require("../src/services/streamingService");

test("buildEpisodeCandidates prefers the requested season and episode before a global fallback", () => {
  const candidates = buildEpisodeCandidates(2, 1, [
    { seasonNumber: 1, episodeCount: 12 },
    { seasonNumber: 2, episodeCount: 24 },
  ]);

  assert.deepStrictEqual(candidates, [
    { episode: 1, season: 2, source: "requested" },
    { episode: 13, season: 2, source: "global" },
  ]);
});

test("buildEpisodeCandidates keeps the original request for season 1", () => {
  const candidates = buildEpisodeCandidates(1, 5, [{ seasonNumber: 1, episodeCount: 12 }]);

  assert.deepStrictEqual(candidates, [{ episode: 5, season: 1, source: "requested" }]);
});

test("getSourceCandidates keeps the requested source first and appends the rest", () => {
  const candidates = getSourceCandidates("animoye");

  assert.deepStrictEqual(candidates, ["animoye", "123anime", "anipub", "watchanimeworld"]);
});

test("getSourceCandidates defaults to the full provider order when none is specified", () => {
  const candidates = getSourceCandidates();

  assert.deepStrictEqual(candidates, ["123anime", "anipub", "watchanimeworld", "animoye"]);
});
