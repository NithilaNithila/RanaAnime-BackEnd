const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://watchanimeworld.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function testFlow() {
  console.log("=== Testing WatchAnimeWorld Episode Matching ===\n");

  // 1. Get series page
  console.log("1. Fetching series page...");
  const { data: html } = await axios.get(`${BASE_URL}/series/attack-on-titan/`, {
    headers: { "User-Agent": UA },
    timeout: 20000,
  });
  const $ = cheerio.load(html);

  // 2. Get postId
  const bodyClass = $("body").attr("class") || "";
  const postIdMatch = bodyClass.match(/postid-(\d+)/);
  const postId = postIdMatch ? postIdMatch[1] : "";
  console.log(`   PostID: ${postId}`);

  // 3. Get seasons
  const seasons = [];
  $(".choose-season .sel-temp a[data-post][data-season]").each((_, el) => {
    const val = $(el).attr("data-season") || "";
    const text = $(el).text().trim();
    if (val && text) {
      seasons.push({ id: val, title: text, seasonNumber: seasons.length + 1 });
    }
  });
  console.log(`   Seasons: ${seasons.map(s => `S${s.seasonNumber}(id=${s.id})`).join(", ")}`);

  // 4. Get default episodes (what's shown on page)
  const defaultEps = [];
  $("#episode_by_temp > li").each((_, el) => {
    const $el = $(el);
    const epTitle = $el.find(".num-epi").first().text().trim();
    const epHref = $el.find("a.lnk-blk").first().attr("href") || "";
    const multiMatch = epTitle.match(/(\d+)[xX](\d+)/);
    if (multiMatch) {
      defaultEps.push({
        season: parseInt(multiMatch[1]),
        episode: parseInt(multiMatch[2]),
        title: epTitle,
        url: epHref,
      });
    }
  });
  console.log(`\n2. Default season episodes (shown on page): ${defaultEps.length} episodes`);
  console.log(`   First 3: ${defaultEps.slice(0, 3).map(e => `${e.title} -> ${e.url.split("/").pop()}`).join(", ")}`);
  console.log(`   Last: ${defaultEps[defaultEps.length - 1]?.title}`);

  // 5. Test AJAX for Season 1
  console.log("\n3. Testing AJAX for Season 1...");
  try {
    const ajaxRes = await axios.post(
      `${BASE_URL}/wp-admin/admin-ajax.php`,
      new URLSearchParams({
        action: "action_select_season",
        season: "1",
        post: postId,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": UA,
        },
        timeout: 20000,
      }
    );
    const $ajax = cheerio.load(ajaxRes.data);
    const s1Eps = [];
    $ajax("li").each((_, el) => {
      const $el = $ajax(el);
      const epTitle = $el.find(".num-epi").first().text().trim();
      const epHref = $el.find("a.lnk-blk").first().attr("href") || "";
      if (!epTitle || !epHref) return;
      const multiMatch = epTitle.match(/(\d+)[xX](\d+)/);
      if (multiMatch) {
        s1Eps.push({
          season: parseInt(multiMatch[1]),
          episode: parseInt(multiMatch[2]),
          title: epTitle,
          url: epHref,
        });
      }
    });
    console.log(`   Season 1 episodes: ${s1Eps.length}`);
    console.log(`   First 3: ${s1Eps.slice(0, 3).map(e => `${e.title} -> S${e.season}E${e.episode}`).join(", ")}`);

    // Check: does S1E1 have seasonNumber=1?
    const s1e1 = s1Eps.find(e => e.season === 1 && e.episode === 1);
    console.log(`   S1E1 found: ${s1e1 ? `${s1e1.title} at ${s1e1.url}` : "NOT FOUND"}`);
    const s1e5 = s1Eps.find(e => e.season === 1 && e.episode === 5);
    console.log(`   S1E5 found: ${s1e5 ? `${s1e5.title} at ${s1e5.url}` : "NOT FOUND"}`);
  } catch (err) {
    console.log(`   AJAX FAILED: ${err.message}`);
  }

  // 6. Test AJAX for Season 4
  console.log("\n4. Testing AJAX for Season 4...");
  try {
    const ajaxRes = await axios.post(
      `${BASE_URL}/wp-admin/admin-ajax.php`,
      new URLSearchParams({
        action: "action_select_season",
        season: "4",
        post: postId,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": UA,
        },
        timeout: 20000,
      }
    );
    const $ajax = cheerio.load(ajaxRes.data);
    const s4Eps = [];
    $ajax("li").each((_, el) => {
      const $el = $ajax(el);
      const epTitle = $el.find(".num-epi").first().text().trim();
      const epHref = $el.find("a.lnk-blk").first().attr("href") || "";
      if (!epTitle || !epHref) return;
      const multiMatch = epTitle.match(/(\d+)[xX](\d+)/);
      if (multiMatch) {
        s4Eps.push({
          season: parseInt(multiMatch[1]),
          episode: parseInt(multiMatch[2]),
          title: epTitle,
          url: epHref,
        });
      }
    });
    console.log(`   Season 4 episodes: ${s4Eps.length}`);
    console.log(`   First 3: ${s4Eps.slice(0, 3).map(e => `${e.title} -> S${e.season}E${e.episode}`).join(", ")}`);

    const s4e1 = s4Eps.find(e => e.season === 4 && e.episode === 1);
    console.log(`   S4E1 found: ${s4e1 ? `${s4e1.title} at ${s4e1.url}` : "NOT FOUND"}`);

    // Critical test: episode 1 from S4 vs S1
    console.log("\n5. MISMATCH TEST:");
    console.log(`   Default eps[0] (first ep on page): ${defaultEps[0]?.title} S${defaultEps[0]?.season}E${defaultEps[0]?.episode}`);
    console.log(`   If user wants S1E1 but code matches by ep number only...`);
    const ep1FromDefault = defaultEps.find(e => e.episode === 1);
    console.log(`   defaultEps.find(e => e.episode === 1) => ${ep1FromDefault?.title} S${ep1FromDefault?.season}E${ep1FromDefault?.episode}`);
    console.log(`   CORRECT? ${ep1FromDefault?.season === 1 ? "YES" : "NO - THIS IS THE BUG!"}`);
  } catch (err) {
    console.log(`   AJAX FAILED: ${err.message}`);
  }
}

testFlow().catch(console.error);
