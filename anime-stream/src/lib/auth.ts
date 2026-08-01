const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  watchlist?: WatchlistItem[];
  watchHistory?: HistoryItem[];
}

export interface WatchlistItem {
  anilistId: number;
  title: string;
  coverImage: string;
  addedAt: string;
}

export interface HistoryItem {
  anilistId: number;
  title: string;
  coverImage: string;
  season: number;
  episode: number;
  progress: number;
  lastWatched: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  message?: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function setToken(token: string) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (data.success && data.token) setToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.success && data.token) setToken(data.token);
  return data;
}

export async function getMe(): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!data.success) clearToken();
  return data;
}

export function logout() {
  clearToken();
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/user/watchlist?limit=100`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load watchlist");
  const data = await res.json();
  return data?.data || [];
}

export async function addToWatchlist(anilistId: number, title: string, coverImage?: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/user/watchlist`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ anilistId, title, coverImage: coverImage || "" }),
  });
  if (!res.ok) throw new Error("Failed to update watchlist");
}

export async function removeFromWatchlist(anilistId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/user/watchlist/${anilistId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove from watchlist");
}

export async function getHistory(): Promise<HistoryItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/user/history?limit=100`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load history");
  const data = await res.json();
  return data?.data || [];
}

export async function getContinueWatching(): Promise<HistoryItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/user/continue-watching`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load continue watching");
  const data = await res.json();
  return data?.data || [];
}

export async function updateWatchProgress(
  anilistId: number,
  title: string,
  coverImage: string,
  season: number,
  episode: number,
  progress?: number
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/user/history`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ anilistId, title, coverImage, season, episode, progress: progress || 0 }),
  });
  if (!res.ok) throw new Error("Failed to update history");
}

export async function getAnilistId(title: string): Promise<number | null> {
  const res = await fetch(`${API_BASE_URL}/api/anilist/search?q=${encodeURIComponent(title)}&perPage=1`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.id ?? null;
}
