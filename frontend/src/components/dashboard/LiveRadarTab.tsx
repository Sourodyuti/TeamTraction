"use client";

/**
 * LiveRadarTab — the "live classroom" view.
 *
 * Composes the existing D3 RadarHeatmap + Recharts Timeline, plus a live
 * confusion-alert card and the last-delivered analogy (with inline audio
 * play). Reuses useRadarData → useWebSocket, so it lights up as soon as
 * real pings (or a triggered confusion wave) arrive.
 */
import { useRef } from "react";
import { RadarHeatmap } from "@/components/radar/RadarHeatmap";
import { Timeline } from "@/components/timeline/Timeline";
import { LatencyBreakdown } from "./LatencyBreakdown";
import type {
  ConceptNode,
  TimelinePoint,
  LatencyBadge,
  AnalogyReady,
} from "@/lib/types";

interface Props {
  conceptNodes: ConceptNode[];
  timelineData: TimelinePoint[];
  latencyBadge: LatencyBadge | null;
  /** Partial alert shape — useRadarData exposes the three meaningful fields. */
  confusionAlert: { concept_node: string; count: number; recommendation: string } | null;
  lastAnalogy: { concept_node: string; analogy_text: string; audio_url?: string } | null;
  totalStudents: number;
  currentTopic: string | null;
}

export function LiveRadarTab({
  conceptNodes,
  timelineData,
  latencyBadge,
  confusionAlert,
  lastAnalogy,
  totalStudents,
  currentTopic,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAnalogy = () => {
    if (!lastAnalogy?.audio_url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = lastAnalogy.audio_url;
    audioRef.current.play().catch(() => {});
  };

  return (
    <div className="lg-dash-radar-grid" style={styles.grid}>
      {/* Radar */}
      <section style={styles.card}>
        <h2 style={styles.h2}>🛰️ Marauder&apos;s Radar</h2>
        <p style={styles.hint}>
          Live concept-node confusion. Pulled toward center = calmer · outward + redder = more lost.
          {currentTopic && (
            <> · <span style={styles.topicPill}>current: {currentTopic.replace(/_/g, " ")}</span></>
          )}
        </p>
        {conceptNodes.length > 0 ? (
          <RadarHeatmap nodes={conceptNodes} liveStudentCount={totalStudents} />
        ) : (
          <div style={styles.emptyRadar}>
            <div style={styles.emptyIcon}>📡</div>
            <div style={styles.emptyTitle}>No live signals yet</div>
            <div style={styles.emptyHint}>
              Open the <strong>Muffliato</strong> student view, or hit
              <strong> “Trigger confusion wave”</strong> to send real pings.
            </div>
          </div>
        )}
      </section>

      {/* Right column: alert + analogy + latency */}
      <div style={styles.rightCol}>
        <section style={{ ...styles.card, borderColor: confusionAlert ? "rgba(220,20,60,0.5)" : "rgba(212,175,55,0.2)" }}>
          <h2 style={styles.h2}>⚠️ Confusion Alert</h2>
          {confusionAlert ? (
            <div style={styles.alertBox}>
              <div style={styles.alertConcept}>{confusionAlert.concept_node.replace(/_/g, " ")}</div>
              <div style={styles.alertRow}>
                <span style={styles.alertCount}>{confusionAlert.count}</span>
                <span style={styles.alertLabel}>students lost in window</span>
              </div>
              <div style={styles.alertRec}>{confusionAlert.recommendation}</div>
            </div>
          ) : (
            <div style={styles.emptySmall}>Threshold not crossed (≥2 lost / 20s).</div>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>🪄 Last Analogy (Gemino + Sonorus)</h2>
          {lastAnalogy ? (
            <div>
              <div style={styles.analogyConcept}>{lastAnalogy.concept_node.replace(/_/g, " ")}</div>
              <div style={styles.analogyText}>{lastAnalogy.analogy_text}</div>
              {lastAnalogy.audio_url && (
                <button style={styles.playBtn} onClick={playAnalogy}>▶ Play voice (Sonorus)</button>
              )}
            </div>
          ) : (
            <div style={styles.emptySmall}>No analogy delivered yet — trigger a confusion wave.</div>
          )}
        </section>

        <LatencyBreakdown badge={latencyBadge} />
      </div>

      {/* Timeline full width */}
      <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
        <h2 style={styles.h2}>📈 Confusion Timeline</h2>
        <p style={styles.hint}>Rolling confusion density. Crosses the red <em>trigger</em> line → Accio fires.</p>
        <Timeline data={timelineData} />
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: "1.25rem",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "1.25rem",
  },
  h2: {
    fontFamily: '"Cinzel", serif',
    color: "#D4AF37",
    fontSize: "1.05rem",
    margin: "0 0 0.5rem",
    letterSpacing: "0.03em",
  },
  hint: { fontSize: "0.78rem", color: "rgba(245,230,200,0.5)", margin: "0 0 1rem" },
  topicPill: {
    background: "rgba(212,175,55,0.15)",
    border: "1px solid rgba(212,175,55,0.3)",
    color: "#D4AF37",
    padding: "0.1rem 0.45rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontFamily: '"JetBrains Mono", monospace',
  },
  rightCol: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  emptyRadar: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "3rem 1rem",
    color: "rgba(245,230,200,0.4)",
    textAlign: "center",
  },
  emptyIcon: { fontSize: "3rem", marginBottom: "0.75rem", animation: "pulse 3s ease-in-out infinite" },
  emptyTitle: { fontFamily: '"Cinzel", serif', color: "#D4AF37", marginBottom: "0.4rem" },
  emptyHint: { fontSize: "0.82rem", maxWidth: 320, lineHeight: 1.5 },
  emptySmall: { color: "rgba(245,230,200,0.4)", fontStyle: "italic", fontSize: "0.85rem", padding: "0.5rem 0" },
  alertBox: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  alertConcept: { fontFamily: '"Cinzel", serif', color: "#DC143C", fontSize: "1.1rem", fontWeight: 700 },
  alertRow: { display: "flex", alignItems: "baseline", gap: "0.4rem" },
  alertCount: { fontFamily: '"JetBrains Mono", monospace', fontSize: "1.8rem", color: "#DC143C", fontWeight: 700 },
  alertLabel: { fontSize: "0.78rem", color: "rgba(245,230,200,0.6)" },
  alertRec: { fontSize: "0.8rem", color: "rgba(245,230,200,0.5)", fontStyle: "italic" },
  analogyConcept: { fontFamily: '"Cinzel", serif', color: "#BB86FC", fontSize: "1rem", marginBottom: "0.4rem" },
  analogyText: { fontSize: "0.88rem", color: "#F5E6C8", lineHeight: 1.6, marginBottom: "0.6rem" },
  playBtn: {
    background: "rgba(5,150,105,0.15)",
    border: "1px solid rgba(5,150,105,0.5)",
    color: "#50C878",
    padding: "0.4rem 0.85rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
};
