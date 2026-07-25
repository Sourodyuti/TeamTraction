"use client";

/**
 * Marauder's Radar — teacher dashboard (Phase 3).
 *
 * Live D3 radial heatmap of concept-node confusion + Recharts timeline.
 * Fed by the WebSocket broadcast from FastAPI.
 */
import { useRadarData } from "@/hooks/useRadarData";
import { RadarHeatmap } from "@/components/radar/RadarHeatmap";
import { Timeline } from "@/components/timeline/Timeline";

export default function DashboardPage() {
  const { conceptNodes, timelineData, latencyMs } = useRadarData();

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>📡 Marauder&apos;s Radar</h1>
        {/* Phase 4: live latency badge */}
        <div style={styles.badge}>
          {latencyMs !== null
            ? `edge retrieval: ${latencyMs}ms · 0 cloud calls`
            : "awaiting signal..."}
        </div>
      </header>

      <section style={styles.radarSection}>
        <RadarHeatmap nodes={conceptNodes} />
      </section>

      <section style={styles.timelineSection}>
        <h2>Confusion Timeline</h2>
        <Timeline data={timelineData} />
      </section>

      <footer>
        <a href="/dashboard/pensieve" style={styles.link}>
          📜 View Pensieve analytics →
        </a>
      </footer>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    padding: "1.5rem",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
    flexWrap: "wrap" as const,
    gap: "1rem",
  },
  title: {
    color: "var(--gryffindor-gold)",
  },
  badge: {
    background: "var(--slytherin-green)",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    fontFamily: "monospace",
    fontSize: "0.9rem",
  },
  radarSection: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "1rem",
    marginBottom: "2rem",
    display: "flex",
    justifyContent: "center",
  },
  timelineSection: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "1.5rem",
    marginBottom: "2rem",
  },
  link: {
    color: "var(--gryffindor-gold)",
    textDecoration: "none",
    fontSize: "1.1rem",
  },
};
