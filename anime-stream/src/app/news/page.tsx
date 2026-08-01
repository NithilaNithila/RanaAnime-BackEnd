"use client";

import { useEffect, useState } from "react";
import { NewsArticle } from "@/types";
import { getNews } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

const SOURCES = [
  { key: "all", label: "All" },
  { key: "ann", label: "Anime News Network", color: "#0ea5e9" },
  { key: "crunchyroll", label: "Crunchyroll", color: "#f97316" },
  { key: "animecorner", label: "Anime Corner", color: "#a855f7" },
  { key: "animeherald", label: "Anime Herald", color: "#10b981" },
];

const SOURCE_COLORS: Record<string, [string, string]> = {
  "Anime News Network": ["#0ea5e9", "#0284c7"],
  Crunchyroll: ["#f97316", "#ea580c"],
  "Anime Corner": ["#a855f7", "#9333ea"],
  "Anime Herald": ["#10b981", "#059669"],
};

function ArticleCard({ article }: { article: NewsArticle }) {
  const colors = SOURCE_COLORS[article.source] || ["#0ea5e9", "#0284c7"];
  const [imgError, setImgError] = useState(false);

  const imgSrc = article.image?.startsWith("data:")
    ? article.image
    : article.image
      ? `${API_BASE_URL}/api/news/image?url=${encodeURIComponent(article.image)}`
      : null;

  return (
    <a
      href={article.originalSource || article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-all duration-300 hover:scale-[1.02]"
    >
      <div className="aspect-[16/9] relative overflow-hidden bg-gray-800">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
          >
            <span className="text-white/20 text-6xl font-bold">NEWS</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <span
          className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded text-white backdrop-blur"
          style={{ background: colors[0] }}
        >
          {article.source}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-purple-400 transition-colors">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {article.date
              ? new Date(article.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Unknown date"}
          </span>
          <span className="text-purple-400 group-hover:text-purple-300 transition-colors">
            Read more →
          </span>
        </div>
      </div>
    </a>
  );
}

export default function NewsPage() {
  const [activeSource, setActiveSource] = useState("all");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [meta, setMeta] = useState({ total: 0, hasMore: false });
  const [loadedSource, setLoadedSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const source = activeSource === "all" ? undefined : activeSource;
    getNews(source, 50)
      .then((result) => {
        if (cancelled) return;
        setArticles(result.articles);
        setMeta(result.meta);
        setLoadedSource(activeSource);
      })
      .catch(() => {
        if (!cancelled) setLoadedSource(activeSource);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSource]);

  const loading = loadedSource !== activeSource;

  const sourceLabel =
    SOURCES.find((s) => s.key === activeSource)?.label || "News";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Anime <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">News</span>
        </h1>
        <p className="text-gray-400">Latest anime news from around the web</p>
      </div>

      {/* Source Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {SOURCES.map((source) => (
          <button
            key={source.key}
            onClick={() => setActiveSource(source.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeSource === source.key
                ? "bg-gray-800 text-white border border-gray-700 shadow-lg"
                : "bg-gray-900/50 text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-gray-200"
            }`}
          >
            {source.key !== "all" && (
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ background: source.color }}
              />
            )}
            {source.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Articles Grid */}
      {!loading && (
        <>
          {articles.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-5xl mb-4">📰</p>
              <p className="text-lg">No news articles found for {sourceLabel}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {articles.map((article) => (
                <ArticleCard key={article.slug + article.source} article={article} />
              ))}
            </div>
          )}

          {meta.total > 0 && (
            <p className="text-center text-sm text-gray-600 mt-8">
              Showing {articles.length} of {meta.total} articles
            </p>
          )}
        </>
      )}
    </div>
  );
}
