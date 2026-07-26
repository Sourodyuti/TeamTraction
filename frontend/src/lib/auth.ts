/**
 * Auth API client — wraps /auth/* endpoints.
 * Stores JWT in localStorage under "legilimens_token".
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "legilimens_token";
const USER_KEY  = "legilimens_user";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: "teacher" | "student";
  full_name?: string;
  created_at: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

// ─── Token helpers ──────────────────────────────────────────────

export function saveAuth(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function loadAuth(): AuthState {
  if (typeof window === "undefined") return { user: null, token: null };
  const token = localStorage.getItem(TOKEN_KEY);
  const raw   = localStorage.getItem(USER_KEY);
  const user  = raw ? (JSON.parse(raw) as AuthUser) : null;
  return { token, user };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

// ─── API calls ──────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  role: "teacher" | "student";
  full_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function apiRegister(payload: RegisterPayload): Promise<AuthUser> {
  const data = await authPost<TokenResponse>("/auth/register", payload);
  saveAuth(data.access_token, data.user);
  return data.user;
}

export async function apiLogin(payload: LoginPayload): Promise<AuthUser> {
  const data = await authPost<TokenResponse>("/auth/login", payload);
  saveAuth(data.access_token, data.user);
  return data.user;
}

export async function apiMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null; // don't clearAuth — keep cached user for offline/demo
    return res.json() as Promise<AuthUser>;
  } catch {
    return null;
  }
}

export async function apiLogout(): Promise<void> {
  const token = getToken();
  if (token) {
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearAuth();
}
