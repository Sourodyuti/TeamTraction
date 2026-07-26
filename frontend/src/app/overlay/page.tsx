"use client";

import { ConfusionOverlay } from "@/components/overlay/ConfusionOverlay";
import { LatencyBadge } from "@/components/overlay/LatencyBadge";
import { useRadarData } from "@/hooks/useRadarData";

export default function OverlayPage() {
  const lectureId = 1;
  const { confusionAlert, lastAnalogy, currentTopic, latencyBadge } = useRadarData(lectureId);

  const currentAlert = confusionAlert ?? null;
  const lostCount = currentAlert?.count ?? 0;

  const handleTriggerAnalogy = async () => {
    if (!currentAlert) return;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${baseUrl}/retrieval/accio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecture_id: lectureId,
          concept_node: currentAlert.concept_node,
          chunk_text: currentAlert.concept_node,
          avatar: "cricketer",
        }),
      });
    } catch (e) {
      console.error("[Overlay] trigger analogy failed:", e);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "transparent" }}>
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
