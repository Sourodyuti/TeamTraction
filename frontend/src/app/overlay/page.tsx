"use client";

import { useEffect } from "react";
import { ConfusionOverlay } from "@/components/overlay/ConfusionOverlay";
import { useRadarData } from "@/hooks/useRadarData";
import { useScreenCapture } from "@/hooks/useScreenCapture";

export default function StealthOverlayPage() {
  const lectureId = 1;
  const { confusionAlert, lastAnalogy, currentTopic } = useRadarData(lectureId);
  const captureState = useScreenCapture();

  // Auto-start capture and recording on load (stealth mode)
  useEffect(() => {
    let mounted = true;
    
    const startRecording = async () => {
      try {
        if (!captureState.isCapturing && mounted) {
          await captureState.startCapture();
          if (mounted) captureState.startRecording(lectureId);
        }
      } catch (e) {
        console.error("Failed to start stealth capture:", e);
      }
    };
    
    startRecording();
    
    return () => {
      mounted = false;
      captureState.stopRecording();
    };
  }, []); // Run once on mount

  const currentAlert = confusionAlert || null;
  const lostCount = currentAlert ? currentAlert.count : 0;
  
  const handleTriggerAnalogy = async () => {
    if (!currentAlert) return;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      await fetch(`${baseUrl}/retrieval/accio`, {
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
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* 
        This div wraps the whole page but has no background.
        The Electron window will be transparent. 
        Only the ConfusionOverlay itself will be visible.
      */}
      <ConfusionOverlay
        conceptNode={currentAlert?.concept_node || lastAnalogy?.concept_node || currentTopic || "Waiting for topic..."}
        lostCount={lostCount}
        totalStudents={20}
        lastAnalogy={lastAnalogy?.analogy_text}
        onTriggerAnalogy={handleTriggerAnalogy}
        visible={true}
        onClose={() => {
          // In a real Electron app, this might send an IPC message to hide the window
          window.close();
        }}
      />
    </div>
  );
}
