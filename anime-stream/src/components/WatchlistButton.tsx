"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getAnilistId, addToWatchlist, removeFromWatchlist } from "@/lib/auth";
import { showToast } from "@/components/Toast";

export default function WatchlistButton({ title }: { title: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [anilistId, setAnilistId] = useState<number | null>(null);
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    let cancelled = false;
    getAnilistId(title)
      .then((id) => {
        if (cancelled) return;
        setAnilistId(id);
        if (id && user.watchlist?.some((w) => w.anilistId === id)) setInList(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [title, user, loading]);

  const handleToggle = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!anilistId) return;
    setBusy(true);
    try {
      if (inList) {
        await removeFromWatchlist(anilistId);
        setInList(false);
        showToast("info", "Removed from watchlist", 3000);
      } else {
        await addToWatchlist(anilistId, title);
        setInList(true);
        showToast("success", "Added to watchlist", 3000);
      }
    } catch {
      showToast("error", "Could not update watchlist", 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        inList
          ? "bg-purple-600/20 border-purple-500/50 text-purple-300 hover:bg-purple-600/30"
          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
      } disabled:opacity-50`}
    >
      {busy ? "Updating..." : inList ? "In Watchlist" : "+ Add to Watchlist"}
    </button>
  );
}
