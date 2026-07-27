"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStreamForSource } from "@/lib/api";
import { StreamSourceOption } from "@/types";
import { showToast } from "./Toast";

const SOURCE_NAMES: Record<string, string> = {
  "123anime": "123Anime",
  anipub: "Anipub",
  watchanimeworld: "WatchAnimeWorld",
};

const SOURCE_ORDER = ["watchanimeworld", "123anime", "anipub"];

function getFriendlyName(sourceId: string): string {
  return SOURCE_NAMES[sourceId] || sourceId;
}

export default function VideoPlayer({
  initialSources,
  title,
  animeTitle,
  season,
  episode,
}: {
  initialSources: StreamSourceOption[];
  title: string;
  animeTitle: string;
  season?: number;
  episode?: number;
}) {
  const [activeUrl, setActiveUrl] = useState("");
  const [activeSource, setActiveSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadIdRef = useRef(0);

  const displayedSources = useMemo(() => {
    const map = new Map<string, StreamSourceOption>();
    for (const s of initialSources) map.set(s.id, s);
    for (const id of SOURCE_ORDER) {
      if (!map.has(id)) map.set(id, { id, name: getFriendlyName(id) });
    }
    return SOURCE_ORDER.filter((id) => map.has(id)).map((id) => map.get(id)!);
  }, [initialSources]);

  const loadStream = useCallback(
    async (sourceId: string) => {
      const myId = ++loadIdRef.current;
      setLoading(true);
      setError(null);
      setActiveUrl("");

      try {
        const stream = await getStreamForSource(animeTitle, episode, sourceId, season);
        if (myId !== loadIdRef.current) return;
        setActiveUrl(stream.url);
        setActiveSource(sourceId);
        setError(null);
      } catch (err) {
        if (myId !== loadIdRef.current) return;
        const msg = err instanceof Error ? err.message : `${getFriendlyName(sourceId)} is not available. Try another server.`;
        setError(msg);
        showToast("error", msg, 6000);
      } finally {
        if (myId === loadIdRef.current) setLoading(false);
      }
    },
    [animeTitle, episode, season]
  );

  useEffect(() => {
    if (!displayedSources.length) return;
    const preferred = SOURCE_ORDER.find((id) => displayedSources.some((s) => s.id === id)) || displayedSources[0]?.id;
    if (!preferred) return;
    loadStream(preferred);
    return () => { loadIdRef.current++; };
  }, [displayedSources, loadStream]);

  if (!initialSources.length) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center border border-gray-800">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No streams available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-video bg-black rounded-lg overflow-hidden border border-gray-800">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading stream...
            </div>
          </div>
        ) : activeUrl ? (
          <iframe
            src={activeUrl}
            title={title}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Select a server to start streaming
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {displayedSources.map((source) => (
          <button
            key={source.id}
            onClick={() => void loadStream(source.id)}
            disabled={loading}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all disabled:opacity-50 ${
              source.id === activeSource && !loading
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {source.name}
          </button>
        ))}
      </div>
    </div>
  );
}
