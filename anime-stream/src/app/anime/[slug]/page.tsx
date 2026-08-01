import { getAnimeDetails } from "@/lib/api";
import Link from "next/link";
import { notFound } from "next/navigation";
import WatchlistButton from "@/components/WatchlistButton";

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const anime = await getAnimeDetails(slug);
  if (!anime) notFound();

  const grouped = anime.episodes.reduce(
    (acc, ep) => {
      if (!acc[ep.season]) acc[ep.season] = [];
      acc[ep.season].push(ep);
      return acc;
    },
    {} as Record<number, typeof anime.episodes>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        ← Back to Home
      </Link>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Poster */}
        <div className="w-full md:w-72 shrink-0">
          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-gray-800 bg-gray-900">
            {anime.poster ? (
              <img
                src={anime.poster}
                alt={anime.title || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">
                🎬
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-3 flex-wrap">
            <h1 className="text-3xl font-bold">{anime.title}</h1>
            {anime.title ? <WatchlistButton title={anime.title} /> : null}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 text-xs rounded-full bg-purple-600/20 text-purple-400 border border-purple-600/30">
              {anime.type === "movie" ? "Movie" : "Series"}
            </span>
            {anime.year && (
              <span className="px-3 py-1 text-xs rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                {anime.year}
              </span>
            )}
            {anime.runtime && (
              <span className="px-3 py-1 text-xs rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                {anime.runtime}
              </span>
            )}
          </div>

          {anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {anime.genres.map((g) => (
                <span
                  key={g}
                  className="px-2 py-1 text-xs rounded bg-gray-800/50 text-gray-500"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {anime.description && (
            <p className="text-gray-400 leading-relaxed mb-6">
              {anime.description}
            </p>
          )}

          <p className="text-sm text-gray-500 mb-2">
            {anime.episodes.length} episode{anime.episodes.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      {/* Episodes */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Episodes</h2>

        {Object.keys(grouped).length > 1 ? (
          Object.entries(grouped).map(([season, eps]) => (
            <div key={season} className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                Season {season}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {eps.map((ep) => (
                  <Link
                    key={`${ep.season}-${ep.episode}`}
                    href={`/watch/${anime.slug}/${ep.season}/${ep.episode}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-800 transition-all group"
                  >
                    {ep.thumbnail ? (
                      <img
                        src={ep.thumbnail}
                        alt=""
                        className="w-20 h-12 object-cover rounded shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-20 h-12 bg-gray-800 rounded shrink-0 flex items-center justify-center text-lg">
                        ▶
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-purple-400 transition-colors">
                        S{ep.season} E{ep.episode}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {ep.title}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {anime.episodes.map((ep) => (
              <Link
                key={`${ep.season}-${ep.episode}`}
                href={`/watch/${anime.slug}/${ep.season}/${ep.episode}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-800 transition-all group"
              >
                {ep.thumbnail ? (
                  <img
                    src={ep.thumbnail}
                    alt=""
                    className="w-20 h-12 object-cover rounded shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-20 h-12 bg-gray-800 rounded shrink-0 flex items-center justify-center text-lg">
                    ▶
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-purple-400 transition-colors">
                    {ep.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    Episode {ep.episode}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
