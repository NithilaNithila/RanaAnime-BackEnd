const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../config");

const BASE_URL = config.animoyeBaseUrl || "https://animoye.com";
const EMBED_HOST = "https://streams.iqsmartgames.com";

const client = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": BASE_URL,
  },
});

function titleToSlugs(title) {
  let base = title
    .toLowerCase()
    .replace(/\s*\((?:TV|Movie|Special|OVA|ONA|OAD)\s*\)/gi, "")
    .replace(/['':,!?.,]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();

  const slugs = [base];

  const aliases = {
    "naruto-shippuden": ["naruto-shippuuden", "naruto"],
    "one-piece": ["onepiece"],
    "attack-on-titan": ["shingeki-no-kyojin", "attackontitan"],
    "my-hero-academia": ["boku-no-hero-academia", "bokunoheroacademia"],
    "demon-slayer": ["kimetsu-no-yaiba", "demon-slayer-kimetsu-no-yaiba", "demonslayer", "kimetsunoyaiba"],
    "one-punch-man": ["onepunchman", "one-punch-man-one"],
    "death-note": ["deathnote"],
    "fullmetal-alchemist-brotherhood": ["fullmetal-alchemist", "fma-brotherhood", "fullmetalalchemist"],
    "jujutsu-kaisen": ["jujutsukaisen"],
    "spy-x-family": ["spyxfamily", "spy-family"],
    "chainsaw-man": ["chainsawman", "chainsaw-man-chainsaw-man"],
    "solo-leveling": ["solo leveling", "na-honjaman-level-up"],
    "black-clover": ["blackclover"],
    "sword-art-online": ["swordartonline", "sao"],
    "tokyo-ghoul": ["tokyoghoul"],
    "mob-psycho-100": ["mobpsycho100", "mob-psycho-one-hundred"],
    "hunter-x-hunter": ["hunterxhunter", "hunter-x-hunter-2011"],
  };

  if (aliases[base]) {
    for (const alias of aliases[base]) {
      if (!slugs.includes(alias)) slugs.push(alias);
    }
  }

  const withoutHyphens = base.replace(/-/g, "");
  if (withoutHyphens !== base) slugs.push(withoutHyphens);

  return [...new Set(slugs)];
}

async function getDetails(slug) {
  for (const type of ["series", "anime", "movie"]) {
    try {
      const url = `${BASE_URL}/${type}/${slug}.html`;
      const { data: html } = await client.get(url);

      if (!html || html.length < 1000) continue;

      const $ = cheerio.load(html);
      const title = (
        $("h1.hero-title").text().trim() ||
        $("title").text().replace(/\s*[-|]\s*AniMoye.*$/i, "").trim()
      );
      if (!title) continue;

      const description = $("p.hero-desc").text().trim() || $(".entry-content p").first().text().trim();
      const image = $("div.hero-poster img").attr("src") || $("meta[property='og:image']").attr("content") || "";
      const scriptData = extractScriptData(html);

      if (!scriptData.tmdbId || !scriptData.streamKey) continue;

      const seasons = parseSeasonEpisodes(scriptData.seasonEpisodes);

      return {
        title,
        slug,
        type,
        description,
        image: image.startsWith("http") ? image : `${BASE_URL}${image}`,
        tmdbId: scriptData.tmdbId,
        streamKey: scriptData.streamKey,
        embedBase: scriptData.embedBase || `${EMBED_HOST}/embed/tv`,
        seasons,
        availableSeasons: scriptData.availableSeasons,
        seasonEpisodes: scriptData.seasonEpisodes,
      };
    } catch { continue; }
  }
  return null;
}

function extractScriptData(html) {
  const result = { tmdbId: null, streamKey: null, embedBase: null, seasonEpisodes: {}, availableSeasons: [] };

  const scriptMatch = html.match(/<script[^>]*>\s*(const\s+SEASON_EPISODES\s*=.*?const\s+mtype\s*=\s*"[^"]*"\s*;)\s*<\/script>/s);
  if (!scriptMatch) return result;
  const script = scriptMatch[1];

  const tmdbMatch = script.match(/const\s+TMDB_ID\s*=\s*(\d+)/);
  if (tmdbMatch) result.tmdbId = parseInt(tmdbMatch[1], 10);

  const keyMatch = script.match(/const\s+STREAM_KEY\s*=\s*"([^"]+)"/);
  if (keyMatch) result.streamKey = keyMatch[1];

  const embedMatch = script.match(/const\s+EMBED_BASE\s*=\s*"([^"]+)"/);
  if (embedMatch) result.embedBase = embedMatch[1].replace(/\\\//g, "/");

  const seasonsMatch = script.match(/const\s+AVAILABLE_SEASONS\s*=\s*(\[[^\]]+\])/);
  if (seasonsMatch) {
    try { result.availableSeasons = JSON.parse(seasonsMatch[1]); } catch {}
  }

  const epMatch = script.match(/const\s+SEASON_EPISODES\s*=\s*(\[[\s\S]+?\]);/) ||
                  script.match(/const\s+SEASON_EPISODES\s*=\s*(\{[\s\S]+?\});/);
  if (epMatch) {
    try { result.seasonEpisodes = JSON.parse(epMatch[1]); } catch {}
  }

  if (!result.availableSeasons.length && result.seasonEpisodes) {
    if (Array.isArray(result.seasonEpisodes)) {
      result.availableSeasons = result.seasonEpisodes.map((_, i) => i + 1);
    } else {
      result.availableSeasons = Object.keys(result.seasonEpisodes).map(Number);
    }
  }

  return result;
}

