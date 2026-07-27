const axios = require("axios");
const cheerio = require("cheerio");
const BASE_URL = "https://watchanimeworld.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function debug() {
  const { data: html } = await axios.get(`${BASE_URL}/series/attack-on-titan/`, {
    headers: { "User-Agent": UA }, timeout: 20000,
  });
  const $ = cheerio.load(html);

  console.log("=== #episode_by_temp > li count ===");
  console.log($("#episode_by_temp > li").length);

  console.log("\n=== First 3 #episode_by_temp > li items ===");
  let count = 0;
  $("#episode_by_temp > li").each((_, el) => {
    if (count++ >= 3) return false;
    const $el = $(el);

    const epLink = $el.find("a.lnk-blk").length ? $el.find("a.lnk-blk").first() : $el.find("a").first();
    const epHref = epLink.attr("href") || "";

    const epTitle = $el.find(".entry-title, .num-epi, .epl-title, .epnum, .episode-num, .eph-num, span").first().text().trim();
    console.log(`  li #${count}: href="${epHref}" epTitle="${epTitle}"`);

    // Check specific selectors
    const numEpi = $el.find(".num-epi").text().trim();
    const entryTitle = $el.find(".entry-title").text().trim();
    const anySpan = $el.find("span").first().text().trim();
    console.log(`    .num-epi="${numEpi}" .entry-title="${entryTitle}" first span="${anySpan}"`);

    // Simulate getDetails parsing
    let episodeNumber = count;
    let seasonNumber = 1;
    const multiMatch = epTitle.match(/(\d+)[xX](\d+)/);
    if (multiMatch) {
      seasonNumber = parseInt(multiMatch[1], 10);
      episodeNumber = parseInt(multiMatch[2], 10);
    } else {
      const epNumMatch = epTitle.match(/episode\s*(\d+)/i) || epTitle.match(/(\d+)/);
      if (epNumMatch) {
        episodeNumber = parseInt(epNumMatch[1], 10);
      }
    }
    console.log(`    PARSED: S${seasonNumber}E${episodeNumber}`);

    // Also try with num-epi directly
    const numEpiMatch = numEpi.match(/(\d+)[xX](\d+)/);
    if (numEpiMatch) {
      console.log(`    num-epi PARSED: S${parseInt(numEpiMatch[1])}E${parseInt(numEpiMatch[2])}`);
    }
  });

  // Check full HTML of first li
  console.log("\n=== Raw HTML of first #episode_by_temp > li ===");
  console.log($("#episode_by_temp > li").first().html()?.substring(0, 600));
}

debug().catch(console.error);
