"use client";

/**
 * Register page — /register
 * Choose role: teacher (gets dashboard access) or student (gets Muffliato).
 */
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

type Role = "teacher" | "student";

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, loading } = useAuth();

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    role: "student" as Role,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === "teacher" ? "/dashboard" : "/muffliato");
    }
  }, [user, loading, router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const u = await register({
        email: form.email,
        username: form.username,
        password: form.password,
        role: form.role,
        full_name: form.full_name || undefined,
      });
      router.replace(u.role === "teacher" ? "/dashboard" : "/muffliato");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={s.page}>
      <div style={{ ...s.orb, top: "5%", right: "10%", width: 350, height: 350, background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)" }} />
      <div style={{ ...s.orb, bottom: "5%", left: "5%", width: 300, height: 300, background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)" }} />

      <div style={s.card}>
        <div style={s.header}>
          <div style={s.emoji}>⚡</div>
          <h1 style={s.title}>Join Legilimens</h1>
          <p style={s.subtitle}>Choose your role in the classroom</p>
        </div>

        {/* Role selector */}
        <div style={s.roleRow}>
          {(["teacher", "student"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: r }))}
              style={{
                ...s.roleBtn,
                ...(form.role === r ? s.roleBtnActive : {}),
              }}
            >
              <span style={s.roleIcon}>{r === "teacher" ? "🧙‍♂️" : "📱"}</span>
              <span style={s.roleName}>{r === "teacher" ? "Teacher" : "Student"}</span>
              <span style={s.roleHint}>
                {r === "teacher" ? "Dashboard + radar" : "Muffliato PWA"}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Full name</label>
              <input id="reg-name" name="full_name" type="text" value={form.full_name} onChange={set("full_name")}
                placeholder="Hermione Granger" style={s.input} autoComplete="name" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Username</label>
              <input id="reg-username" name="username" type="text" value={form.username} onChange={set("username")}
                placeholder="hermione_g" style={s.input} required autoComplete="username" />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input id="reg-email" name="email" type="email" value={form.email} onChange={set("email")}
              placeholder="hermione@hogwarts.edu" style={s.input} required autoComplete="email" />
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input id="reg-password" name="password" type="password" value={form.password} onChange={set("password")}
                placeholder="••••••••" style={s.input} required autoComplete="new-password" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Confirm</label>
              <input id="reg-confirm" name="confirmPassword" type="password" value={form.confirmPassword} onChange={set("confirmPassword")}
                placeholder="••••••••" style={s.input} required autoComplete="new-password" />
            </div>
          </div>

          {error && <p style={s.error}>⚠ {error}</p>}

          <button id="reg-submit" type="submit" disabled={submitting}
            style={{ ...s.btn, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Casting spell..." : `✨ Create ${form.role === "teacher" ? "Teacher" : "Student"} Account`}
          </button>
        </form>

        <p style={s.footer}>
          Already have an account?{" "}
          <Link href="/login" style={s.link}>Sign in</Link>
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
  orb: { position: "absolute", borderRadius: "50%", pointerEvents: "none" },
  card: {
    position: "relative",
    zIndex: 1,
    background: "rgba(15, 20, 40, 0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(201, 168, 76, 0.25)",
    borderRadius: "24px",
    padding: "2.5rem 2.5rem",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 0 60px rgba(124,58,237,0.15), 0 25px 50px rgba(0,0,0,0.4)",
  },
  header: { textAlign: "center", marginBottom: "1.5rem" },
  emoji: { fontSize: "2.5rem", marginBottom: "0.5rem", filter: "drop-shadow(0 0 20px rgba(201,168,76,0.5))" },
  title: { fontSize: "1.8rem", fontWeight: 700, color: "#c9a84c", margin: "0 0 0.25rem", letterSpacing: "-0.02em" },
  subtitle: { color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", margin: 0 },
  roleRow: { display: "flex", gap: "0.75rem", marginBottom: "1.5rem" },
  roleBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem",
    padding: "1rem 0.5rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "14px", cursor: "pointer", transition: "all 0.2s", color: "rgba(255,255,255,0.6)",
  },
  roleBtnActive: {
    background: "rgba(201,168,76,0.12)",
    border: "1px solid rgba(201,168,76,0.5)",
    color: "#c9a84c",
    boxShadow: "0 0 20px rgba(201,168,76,0.15)",
  },
  roleIcon: { fontSize: "1.5rem" },
  roleName: { fontWeight: 700, fontSize: "0.9rem" },
  roleHint: { fontSize: "0.7rem", opacity: 0.7 },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  row: { display: "flex", gap: "0.75rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1 },
  label: { fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em", textTransform: "uppercase" },
  input: {
    padding: "0.65rem 0.9rem",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(201,168,76,0.2)",
    borderRadius: "10px", color: "#fff", fontSize: "0.95rem", outline: "none",
  },
  error: {
    color: "#f87171", fontSize: "0.875rem",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px", padding: "0.6rem 0.9rem", margin: 0,
  },
  btn: {
    padding: "0.85rem",
    background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
    border: "none", borderRadius: "12px", color: "#fff",
    fontSize: "1rem", fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 20px rgba(124,58,237,0.4)", marginTop: "0.25rem",
  },
  footer: { textAlign: "center", marginTop: "1.25rem", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" },
  link: { color: "#c9a84c", textDecoration: "none", fontWeight: 600 },
};
