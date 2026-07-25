"use client";

/**
 * Login page — /login
 * Hogwarts dark theme with glassmorphism card.
 * Redirects teachers → /dashboard, students → /muffliato after success.
 */
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === "teacher" ? "/dashboard" : "/muffliato");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login({ email, password });
      router.replace(u.role === "teacher" ? "/dashboard" : "/muffliato");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={s.page}>
      {/* Floating orbs */}
      <div style={{ ...s.orb, top: "10%", left: "15%", width: 300, height: 300, background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)" }} />
      <div style={{ ...s.orb, bottom: "10%", right: "10%", width: 400, height: 400, background: "radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)" }} />

      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.emoji}>🔮</div>
          <h1 style={s.title}>Legilimens</h1>
          <p style={s.subtitle}>Read minds. Fix confusion. In real-time.</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="professor@hogwarts.edu"
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={s.input}
            />
          </div>

          {error && <p style={s.error}>⚠ {error}</p>}

          <button
            id="login-submit"
            type="submit"
            disabled={submitting}
            style={{ ...s.btn, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? "Casting spell..." : "🪄 Enter the classroom"}
          </button>
        </form>

        <p style={s.footer}>
          New here?{" "}
          <Link href="/register" style={s.link}>
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0a0e1a 0%, #0d0f2b 50%, #0a0e1a 100%)",
    position: "relative",
    overflow: "hidden",
    padding: "1rem",
  },
  orb: {
    position: "absolute",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    zIndex: 1,
    background: "rgba(15, 20, 40, 0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(201, 168, 76, 0.25)",
    borderRadius: "24px",
    padding: "3rem 2.5rem",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 0 60px rgba(124, 58, 237, 0.15), 0 25px 50px rgba(0,0,0,0.4)",
  },
  header: {
    textAlign: "center",
    marginBottom: "2rem",
  },
  emoji: {
    fontSize: "3rem",
    marginBottom: "0.5rem",
    filter: "drop-shadow(0 0 20px rgba(201,168,76,0.5))",
  },
  title: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "#c9a84c",
    margin: "0 0 0.25rem",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.9rem",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  input: {
    padding: "0.75rem 1rem",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(201,168,76,0.2)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.2s",
  },
  error: {
    color: "#f87171",
    fontSize: "0.875rem",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px",
    padding: "0.6rem 0.9rem",
    margin: 0,
  },
  btn: {
    padding: "0.9rem",
    background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
    marginTop: "0.5rem",
  },
  footer: {
    textAlign: "center",
    marginTop: "1.5rem",
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.9rem",
  },
  link: {
    color: "#c9a84c",
    textDecoration: "none",
    fontWeight: 600,
  },
};
