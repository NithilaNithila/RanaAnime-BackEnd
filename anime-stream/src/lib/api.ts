import * as cheerio from "cheerio";
import { AnimeItem, AnimeDetails, Episode, Stream, StreamResponse, StreamSourceOption } from "@/types";

const BASE_URL = "https://watchanimeworld.org";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const TIMEOUT = 15000;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUA(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseItems($: cheerio.CheerioAPI, selector: string): AnimeItem[] {
  const items: AnimeItem[] = [];
  $(selector).each((_, el) => {
    const $el = $(el);
    const link = $el.find("a.lnk-blk").attr("href") || "";
    const img = $el.find("img").attr("src") || $el.find("img").attr("data-original") || "";
    const title = $el.find("h2.entry-title").text().trim() || $el.find("img").attr("alt")?.replace("Image ", "").trim() || "";
    if (!link || !title) return;
    const slug = link.replace(/\/+$/, "").split("/").pop() || "";
    const type = link.includes("/movies/") ? "movie" : "series";
    items.push({
      title,
      slug,
      poster: img ? (img.startsWith("//") ? "https:" + img : img) : null,
      type,
    });
  });
  return items;
}

export async function getCatalog(section: string): Promise<AnimeItem[]> {
  try {
    const html = await fetchPage(BASE_URL);
    const $ = cheerio.load(html);
    const items: AnimeItem[] = [];

    $("section.widget_list_episodes, section.widget_list_movies_series").each(
      (_, sec) => {
        const title = $(sec).find("h3.section-title").text().trim();
        if (title.toLowerCase().includes(section.toLowerCase())) {
          $(sec).find(".swiper-slide").each((_, slide) => {
            const article = $(slide).find("article");
            if (!article.length) return;
            const link = article.find("a.lnk-blk").attr("href") || "";
            const img =
              article.find("img").attr("src") ||
              article.find("img").attr("data-original") ||
              "";
            const t =
              article.find("h2.entry-title").text().trim() ||
              article.find("img").attr("alt")?.replace("Image ", "").trim() ||
              "";
            if (!link || !t) return;
            const slug = link.replace(/\/+$/, "").split("/").pop() || "";
            const type = link.includes("/movies/") ? "movie" : "series";
            items.push({
              title: t,
              slug,
              poster: img
                ? img.startsWith("//")
                  ? "https:" + img
                  : img
                : null,
              type,
            });
          });
        }
      }
    );

    $("section.widget_top").each((_, sec) => {
      const title = $(sec).find("h3.widget-title").text().trim();
      if (title.toLowerCase().includes(section.toLowerCase())) {
        $(sec).find(".top-picks__item").each((_, item) => {
          const link = $(item).find("a.lnk-blk").attr("href") || "";
          const img = $(item).find("img").attr("src") || "";
          const alt =
            $(item).find("img").attr("alt")?.replace("Image ", "").trim() || "";
          if (!link || !alt) return;
          const slug = link.replace(/\/+$/, "").split("/").pop() || "";
          const type = link.includes("/movies/") ? "movie" : "series";
          items.push({
            title: alt,
            slug,
            poster: img
              ? img.startsWith("//")
                ? "https:" + img
                : img
              : null,
            type,
          });
        });
      }
    });

    return items;
  } catch (e) {
    console.error("getCatalog error:", e);
    return [];
  }
}

export async function searchAnime(query: string): Promise<AnimeItem[]> {
  try {
    const html = await fetchPage(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const items: AnimeItem[] = [];

    $("#aa-movies ul.post-lst > li").each((_, li) => {
      const article = $(li).find("article");
      if (!article.length) return;
      const link = article.find("a.lnk-blk").attr("href") || "";
      const img = article.find("img").attr("src") || "";
      const title = article.find("h2.entry-title").text().trim();
      if (!link || !title) return;
      const slug = link.replace(/\/+$/, "").split("/").pop() || "";
      const type = link.includes("/movies/") ? "movie" : "series";
      items.push({
        title,
        slug,
        poster: img ? (img.startsWith("//") ? "https:" + img : img) : null,
        type,
      });
    });

    return items;
  } catch (e) {
    console.error("searchAnime error:", e);
    return [];
  }
}

function parseEpisodes($: cheerio.CheerioAPI): Episode[] {
  const episodes: Episode[] = [];
  const items = $("#episode_by_temp > li").length
    ? $("#episode_by_temp > li")
    : $("li:has(article.episodes), li:has(a[href*='episode']), .eplister ul li, .post-lst > li");
  let perSeasonIndex = 1;
  items.each((_, li) => {
    const $li = $(li);
    const link = $li.find("a.lnk-blk").attr("href") || $li.find("a").first().attr("href") || "";
    if (!link || link.includes("javascript:")) return;

    const numEpi = $li.find("span.num-epi").text().trim();
    const titleEl = $li.find("h2.entry-title, .entry-title").first().text().trim();
    const img = $li.find("img").attr("src") || "";
    const epLabel = numEpi || titleEl;

    let season = 1;
    let episode = perSeasonIndex++;

    const multiMatch = epLabel.match(/(\d+)[xX](\d+)/);
    if (multiMatch) {
      season = parseInt(multiMatch[1], 10);
      episode = parseInt(multiMatch[2], 10);
    } else {
      const epNumMatch = epLabel.match(/episode\s*(\d+)/i) || epLabel.match(/(\d+)/);
      if (epNumMatch) {
        episode = parseInt(epNumMatch[1], 10);
      }
    }

    const epTitle = titleEl || epLabel || `S${season} E${episode}`;
    const thumbnail = img ? (img.startsWith("//") ? "https:" + img : img) : undefined;

    episodes.push({
      season,
      episode,
      title: epTitle,
      url: link,
      ...(thumbnail ? { thumbnail } : {}),
    });
  });
  return episodes;
}

export async function getAnimeDetails(slug: string): Promise<AnimeDetails | null> {
  try {
    const apiRes = await fetch(`${API_BASE_URL}/api/anime/details?slug=${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (apiRes.ok) {
      const payload = await apiRes.json();
      if (payload?.success && payload?.data?.title) {
        const d = payload.data;
        const episodes: Episode[] = (d.episodes || []).map((ep: any) => ({
          season: ep.season,
          episode: ep.episode,
          title: ep.title || `S${ep.season} E${ep.episode}`,
          url: ep.url,
          thumbnail: ep.thumbnail || undefined,
        }));
        return {
          title: d.title,
          slug: d.slug || slug,
          description: d.description || null,
          poster: d.poster ? (d.poster.startsWith("//") ? "https:" + d.poster : d.poster) : null,
          genres: d.genres || [],
          year: d.year || null,
          runtime: d.runtime || null,
          episodes,
          type: d.type || "series",
        };
      }
    }
  } catch {}

  for (const contentType of ["series", "movies"]) {
    try {
      const html = await fetchPage(`${BASE_URL}/${contentType}/${slug}`);
      const $ = cheerio.load(html);
      const title = $(".entry-title, h1.entry-title").first().text().trim();
      if (!title) continue;
      const description = $(".description p").first().text().trim();
      const poster = $("article.post img").attr("src") || "";
      const genres = $(".genres a")
        .map((_, el) => $(el).text().trim())
        .get();
      const year = $(".year .overviewCss").text().trim() || null;
      const runtime = $(".duration .overviewCss").text().trim() || null;

      let episodes: Episode[] = [];
      if (contentType === "series") {
        episodes = parseEpisodes($);

        const seasonLinks = $(".choose-season .sel-temp a");
        if (seasonLinks.length > 1) {
          const postId = seasonLinks.first().attr("data-post");
          const currentSeason = parseInt($(".n_s").text().trim()) || 1;
          for (let i = 0; i < seasonLinks.length; i++) {
            const sNum = parseInt($(seasonLinks[i]).attr("data-season") || "0");
            if (sNum !== currentSeason && postId) {
              try {
                const ajaxRes = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest",
                  },
                  body: new URLSearchParams({
                    action: "action_select_season",
                    season: String(sNum),
                    post: postId,
                  }).toString(),
                  signal: AbortSignal.timeout(TIMEOUT),
                });
                const ajaxHtml = await ajaxRes.text();
                const $ajax = cheerio.load(ajaxHtml);
                episodes.push(...parseEpisodes($ajax));
              } catch {}
            }
          }
        }
        episodes.sort((a, b) =>
          a.season === b.season ? a.episode - b.episode : a.season - b.season
        );
      } else {
        episodes.push({
          season: 1,
          episode: 1,
          title: title,
          url: `${BASE_URL}/movies/${slug}`,
        });
      }

      return {
        title,
        slug,
        description: description || null,
        poster: poster ? (poster.startsWith("//") ? "https:" + poster : poster) : null,
        genres,
        year,
        runtime,
        episodes,
        type: contentType === "movies" ? "movie" : "series",
      };
    } catch {
      continue;
    }
  }
  return null;
}

function ensureWatchAnimeWorldSource(sources: StreamSourceOption[]) {
  return sources;
}

export async function getAvailableStreamSources(): Promise<StreamSourceOption[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/stream/sources`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const sources = (payload?.sources || [])
      .filter((source: { status?: string }) => source.status !== "inactive")
      .map((source: { id: string; name: string }) => ({
        id: source.id,
        name: source.name,
      }));
    return ensureWatchAnimeWorldSource(sources);
  } catch {
    return [
      { id: "123anime", name: "123Anime" },
      { id: "anipub", name: "Anipub" },
      { id: "watchanimeworld", name: "WatchAnimeWorld" },
    ];
  }
}

export async function getStreamForSource(
  title: string,
  episode: number | undefined,
  source: string,
  season?: number
): Promise<Stream> {
  const url = new URL(`${API_BASE_URL}/api/stream`);
  url.searchParams.set("title", title);
  if (episode !== undefined) url.searchParams.set("episode", String(episode));
  if (season !== undefined) url.searchParams.set("season", String(season));
  url.searchParams.set("source", source);

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const sourceName =
      source === "123anime" ? "123Anime" :
      source === "anipub" ? "Anipub" :
      source === "watchanimeworld" ? "WatchAnimeWorld" : source;

    const errMsg = payload?.message || `${sourceName} is not available for this episode. Try another server.`;
    const err = new Error(errMsg);
    (err as any).sourceErrors = payload?.sourceErrors || [];
    (err as any).attemptedSources = payload?.attemptedSources || [];
    throw err;
  }

  const embedUrl = payload?.data?.embedProxyUrl || payload?.data?.embedUrl;
  if (!embedUrl) {
    const sourceName =
      source === "123anime" ? "123Anime" :
      source === "anipub" ? "Anipub" :
      source === "watchanimeworld" ? "WatchAnimeWorld" : source;
    throw new Error(`${sourceName} returned no playable link. Try another server.`);
  }

  return {
    source,
    player: payload?.data?.source || source,
    url: embedUrl,
  };
}

export async function getStreams(
  slug: string,
  season?: number,
  episode?: number
): Promise<StreamResponse> {
  let url: string;
  if (season !== undefined && episode !== undefined) {
    url = `${BASE_URL}/episode/${slug}-${season}x${episode}/`;
  } else {
    url = `${BASE_URL}/movies/${slug}`;
  }

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const streams: { player: string; url: string }[] = [];

    $("iframe").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src) {
        const fullUrl = src.startsWith("http") ? src : BASE_URL + src;
        const player = src.includes("zephyrflick")
          ? "zephyrflick"
          : src.includes("speedostream")
          ? "speedostream"
          : src.includes("movembed")
          ? "movembed"
          : "default";
        streams.push({ player, url: fullUrl });
      }
    });

    return { streams };
  } catch (e) {
    console.error("getStreams error:", e);
    return { streams: [] };
  }
}
