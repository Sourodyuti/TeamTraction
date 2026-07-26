"use client";

/**
 * SystemTab — the developer / ops view.
 *
 * Shows the SystemHealthPanel (all services green/red), the /metrics
 * readout, and notes on the graceful-fallback architecture that makes
 * Legilimens demo-resilient.
 */
import { SystemHealthPanel } from "./SystemHealthPanel";
import { formatUptime } from "@/lib/analytics-transforms";
import type { AggregatedHealth } from "@/lib/types";

interface Props {
  health: AggregatedHealth;
}

export function SystemTab({ health }: Props) {
  const m = health.metrics;
  const h = health.health;
  const healthyCount = health.services.filter((s) => s.healthy).length;
  const totalCount = health.services.length;

  return (
    <div style={styles.wrap}>
      <section style={styles.card}>
        <div style={styles.cardHead}>
          <h2 style={styles.h2}>🔌 Service Health</h2>
          <span style={styles.summaryPill}>
            {healthyCount}/{totalCount} operational
          </span>
        </div>
        <p style={styles.hint}>
          Polled every 5s from <code style={styles.code}>/health</code>, <code style={styles.code}>/metrics</code>,
          and per-router health endpoints.
        </p>
        <SystemHealthPanel services={health.services} loading={health.loading} />
      </section>

      <div className="lg-dash-two-col" style={styles.twoCol}>
        <section style={styles.card}>
          <h2 style={styles.h2}>📊 Operational Metrics</h2>
          <p style={styles.hint}>From <code style={styles.code}>GET /metrics</code>.</p>
          <div style={styles.metricList}>
            <MetricRow label="Uptime" value={m ? formatUptime(m.uptime_seconds) : "—"} />
            <MetricRow label="Embedder loaded" value={m ? (m.embedder_loaded ? "✅ yes" : "❌ no") : "—"} />
            <MetricRow label="VectorAI connected" value={m ? (m.vectorai_connected ? "✅ yes" : "❌ no") : "—"} />
            <MetricRow label="Analytics backend" value={m ? (m.analytics_connected ? "✅ yes" : "❌ no") : "—"} />
            <MetricRow label="WS connections" value={m?.active_websocket_connections != null ? String(m.active_websocket_connections) : "—"} />
            <MetricRow label="Active lectures" value={m?.active_lectures != null ? String(m.active_lectures) : "—"} />
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>🏛️ Architecture</h2>
          <p style={styles.hint}>Why Legilimens never fails on stage.</p>
          <ul style={styles.featureList}>
            <li>
              <strong style={{ color: "#D4AF37" }}>On-prem by design.</strong> Student data stays on the school
              server; only the analogy rewrite + voice cross to the cloud.
            </li>
            <li>
              <strong style={{ color: "#D4AF37" }}>Graceful degradation.</strong> Each service degrades independently —
              Gemini 429s fall back to NVIDIA NIM, then raw text; no ElevenLabs means no audio, not a crash.
            </li>
            <li>
              <strong style={{ color: "#D4AF37" }}>Auto-detecting DB.</strong> Actian Vector SQL when the ODBC driver is
              present; SQLite otherwise. Pensieve queries work identically on both.
            </li>
            <li>
              <strong style={{ color: "#D4AF37" }}>Offline cache.</strong> Pre-cached analogy MP3s in
              <code style={styles.code}> backend/cache/</code> keep the cable-pull demo moment alive.
            </li>
          </ul>
          {h && (
            <div style={styles.versionBox}>
              <span style={styles.versionLabel}>service / version</span>
              <span style={styles.versionValue}>{h.service} v{h.version}</span>
            </div>
          )}
        </section>
      </div>

      {health.lastUpdated && (
        <div style={styles.updated}>
          last updated {new Date(health.lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricRow}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "1.25rem",
  },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" },
  h2: { fontFamily: '"Cinzel", serif', color: "#D4AF37", fontSize: "1.05rem", margin: 0, letterSpacing: "0.03em" },
  summaryPill: {
    background: "rgba(80,200,120,0.12)",
    border: "1px solid rgba(80,200,120,0.4)",
    color: "#50C878",
    padding: "0.2rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontFamily: '"JetBrains Mono", monospace',
  },
  hint: { fontSize: "0.78rem", color: "rgba(245,230,200,0.5)", margin: "0 0 1rem" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" },
  metricList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.5rem 0.75rem",
    background: "rgba(0,0,0,0.2)",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  metricLabel: { fontSize: "0.82rem", color: "rgba(245,230,200,0.7)" },
  metricValue: { fontSize: "0.82rem", color: "#F5E6C8", fontFamily: '"JetBrains Mono", monospace' },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    fontSize: "0.82rem",
    color: "rgba(245,230,200,0.7)",
    lineHeight: 1.5,
  },
  versionBox: {
    marginTop: "1rem",
    padding: "0.6rem 0.85rem",
    background: "rgba(0,0,0,0.25)",
    borderRadius: "8px",
    border: "1px solid rgba(212,175,55,0.2)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  versionLabel: { fontSize: "0.72rem", color: "rgba(245,230,200,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" },
  versionValue: { fontFamily: '"JetBrains Mono", monospace', color: "#D4AF37", fontSize: "0.85rem" },
  updated: { textAlign: "center", fontSize: "0.72rem", color: "rgba(245,230,200,0.35)", fontStyle: "italic" },
  code: { fontFamily: '"JetBrains Mono", monospace', background: "rgba(255,255,255,0.06)", padding: "0.05rem 0.3rem", borderRadius: 4, fontSize: "0.76rem" },
};
