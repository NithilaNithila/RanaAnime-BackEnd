import { searchAnime } from "@/lib/api";
import AnimeCard from "@/components/AnimeCard";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const results = query ? await searchAnime(query) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">
        {query ? (
          <>
            Results for{" "}
            <span className="text-purple-400">&quot;{query}&quot;</span>
          </>
        ) : (
          "Search Anime"
        )}
      </h1>

      {!query && (
        <p className="text-gray-500 mb-8">
          Use the search bar above to find anime.
        </p>
      )}

      {query && results.length === 0 && (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">🔍</p>
          <p className="text-gray-400 text-lg">
            No results found for &quot;{query}&quot;
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Try a different search term
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {results.map((item) => (
            <AnimeCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
