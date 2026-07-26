"use client";

/**
 * Muffliato — the student-facing PWA (Phase 2).
 *
 * Big, thumb-friendly buttons for a phone:
 *   🪄 "I'm lost"  →  sends a 'lost' ping over WebSocket
 *   ✅ "Got it"    →  sends a 'gotit' ping
 *   ⏩ "Slower"    →  sends a 'slower' ping
 *
 * Also receives analogy audio back from Sonorus (Phase 6).
 */
import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { SignalType } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export default function MuffliatoPage() {
  const { user, loading: authLoading, requireAuth } = useAuth();
  const [showToast, setShowToast] = useState(false);
  const [lectureId] = useState(1);
  const { sendPing, lastMessage, connected } = useWebSocket(lectureId);

  const [analogy, setAnalogy] = useState<{text: string; audioUrl?: string} | null>(null);
  const [avatar, setAvatar] = useState<'cricketer'|'gamer'|'cook'>('cricketer');

  // Guard: student route
  useEffect(() => { requireAuth("student"); }, [requireAuth]);

  useEffect(() => {
    if (!authLoading && user) {
      if (!localStorage.getItem("legilimens_student_id")) {
        localStorage.setItem("legilimens_student_id", `student_${Math.random().toString(36).slice(2, 8)}`);
      }
    }
  }, [authLoading, user]);

  const studentId = typeof window !== "undefined" ? localStorage.getItem("legilimens_student_id") || "student_x" : "student_x";

  if (authLoading || !user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a84c", fontSize: "1.5rem" }}>🔮 Verifying...</div>;

  useEffect(() => {
    if (lastMessage?.type === 'analogy_ready') {
      const { analogy_text, audio_url } = lastMessage as any;
      setAnalogy({ text: analogy_text, audioUrl: audio_url });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      if (audio_url) {
        const playAudio = (url: string, retries = 1) => {
          const audio = new Audio(url);
          audio.play().catch(e => {
            console.error("Auto-play prevented", e);
            if (retries > 0) {
              setTimeout(() => playAudio(url, retries - 1), 500);
            } else {
              setAnalogy(prev => prev ? { ...prev, text: prev.text + " (Auto-play failed, tap to play)" } : null);
            }
          });
        };
        playAudio(audio_url);
      }
    }
  }, [lastMessage]);

  const handleSignal = (signalType: SignalType) => {
    sendPing({ student_id: studentId, signal_type: signalType, ts: new Date().toISOString(), avatar });
  };

  return (
    <main style={styles.main}>
      {showToast && analogy && (
        <div className="toast">
          🔮 {analogy.text.substring(0, 50)}...
        </div>
      )}
      <header style={styles.header}>
        <h1 style={styles.title}>🔮 Muffliato</h1>
        <p style={styles.subtitle}>Tap to signal — quietly, without disrupting class</p>
        <p style={styles.status}>
          {connected ? "🟢 Connected" : "🔴 Connecting..."}
        </p>
      </header>

      <section style={styles.buttons}>
        <button
          style={{ ...styles.button, background: "var(--lost-red)" }}
          className={connected ? "pulse-button" : ""}
          onClick={() => handleSignal(SignalType.LOST)}
        >
          🪄 I&apos;m lost
        </button>
        <button
          style={{ ...styles.button, background: "var(--slower-amber)" }}
          className={connected ? "pulse-button" : ""}
          onClick={() => handleSignal(SignalType.SLOWER)}
        >
          ⏩ Slower
        </button>
        <button
          style={{ ...styles.button, background: "var(--gotit-green)" }}
          className={connected ? "pulse-button" : ""}
          onClick={() => handleSignal(SignalType.GOTIT)}
        >
          ✅ Got it
        </button>
      </section>

      {/* Avatar picker */}
      <section style={styles.avatarPicker}>
        <label style={styles.avatarLabel}>Your Interest:</label>
        <div style={styles.avatarOptions}>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="cricketer"
              checked={avatar === 'cricketer'}
              onChange={(e) => setAvatar(e.target.value as any)}
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>🏏 Cricketer</span>
          </label>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="gamer"
              checked={avatar === 'gamer'}
              onChange={(e) => setAvatar(e.target.value as any)}
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>🎮 Gamer</span>
          </label>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="cook"
              checked={avatar === 'cook'}
              onChange={(e) => setAvatar(e.target.value as any)}
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>👨‍🍳 Cook</span>
          </label>
        </div>
      </section>

      {/* Audio player for incoming analogy */}
      <section style={styles.audioSection}>
        {analogy ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
            <p style={{ ...styles.audioHint, color: "var(--gotit-green)", fontWeight: "bold" }}>
              {analogy.audioUrl ? "🔊 Accio Analogy!" : "🪄 Analogy Received!"}
            </p>
            <p style={{ fontStyle: "italic", opacity: 0.9 }}>{analogy.text}</p>
            {analogy.audioUrl && (
              <button
                style={{ ...styles.button, minHeight: "40px", padding: "0.5rem 1rem", fontSize: "1rem" }}
                onClick={() => new Audio(analogy.audioUrl!).play()}
              >
                Replay Audio
              </button>
            )}
          </div>
        ) : (
          <p style={styles.audioHint}>🔊 Waiting for analogy...</p>
        )}
      </section>

      {/* Back to landing */}
      <footer style={styles.footer}>
        <Link href="/" style={styles.backLink}>
          ← Back to Legilimens Landing
        </Link>
      </footer>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "space-between",
    padding: "2rem 1rem",
  },
  header: {
    textAlign: "center" as const,
  },
  title: {
    fontSize: "2.5rem",
    margin: "0.5rem 0",
    color: "var(--gryffindor-gold)",
  },
  subtitle: {
    opacity: 0.8,
    marginBottom: "0.5rem",
  },
  status: {
    fontSize: "0.9rem",
  },
  buttons: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    width: "100%",
    maxWidth: "360px",
  },
  button: {
    padding: "1.5rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "white",
    border: "none",
    borderRadius: "16px",
    cursor: "pointer",
    minHeight: "80px",
  },
  avatarPicker: {
    margin: "2rem 0",
    padding: "1rem",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "360px",
  },
  avatarLabel: {
    display: "block",
    marginBottom: "0.5rem",
    fontWeight: 600,
    color: "var(--gryffindor-gold)",
  },
  avatarOptions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.75rem",
    justifyContent: "center",
  },
  avatarOption: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    padding: "0.5rem 1rem",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "8px",
    border: "1px solid transparent",
    transition: "all 0.2s",
  },
  avatarRadio: {
    display: "none",
  },
  avatarName: {
    fontSize: "1rem",
  },
  audioSection: {
    padding: "1rem",
    margin: "1rem 0",
    background: "rgba(211, 166, 37, 0.1)",
    border: "1px solid var(--gryffindor-gold)",
    borderRadius: "8px",
    width: "100%",
    maxWidth: "360px",
    textAlign: "center" as const,
  },
  audioHint: {
    margin: 0,
    color: "var(--gryffindor-gold)",
    fontStyle: "italic",
  },
  footer: {
    marginTop: "2rem",
    paddingTop: "1rem",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    width: "100%",
    maxWidth: "360px",
    textAlign: "center" as const,
  },
  backLink: {
    color: "var(--gryffindor-gold)",
    textDecoration: "none",
    fontSize: "0.9rem",
  },
  debugFooter: {
    opacity: 0.6,
    textAlign: "center" as const,
    marginTop: "1rem",
  },
};