function parseSeasonEpisodes(episodesObj) {
  const seasons = [];

  if (Array.isArray(episodesObj)) {
    episodesObj.forEach((episodes, idx) => {
      const epList = Array.isArray(episodes) ? episodes : [];
      seasons.push({
        seasonNumber: idx + 1,
        episodeCount: epList.length,
        episodes: epList.map(ep => typeof ep === "number" ? ep : parseInt(ep, 10)).filter(n => !isNaN(n)),
      });
    });
  } else if (episodesObj && typeof episodesObj === "object") {
    for (const [seasonNum, episodes] of Object.entries(episodesObj)) {
      const epList = Array.isArray(episodes) ? episodes : [];
      seasons.push({
        seasonNumber: parseInt(seasonNum, 10),
        episodeCount: epList.length,
        episodes: epList.map(ep => typeof ep === "number" ? ep : parseInt(ep, 10)).filter(n => !isNaN(n)),
      });
    }
  }

  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  return seasons;
}

async function search(title) {
  const slugs = titleToSlugs(title);
  for (const slug of slugs) {
    const details = await getDetails(slug);
    if (details) return [{ title: details.title, slug: details.slug, url: `${BASE_URL}/${details.type}/${details.slug}.html` }];
  }
  return [];
}

async function getStream(title, episode, language, season) {
  try {
    const slugs = titleToSlugs(title);
    let details = null;

    for (const slug of slugs) {
      details = await getDetails(slug);
      if (details) break;
    }

    if (!details) return { success: false, reason: `Anime "${title}" not found on AniMoye` };

    const targetSeason = season || (() => {
      for (const s of details.seasons) {
        let epList;
        if (Array.isArray(details.seasonEpisodes)) {
          epList = details.seasonEpisodes[s.seasonNumber - 1] || [];
        } else {
          epList = details.seasonEpisodes[String(s.seasonNumber)] || [];
        }
        if (epList.includes(episode)) return s.seasonNumber;
      }
      return 1;
    })();

    let seasonData = [];
    if (Array.isArray(details.seasonEpisodes)) {
      seasonData = details.seasonEpisodes[targetSeason - 1] || [];
    } else {
      seasonData = details.seasonEpisodes[String(targetSeason)] || [];
    }

    if (!seasonData.length) {
      const available = details.availableSeasons.length
        ? details.availableSeasons.join(", ")
        : details.seasons.map(s => s.seasonNumber).join(", ");
      return { success: false, reason: `Season ${targetSeason} not available on AniMoye (available: ${available})` };
    }

    const epInSeason = seasonData.indexOf(episode);
    if (epInSeason === -1) {
      return { success: false, reason: `Episode ${episode} not found in Season ${targetSeason} on AniMoye` };
    }

    if (!details.tmdbId || !details.streamKey) {
      return { success: false, reason: "AniMoye: missing stream data (tmdbId or streamKey)" };
    }
    if (!details.embedBase) {
      return { success: false, reason: "AniMoye: missing embed base URL" };
    }

    const embedUrl = `${details.embedBase}/${details.tmdbId}/${targetSeason}/${episode}?key=${details.streamKey}`;

    return {
      success: true,
      source: "animoye",
      language,
      embedUrl,
      slug: details.slug,
      episode,
      season: targetSeason,
      title: details.title,
      image: details.image,
      seasons: details.seasons,
    };
  } catch (err) {
    return { success: false, reason: `AniMoye error: ${err.message}` };
  }
}

async function isAvailable() {
  try { const { status } = await client.get(BASE_URL, { timeout: 8000 }); return status === 200; }
  catch { return false; }
}

module.exports = { getStream, isAvailable, search, getDetails };
