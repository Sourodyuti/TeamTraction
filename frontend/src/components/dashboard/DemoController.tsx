"use client";

/**
 * DemoController — sticky control bar for driving the demo narrative.
 *
 * Two honest, no-fake-data actions:
 *   - "Load demo data": calls POST /analytics/seed 2× (12 rows) so the
 *     Analytics tab populates immediately for judges.
 *   - "Trigger confusion wave": uses useConfusionWave to send real lost
 *     pings over the live WS, crossing the real threshold → real Accio.
 *
 * Includes concept + avatar pickers and toast-style feedback.
 */
import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  lectureId: number;
  wsConnected: boolean;
  onLoad: () => void;           // parent re-fetches analytics after seeding
  triggerWave: (concept: string, count: number) => void;
  waveMessage: string;
  waveFiring: boolean;
}

const CONCEPTS = ["chain_rule", "gradient_descent", "backpropagation", "neural_networks", "learning_rate"];

export function DemoController({
  lectureId,
  wsConnected,
  onLoad,
  triggerWave,
  waveMessage,
  waveFiring,
}: Props) {
  const [concept, setConcept] = useState("chain_rule");
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const flash = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLoad = async () => {
    setSeeding(true);
    try {
      // Seed twice for richer data (chain_rule + gradient_descent).
      await Promise.all([api.seedDemo(lectureId), api.seedDemo(lectureId)]);
      flash("Loaded 12 demo confusion events ✨", true);
      onLoad();
    } catch (e) {
      flash(`Seed failed: ${e instanceof Error ? e.message : "unknown"}`, false);
    } finally {
      setSeeding(false);
    }
  };

  const handleWave = () => {
    if (!wsConnected) {
      flash("WebSocket not connected — open the Live Radar tab first.", false);
      return;
    }
    triggerWave(concept, 4);
    flash(`Confusion wave sent for "${concept.replace(/_/g, " ")}" 🌊`, true);
  };

  return (
    <div style={styles.bar}>
      <div style={styles.group}>
        <span style={styles.label}>Concept:</span>
        <select
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          style={styles.select}
        >
          {CONCEPTS.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <button
        style={{ ...styles.btn, ...styles.seedBtn }}
        onClick={handleLoad}
        disabled={seeding}
        title="Populate the Pensieve analytics with demo confusion events"
      >
        {seeding ? "⏳ Seeding…" : "📊 Load demo data"}
      </button>

      <button
        style={{
          ...styles.btn,
          ...styles.waveBtn,
          opacity: waveFiring || !wsConnected ? 0.6 : 1,
        }}
        onClick={handleWave}
        disabled={waveFiring}
        title="Send real lost pings over the live WS to trigger the real Accio pipeline"
      >
        {waveFiring ? "🌊 Firing…" : "🌊 Trigger confusion wave"}
      </button>

      <div style={styles.wsPill} title={wsConnected ? "WebSocket connected" : "WebSocket disconnected"}>
        <span
          style={{
            ...styles.wsDot,
            background: wsConnected ? "#50C878" : "#DC143C",
          }}
        />
        {wsConnected ? "WS live" : "WS off"}
      </div>

      {toast && (
        <div style={{ ...styles.toast, borderColor: toast.ok ? "#50C87888" : "#DC143C88" }}>
          {toast.msg}
        </div>
      )}
      {waveMessage && !toast && <div style={styles.waveMsg}>{waveMessage}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
    background: "rgba(13,7,20,0.7)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: "12px",
    padding: "0.7rem 1rem",
    marginBottom: "1.25rem",
  },
  group: { display: "flex", alignItems: "center", gap: "0.4rem" },
  label: { fontSize: "0.78rem", color: "rgba(245,230,200,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" },
  select: {
    background: "rgba(0,0,0,0.4)",
    color: "#F5E6C8",
    border: "1px solid rgba(212,175,55,0.3)",
    borderRadius: "6px",
    padding: "0.35rem 0.6rem",
    fontSize: "0.82rem",
    cursor: "pointer",
  },
  btn: {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid rgba(212,175,55,0.3)",
    color: "#F5E6C8",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.82rem",
    transition: "all 0.2s",
  },
  seedBtn: {
    background: "rgba(138,43,226,0.15)",
    borderColor: "rgba(138,43,226,0.5)",
  },
  waveBtn: {
    background: "rgba(220,20,60,0.15)",
    borderColor: "rgba(220,20,60,0.5)",
  },
  wsPill: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    marginLeft: "auto",
    fontSize: "0.72rem",
    color: "rgba(245,230,200,0.6)",
    fontFamily: '"JetBrains Mono", monospace',
  },
  wsDot: { width: 7, height: 7, borderRadius: "50%" },
  toast: {
    position: "absolute",
    top: "calc(100% + 0.5rem)",
    right: 0,
    background: "rgba(26,15,46,0.96)",
    border: "1px solid",
    borderRadius: "8px",
    padding: "0.5rem 0.85rem",
    fontSize: "0.78rem",
    color: "#F5E6C8",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    animation: "fadeIn 0.2s ease-out",
    zIndex: 50,
  },
  waveMsg: {
    fontSize: "0.72rem",
    color: "rgba(245,230,200,0.5)",
    fontStyle: "italic",
  },
};
