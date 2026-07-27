const axios = require("axios");
const cheerio = require("cheerio");
const BASE_URL = "https://watchanimeworld.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function check() {
  const { data: html } = await axios.get(`${BASE_URL}/series/attack-on-titan/`, {
    headers: { "User-Agent": UA }, timeout: 20000,
  });
  const $ = cheerio.load(html);

  console.log("=== .n_s element ===");
  const nsText = $(".n_s").text().trim();
  console.log("  .n_s text:", JSON.stringify(nsText));
  console.log("  .n_s length:", $(".n_s").length);

  console.log("\n=== .n_s parent ===");
  console.log("  parent html:", $(".n_s").parent().html()?.substring(0, 300));

  console.log("\n=== Current season indicators ===");
  $(".choose-season .sel-temp a").each((i, el) => {
    const $el = $(el);
    const isActive = $el.hasClass("active") || $el.hasClass("sel") || $el.hasClass("current");
    console.log(`  Season ${$el.attr("data-season")}: active=${isActive} classes="${$el.attr("class")}"`);
  });

  console.log("\n=== #episode_by_temp first 3 items ===");
  let count = 0;
  $("#episode_by_temp li").each((_, el) => {
    if (count++ >= 3) return false;
    const title = $(el).find(".num-epi").text().trim();
    console.log(`  ${title}`);
  });

  console.log("\n=== Page sections that might indicate current season ===");
  $(".n_s, .current-season, .active-season, [data-current-season]").each((_, el) => {
    console.log(`  tag=${el.tagName} class="${$(el).attr("class")}" text="${$(el).text().trim().substring(0, 50)}"`);
  });
}
check().catch(console.error);
