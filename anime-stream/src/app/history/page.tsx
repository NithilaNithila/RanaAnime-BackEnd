"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getHistory, HistoryItem } from "@/lib/auth";
import { showToast } from "@/components/Toast";

function formatProgress(seconds: number) {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    getHistory()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) showToast("error", "Could not load watch history", 4000);
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  if (loading || pageLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-900 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Watch History</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📺</p>
          <p className="text-gray-400 mb-2">No watch history yet.</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
            Start watching anime
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.anilistId}-${item.season}-${item.episode}`}
              className="flex items-center gap-4 p-3 rounded-lg border border-gray-800 bg-gray-900"
            >
              <Link
                href={`/search?q=${encodeURIComponent(item.title)}`}
                className="shrink-0"
              >
                <div className="w-24 aspect-[3/4] rounded bg-gray-800 overflow-hidden">
                  {item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      🎬
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/search?q=${encodeURIComponent(item.title)}`}
                  className="block text-sm font-medium text-gray-200 hover:text-white truncate"
                >
                  {item.title}
                </Link>
                <p className="text-xs text-gray-500 mt-1">
                  S{item.season} E{item.episode} · watched at {formatProgress(item.progress)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(item.lastWatched).toLocaleString()}
                </p>
              </div>
              <Link
                href={`/search?q=${encodeURIComponent(item.title)}`}
                className="shrink-0 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
              >
                Watch
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
