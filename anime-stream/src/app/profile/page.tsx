"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="h-64 rounded-xl bg-gray-900 animate-pulse" />
      </div>
    );
  }

  if (!user) return null;

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-white">{user.username}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/watchlist"
            className="rounded-lg border border-gray-800 bg-gray-800/50 p-4 hover:border-purple-500/50 transition-colors"
          >
            <p className="text-2xl font-bold text-purple-400">
              {user.watchlist?.length || 0}
            </p>
            <p className="text-sm text-gray-400 mt-1">Watchlist</p>
          </Link>
          <Link
            href="/history"
            className="rounded-lg border border-gray-800 bg-gray-800/50 p-4 hover:border-purple-500/50 transition-colors"
          >
            <p className="text-2xl font-bold text-purple-400">
              {user.watchHistory?.length || 0}
            </p>
            <p className="text-sm text-gray-400 mt-1">Watch History</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
