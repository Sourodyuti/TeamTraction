"use client";

/**
 * Marauder's Radar — teacher dashboard (Phase 3).
 *
 * Live D3 radial heatmap of concept-node confusion + Recharts timeline.
 * Fed by the WebSocket broadcast from FastAPI.
 */
import { useState, useEffect } from "react";
import { useRadarData } from "@/hooks/useRadarData";
import { RadarHeatmap } from "@/components/radar/RadarHeatmap";
import { Timeline } from "@/components/timeline/Timeline";
import { ScreenCapturePanel } from "@/components/capture/ScreenCapturePanel";
import { ConfusionOverlay } from "@/components/overlay/ConfusionOverlay";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export default function DashboardPage() {
  const [lectureId, setLectureId] = useState(1);
  const { user, loading: authLoading, logout, requireAuth } = useAuth();
  const { conceptNodes, timelineData, latencyMs, confusionAlert, lastAnalogy, currentTopic, totalStudents } = useRadarData(lectureId);
  const captureState = useScreenCapture();
  const [overlayOpen, setOverlayOpen] = useState(true);

  // Guard: teacher-only route
  useEffect(() => { requireAuth("teacher"); }, [requireAuth]);
  if (authLoading || !user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a84c", fontSize: "1.5rem" }}>🔮 Verifying access...</div>;

  const currentAlert = confusionAlert || null;
  const lostCount = currentAlert ? currentAlert.count : 0;
  
  const handleTriggerAnalogy = async () => {
    if (!currentAlert) return;
    try {
      await fetch("http://localhost:8001/retrieval/accio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecture_id: lectureId,
          concept_node: currentAlert.concept_node
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={styles.title}>
            📡 Marauder&apos;s Radar
            {captureState.recordingStatus === 'recording' && (
              <span style={{ marginLeft: '10px', fontSize: '1rem', color: '#dc2626', animation: 'pulse-glow 2s infinite' }}>🔴 REC</span>
            )}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ color: "var(--gryffindor-gold)", fontSize: "0.9rem" }}>Lecture:</label>
            <input 
              type="number" 
              value={lectureId} 
              onChange={(e) => setLectureId(Number(e.target.value) || 1)} 
              style={{ width: "60px", background: "rgba(0,0,0,0.3)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", padding: "0.25rem 0.5rem" }}
              min={1}
            />
          </div>
          <button 
            style={{
              ...styles.recordToggle,
              background: captureState.recordingStatus === 'recording' ? "rgba(220, 38, 38, 0.2)" : "rgba(255, 255, 255, 0.1)",
              borderColor: captureState.recordingStatus === 'recording' ? "#dc2626" : "rgba(255, 255, 255, 0.3)"
            }}
            onClick={() => {
              if (captureState.recordingStatus === 'recording') {
                captureState.stopRecording();
              } else {
                if (!captureState.isCapturing) {
                  captureState.startCapture().then(() => captureState.startRecording(lectureId));
                } else {
                  captureState.startRecording(lectureId);
                }
              }
            }}
          >
            {captureState.recordingStatus === 'recording' ? "🔴 Stop Recording" : "⏺ Record Lecture"}
          </button>
        </div>
        {/* Latency badge + user badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={styles.badge}>
            {latencyMs !== null
              ? `edge retrieval: ${latencyMs}ms · 0 cloud calls`
              : "awaiting signal..."}
          </div>
          {user && (
            <div style={styles.userBadge}>
              <div style={styles.userAvatar}>{user.username[0].toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#c9a84c" }}>{user.username}</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{user.role}</span>
              </div>
              <button onClick={logout} style={styles.logoutBtn} title="Sign out">↩</button>
            </div>
          )}
        </div>
      </header>

      <div style={styles.grid}>
        <div style={styles.leftCol}>
          <section style={styles.radarSection}>
            <RadarHeatmap nodes={conceptNodes} />
          </section>

          <section style={styles.timelineSection}>
            <h2>Confusion Timeline</h2>
            <Timeline data={timelineData} />
          </section>
        </div>
        
        <div style={styles.rightCol}>
          <ScreenCapturePanel lectureId={lectureId} captureState={captureState} currentTopic={currentTopic} />
        </div>
      </div>

      <footer style={styles.footer}>
        <Link href="/dashboard/pensieve" style={styles.link}>
          📜 View Pensieve analytics →
        </Link>
        <Link href="/dashboard/review" style={styles.link}>
          📼 Review Recording →
        </Link>
      </footer>

      {overlayOpen && (
        <ConfusionOverlay
          conceptNode={currentAlert?.concept_node || lastAnalogy?.concept_node || "Unknown"}
          lostCount={lostCount}
          totalStudents={totalStudents > 0 ? totalStudents : 20}
          lastAnalogy={lastAnalogy?.analogy_text}
          onTriggerAnalogy={handleTriggerAnalogy}
          visible={overlayOpen}
          onClose={() => setOverlayOpen(false)}
        />
      )}
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    padding: "1.5rem",
    maxWidth: "1400px",
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
    margin: 0,
  },
  recordToggle: {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    borderWidth: "1px",
    borderStyle: "solid",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  badge: {
    background: "var(--slytherin-green)",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    fontFamily: "monospace",
    fontSize: "0.9rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "70% 30%",
    gap: "2rem",
  },
  leftCol: {
    display: "flex",
    flexDirection: "column" as const,
  },
  rightCol: {
    display: "flex",
    flexDirection: "column" as const,
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
  footer: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "2rem",
    padding: "1rem 0",
    borderTop: "1px solid rgba(255,255,255,0.1)",
  },
  link: {
    color: "var(--gryffindor-gold)",
    textDecoration: "none",
    fontSize: "1.1rem",
  },
  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "rgba(201,168,76,0.08)",
    border: "1px solid rgba(201,168,76,0.25)",
    borderRadius: "10px",
    padding: "0.4rem 0.75rem",
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7c3aed, #c9a84c)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  logoutBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0 0.1rem",
    lineHeight: 1,
    transition: "color 0.2s",
  },
};

