"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { getContinueWatching, HistoryItem } from "@/lib/auth";

function formatProgress(seconds: number) {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ContinueWatching() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    let cancelled = false;
    getContinueWatching()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (loading || !user || items.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-4">Continue Watching</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
        {items.map((item) => (
          <Link
            key={`${item.anilistId}-${item.season}-${item.episode}`}
            href={`/search?q=${encodeURIComponent(item.title)}`}
            className="w-36 shrink-0 group"
          >
            <div className="aspect-[3/4] rounded-xl overflow-hidden border border-gray-800 bg-gray-900 group-hover:border-purple-500/50 transition-colors">
              {item.coverImage ? (
                <img
                  src={item.coverImage}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  🎬
                </div>
              )}
            </div>
            <p className="mt-2 text-xs font-medium text-gray-200 truncate group-hover:text-white">
              {item.title}
            </p>
            <p className="text-xs text-gray-500">
              S{item.season} E{item.episode} · {formatProgress(item.progress)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
