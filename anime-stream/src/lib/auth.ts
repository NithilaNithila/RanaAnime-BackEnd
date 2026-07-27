const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  watchlist?: { anilistId: number; title: string; coverImage: string; addedAt: string }[];
  watchHistory?: { anilistId: number; title: string; coverImage: string; episode: number; progress: number; lastWatched: string }[];
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

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { ...authHeaders(), ...(options.headers as Record<string, string> || {}) };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  return res.json();
}
