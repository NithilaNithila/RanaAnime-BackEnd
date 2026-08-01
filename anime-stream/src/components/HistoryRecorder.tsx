"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAnilistId, updateWatchProgress } from "@/lib/auth";

export default function HistoryRecorder({
  title,
  coverImage,
  season,
  episode,
}: {
  title: string;
  coverImage?: string;
  season?: number;
  episode?: number;
}) {
  const { user, loading } = useAuth();
  const recorded = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (recorded.current) return;
    if (season === undefined || episode === undefined) return;
    recorded.current = true;
    getAnilistId(title)
      .then((id) => {
        if (!id) return;
        return updateWatchProgress(id, title, coverImage || "", season, episode, 0);
      })
      .catch(() => {});
  }, [title, coverImage, season, episode, user, loading]);

  return null;
}
