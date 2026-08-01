import { getCatalog } from "@/lib/api";
import AnimeCard from "@/components/AnimeCard";
import ContinueWatching from "@/components/ContinueWatching";
import Link from "next/link";

const CATALOGS = [
  { key: "newest drops", label: "🔥 Newest Drops", slug: "newest-drops" },
  { key: "most-watched shows", label: "📈 Most Watched Shows", slug: "most-watched" },
  { key: "new anime arrivals", label: "✨ New Arrivals", slug: "new-arrivals" },
  { key: "most-watched films", label: "🎬 Popular Films", slug: "popular-films" },
  { key: "latest anime movies", label: "🎥 Latest Movies", slug: "latest-movies" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>;
}) {
  const params = await searchParams;
  const catalogKey = params.catalog;

  if (catalogKey) {
    const catalog = CATALOGS.find((c) => c.slug === catalogKey);
    const items = catalog ? await getCatalog(catalog.key) : [];

    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{catalog?.label || "Catalog"}</h1>
          <Link
            href="/"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">📭</p>
            <p className="text-gray-400">No items found in this catalog yet.</p>
            <p className="text-gray-600 text-sm mt-2">Try another catalog</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <AnimeCard key={item.slug} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const catalogsData = await Promise.all(
    CATALOGS.map((c) => getCatalog(c.key))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Hero Section */}
      <section className="mb-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/40 via-gray-900 to-pink-900/30 border border-gray-800 p-8 md:p-12">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-bold mb-3">
              Watch Anime
              <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                {" "}Online
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mb-6">
              Stream your favorite anime for free.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/?catalog=newest-drops"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
              >
                Browse Anime
              </Link>
              <Link
                href="/search"
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors border border-gray-700"
              >
                Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Continue Watching */}
      <ContinueWatching />

      {/* Catalog Sections */}
      {CATALOGS.map((catalog, i) => {
        const items = catalogsData[i];
        if (!items.length) return null;
        return (
          <section key={catalog.slug} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{catalog.label}</h2>
              <Link
                href={`/?catalog=${catalog.slug}`}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.slice(0, 10).map((item) => (
                <AnimeCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
