"use client";

/**
 * KpiBar — a row of headline metric tiles for the command center.
 *
 * Fed by /analytics/summary (total/lost/got-it) and /metrics
 * (WS connections, lectures, uptime). Shimmer skeletons while loading.
 */
import type { MetricsResponse } from "@/lib/types";
import { formatUptime } from "@/lib/analytics-transforms";

export interface KpiData {
  total: number;
  lost: number;
  gotit: number;
  metrics: MetricsResponse | null;
  lastLatencyTotal: number | null;
}

interface Props {
  data: KpiData | null;
  loading?: boolean;
}

export function KpiBar({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div style={styles.bar}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer" style={styles.skeleton} />
        ))}
      </div>
    );
  }

  const tiles = [
    { label: "Total Signals", value: data.total, icon: "📡", color: "#D4AF37" },
    { label: "Lost", value: data.lost, icon: "🪄", color: "#DC143C" },
    { label: "Got It", value: data.gotit, icon: "✅", color: "#50C878" },
    {
      label: "WS Connections",
      value: data.metrics?.active_websocket_connections ?? 0,
      icon: "🔌",
      color: "#66FCF1",
    },
    {
      label: "Active Lectures",
      value: data.metrics?.active_lectures ?? 0,
      icon: "🎓",
      color: "#BB86FC",
    },
    {
      label: "Uptime",
      value: formatUptime(data.metrics?.uptime_seconds ?? 0),
      icon: "⏱",
      color: "#F5E6C8",
      isText: true,
    },
  ];

  if (data.lastLatencyTotal != null) {
    tiles.push({
      label: "Last Accio",
      value: `${data.lastLatencyTotal.toFixed(0)}ms`,
      icon: "⚡",
      color: "#FFD700",
      isText: true,
    });
  }

  return (
    <div style={styles.bar}>
      {tiles.map((t, i) => (
        <div key={i} style={{ ...styles.tile, borderColor: `${t.color}44` }}>
          <div style={styles.tileIcon}>{t.icon}</div>
          <div style={styles.tileBody}>
            <div style={{ ...styles.tileValue, color: t.color }}>{t.value}</div>
            <div style={styles.tileLabel}>{t.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "0.85rem",
    marginBottom: "1.25rem",
  },
  tile: {
    display: "flex",
    alignItems: "center",
    gap: "0.7rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "0.85rem 1rem",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  tileIcon: { fontSize: "1.4rem", flexShrink: 0 },
  tileBody: { display: "flex", flexDirection: "column", lineHeight: 1.15 },
  tileValue: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "1.4rem",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  tileLabel: {
    fontSize: "0.7rem",
    color: "rgba(245,230,200,0.55)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginTop: "0.15rem",
  },
  skeleton: {
    height: 64,
    borderRadius: 12,
  },
};
