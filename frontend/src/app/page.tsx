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

export default function MuffliatoPage() {
  const [studentId] = useState(
    () => `student_${Math.random().toString(36).slice(2, 8)}`
  );
  const [lectureId] = useState(1);
  const { sendPing, lastMessage, connected } = useWebSocket(lectureId);

  const handleSignal = (signalType: SignalType) => {
    sendPing({ student_id: studentId, signal_type: signalType });
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

      {/* TODO Phase 5: Avatar picker (cricketer / gamer / cook) */}
      {/* TODO Phase 6: Audio player for incoming analogy_audio messages */}

      {lastMessage && (
        <footer style={styles.footer}>
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
  footer: {
    opacity: 0.6,
    textAlign: "center" as const,
  },
};
