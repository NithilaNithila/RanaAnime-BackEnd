import { getAvailableStreamSources, getAnimeDetails } from "@/lib/api";
import VideoPlayer from "@/components/VideoPlayer";
import HistoryRecorder from "@/components/HistoryRecorder";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const animeSlug = slug[0];
  const season = slug[1] ? parseInt(slug[1]) : undefined;
  const episode = slug[2] ? parseInt(slug[2]) : undefined;

  if (!animeSlug) notFound();

  const [sources, details] = await Promise.all([
    getAvailableStreamSources(),
    getAnimeDetails(animeSlug),
  ]);

  const epLabel =
    season !== undefined && episode !== undefined
      ? `S${season} E${episode}`
      : "Movie";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 flex-wrap">
        <Link href="/" className="hover:text-white transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/anime/${animeSlug}`}
          className="hover:text-white transition-colors truncate max-w-[200px]"
        >
          {details?.title || animeSlug}
        </Link>
        <span>/</span>
        <span className="text-white">{epLabel}</span>
      </div>

      {/* Player */}
      <VideoPlayer
        initialSources={sources}
        animeTitle={details?.title || animeSlug}
        season={season}
        episode={episode}
        title={`${details?.title || animeSlug} - ${epLabel}`}
      />
      <HistoryRecorder
        title={details?.title || animeSlug}
        coverImage={details?.poster ?? undefined}
        season={season}
        episode={episode}
      />

      {/* Info */}
      <div className="mt-6">
        <h1 className="text-xl font-bold mb-1">
          {details?.title || animeSlug}
        </h1>
        <p className="text-gray-500 text-sm mb-4">{epLabel}</p>

        {details?.description && (
          <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
            {details.description}
          </p>
        )}
      </div>

      {/* Episode Navigation */}
      {details && details.episodes.length > 1 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3">More Episodes</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {details.episodes.map((ep) => {
              const isActive =
                ep.season === season && ep.episode === episode;
              return (
                <Link
                  key={`${ep.season}-${ep.episode}`}
                  href={`/watch/${animeSlug}/${ep.season}/${ep.episode}`}
                  className={`px-3 py-2 text-xs rounded-lg text-center transition-all ${
                    isActive
                      ? "bg-purple-600 text-white"
                      : "bg-gray-900 text-gray-400 border border-gray-800 hover:border-purple-500/50 hover:text-white"
                  }`}
                >
                  S{ep.season} E{ep.episode}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
