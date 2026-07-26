"use client";

import { useCallback, useEffect, useRef } from "react";
import { ConfusionOverlay } from "@/components/overlay/ConfusionOverlay";
import { LatencyBadge } from "@/components/overlay/LatencyBadge";
import { useRadarData } from "@/hooks/useRadarData";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function OverlayPage() {
  const lectureId = 1;
  const { confusionAlert, lastAnalogy, currentTopic, latencyBadge } = useRadarData(lectureId);
  const { connected } = useWebSocket(lectureId, "teacher");
  const lastAlertRef = useRef<string | null>(null);

  const currentAlert = confusionAlert ?? null;
  const lostCount = currentAlert?.count ?? 0;

  const handleTriggerAnalogy = useCallback(async () => {
    const alert = confusionAlert;
    if (!alert) return;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      await fetch(`${baseUrl}/retrieval/accio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecture_id: lectureId,
          concept_node: alert.concept_node,
          chunk_text: alert.concept_node,
          avatar: "cricketer",
        }),
      });
    } catch (e) {
      console.error("[Overlay] trigger analogy failed:", e);
    }
  }, [confusionAlert, lectureId]);

  useEffect(() => {
    if (confusionAlert && confusionAlert.concept_node !== lastAlertRef.current) {
      lastAlertRef.current = confusionAlert.concept_node;
      handleTriggerAnalogy();
    }
  }, [confusionAlert]);

  return (
    <div style={styles.root}>
      <div style={styles.statusBar}>
        <span style={{
          ...styles.led,
          background: connected ? "#10B981" : "#EF4444",
          boxShadow: connected
            ? "0 0 6px #10B981" : "0 0 6px #EF4444",
        }} />
        <span style={styles.statusText}>
          {connected ? "WS LIVE" : "OFFLINE"}
        </span>
        {currentTopic && (
          <>
            <span style={styles.separator}>|</span>
            <span style={styles.topic}>{currentTopic.replace(/_/g, " ")}</span>
          </>
        )}
      </div>

      <ConfusionOverlay
        conceptNode={
          currentAlert?.concept_node ||
          lastAnalogy?.concept_node ||
          currentTopic ||
          "Listening..."
        }
        lostCount={lostCount}
        totalStudents={20}
        lastAnalogy={lastAnalogy?.analogy_text}
        onTriggerAnalogy={handleTriggerAnalogy}
        visible={true}
        onClose={() => window.close()}
      />

      <LatencyBadge badge={latencyBadge} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "transparent",
    fontFamily: '"Inter", system-ui, sans-serif',
    position: "relative",
  },
  statusBar: {
    position: "fixed",
    bottom: "1.5rem",
    left: "1.5rem",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "rgba(26, 15, 46, 0.85)",
    border: "1px solid rgba(211, 166, 37, 0.3)",
    borderRadius: "20px",
    padding: "0.4rem 0.8rem",
    fontSize: "0.7rem",
    backdropFilter: "blur(8px)",
  },
  led: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  statusText: {
    color: "#d3a625",
    fontWeight: 700,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "0.65rem",
    letterSpacing: "0.08em",
  },
  separator: {
    color: "rgba(211, 166, 37, 0.4)",
    margin: "0 0.1rem",
  },
  topic: {
    color: "#c4b5fd",
    fontWeight: 500,
    fontSize: "0.65rem",
    maxWidth: 160,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
