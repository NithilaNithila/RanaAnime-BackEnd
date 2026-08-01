"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getWatchlist, removeFromWatchlist, WatchlistItem } from "@/lib/auth";
import { showToast } from "@/components/Toast";

export default function WatchlistPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    getWatchlist()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  const handleRemove = async (anilistId: number) => {
    try {
      await removeFromWatchlist(anilistId);
      setItems((prev) => prev.filter((i) => i.anilistId !== anilistId));
      showToast("info", "Removed from watchlist", 3000);
    } catch {
      showToast("error", "Could not remove item", 4000);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-gray-900 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">My Watchlist</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-gray-400 mb-2">Your watchlist is empty.</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
            Browse anime to add some
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.anilistId}
              className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden group"
            >
              <Link href={`/search?q=${encodeURIComponent(item.title)}`} className="block">
                <div className="aspect-[3/4] bg-gray-800 overflow-hidden">
                  {item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      🎬
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3">
                <Link
                  href={`/search?q=${encodeURIComponent(item.title)}`}
                  className="block text-sm font-medium text-gray-200 hover:text-white truncate"
                >
                  {item.title}
                </Link>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(item.addedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRemove(item.anilistId)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
