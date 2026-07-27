const cheerio = require("cheerio");
const https = require("https");

const BASE_URL = "https://watchanimeworld.org";
const TIMEOUT = 15000;

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, (res) => {
      clearTimeout(timer);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

function postPage(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0", ...headers },
    }, (res) => {
      clearTimeout(timer);
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", (e) => { clearTimeout(timer); reject(e); });
    req.write(body);
    req.end();
  });
}

function parseEpisodes($) {
  const episodes = [];
  const items = $("#episode_by_temp > li").length
    ? $("#episode_by_temp > li")
    : $("li:has(article.episodes)");
  items.each((_, li) => {
    const article = $(li).find("article.episodes");
    if (!article.length) return;
    const link = article.find("a.lnk-blk").attr("href") || "";
    const numEpi = article.find("span.num-epi").text().trim();
    const titleEl = article.find("h2.entry-title").text().trim();
    if (!link || !numEpi) return;
    const match = numEpi.match(/(\d+)x(\d+)/);
    if (match) {
      episodes.push({
        season: parseInt(match[1]),
        episode: parseInt(match[2]),
        title: titleEl || "Episode " + match[2],
        numEpi,
        url: link,
      });
    }
  });
  return episodes;
}

(async () => {
  console.log("Fetching anime page...");
  const html = await fetchPage(`${BASE_URL}/series/attack-on-titan`);
  const $ = cheerio.load(html);

  const title = $("h1.entry-title, h1, .series-title").first().text().trim();
  console.log("Title:", title);

  let episodes = parseEpisodes($);
  console.log("Default page episodes:", episodes.length);

  const seasonLinks = $(".choose-season .sel-temp a[data-post][data-season]");
  console.log("Season links found:", seasonLinks.length);

  const postId = seasonLinks.first().attr("data-post");
  const currentSeason = parseInt($(".n_s").text().trim()) || 1;
  console.log("Post ID:", postId, "Current season:", currentSeason);

  for (let i = 0; i < seasonLinks.length; i++) {
    const sNum = parseInt($(seasonLinks[i]).attr("data-season") || "0");
    if (sNum !== currentSeason && postId) {
      console.log(`Fetching season ${sNum} via AJAX...`);
      try {
        const ajaxHtml = await postPage(
          `${BASE_URL}/wp-admin/admin-ajax.php`,
          new URLSearchParams({ action: "action_select_season", season: String(sNum), post: postId }).toString(),
          { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" }
        );
        const $ajax = cheerio.load(ajaxHtml);
        const sEps = parseEpisodes($ajax);
        console.log(`  Season ${sNum}: ${sEps.length} episodes`);
        episodes = episodes.concat(sEps);
      } catch (e) {
        console.log(`  Season ${sNum} FAILED: ${e.message}`);
      }
    }
  }

  episodes.sort((a, b) => a.season === b.season ? a.episode - b.episode : a.season - b.season);

  console.log("\n=== TOTAL:", episodes.length, "episodes ===");
  const seasons = [...new Set(episodes.map((e) => e.season))].sort();
  for (const s of seasons) {
    const eps = episodes.filter((e) => e.season === s);
    console.log(`Season ${s}: ${eps.length} episodes [E${eps[0].episode}-E${eps[eps.length - 1].episode}]`);
  }

  // Check for mismatches
  const mismatches = [];
  for (const ep of episodes) {
    const urlSlug = ep.url.match(/(\d+)x(\d+)/);
    if (urlSlug) {
      const urlSeason = parseInt(urlSlug[1]);
      const urlEp = parseInt(urlSlug[2]);
      if (urlSeason !== ep.season || urlEp !== ep.episode) {
        mismatches.push({ expected: `S${ep.season}E${ep.episode}`, url: `S${urlSeason}E${urlEp}`, url: ep.url });
      }
    }
  }
  if (mismatches.length) {
    console.log("\nMISMATCHES FOUND:");
    mismatches.forEach((m) => console.log(`  ${m.expected} but URL has ${m.url} - ${m.url}`));
  } else {
    console.log("\nNo season/episode mismatches in URLs");
  }
})();
