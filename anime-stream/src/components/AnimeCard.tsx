import Link from "next/link";
import { AnimeItem } from "@/types";

export default function AnimeCard({ item }: { item: AnimeItem }) {
  return (
    <Link
      href={`/anime/${item.slug}`}
      className="group relative block overflow-hidden rounded-lg bg-gray-900 border border-gray-800 hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.02]"
    >
      <div className="aspect-[3/4] relative overflow-hidden">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center text-4xl">
            🎬
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <span className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded bg-purple-600/90 text-white backdrop-blur">
          {item.type === "movie" ? "Movie" : "Series"}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate group-hover:text-purple-400 transition-colors">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}
