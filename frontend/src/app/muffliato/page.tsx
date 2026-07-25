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
import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { SignalType } from "@/lib/types";
import Link from "next/link";

export default function MuffliatoPage() {
  const [studentId] = useState(
    () => `student_${Math.random().toString(36).slice(2, 8)}`
  );
  const [lectureId] = useState(1);
  const { sendPing, lastMessage, connected } = useWebSocket(lectureId);

  const handleSignal = (signalType: SignalType) => {
    sendPing({ student_id: studentId, signal_type: signalType, ts: new Date().toISOString() });
  };

  return (
    <main style={styles.main}>
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
          onClick={() => handleSignal(SignalType.LOST)}
        >
          🪄 I&apos;m lost
        </button>
        <button
          style={{ ...styles.button, background: "var(--slower-amber)" }}
          onClick={() => handleSignal(SignalType.SLOWER)}
        >
          ⏩ Slower
        </button>
        <button
          style={{ ...styles.button, background: "var(--gotit-green)" }}
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
              defaultChecked
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>🏏 Cricketer</span>
          </label>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="gamer"
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>🎮 Gamer</span>
          </label>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="cook"
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>👨‍🍳 Cook</span>
          </label>
        </div>
      </section>

      {/* Audio player for incoming analogy */}
      <section style={styles.audioSection}>
        <p style={styles.audioHint}>🔊 Waiting for analogy...</p>
      </section>

      {/* Back to landing */}
      <footer style={styles.footer}>
        <Link href="/" style={styles.backLink}>
          ← Back to Legilimens Landing
        </Link>
      </footer>

      {lastMessage && (
        <footer style={styles.debugFooter}>
          <small>Last signal: {JSON.stringify(lastMessage)}</small>
        </footer>
      )}
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