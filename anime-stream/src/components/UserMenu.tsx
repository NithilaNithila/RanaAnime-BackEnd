"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold hover:bg-purple-500 transition-colors"
      >
        {user.avatar ? (
          <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-sm font-medium text-white truncate">{user.username}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <Link
            href="/watchlist"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            My Watchlist
          </Link>
          <Link
            href="/history"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Watch History
          </Link>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Profile
          </Link>
          <hr className="border-gray-800 my-1" />
          <button
            onClick={() => {
              setOpen(false);
              logout();
              router.push("/");
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
