"use client";

/**
 * useAuth — global auth state hook.
 *
 * Reads from localStorage on mount, exposes login/register/logout,
 * and provides a redirect helper so protected routes can bounce
 * unauthenticated users to /login.
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  type AuthUser,
  loadAuth,
  clearAuth,
  apiLogin,
  apiRegister,
  apiLogout,
  apiMe,
  type LoginPayload,
  type RegisterPayload,
} from "@/lib/auth";

export function useAuth() {
  const router = useRouter();
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const { user: cached, token } = loadAuth();
    if (cached && token) {
      setUser(cached);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setError(null);
    setLoading(true);
    try {
      const u = await apiLogin(payload);
      setUser(u);
      return u;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    setLoading(true);
    try {
      const u = await apiRegister(payload);
      setUser(u);
      return u;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearAuth();
    setUser(null);
    router.push("/login");
  }, [router]);

  /** Call in a protected page — bounces to /login if not authed. */
  const requireAuth = useCallback(
    (requiredRole?: "teacher" | "student") => {
      if (loading) return; // wait for rehydration
      if (!user) {
        router.push("/login");
        return;
      }
      if (requiredRole && user.role !== requiredRole) {
        // Wrong role — redirect to their own home
        router.push(user.role === "teacher" ? "/dashboard" : "/muffliato");
      }
    },
    [user, loading, router]
  );

  return { user, loading, error, login, register, logout, requireAuth };
}
