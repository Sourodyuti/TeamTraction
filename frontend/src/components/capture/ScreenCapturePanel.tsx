"use client";

import { useEffect, useState } from "react";
import { useScreenCapture } from "@/hooks/useScreenCapture";

interface ScreenCapturePanelProps {
  lectureId: number;
  captureState: ReturnType<typeof useScreenCapture>;
  currentTopic?: string | null;
}

export function ScreenCapturePanel({ lectureId, captureState, currentTopic }: ScreenCapturePanelProps) {
  const {
    startCapture,
    stopCapture,
    videoRef,
    isCapturing,
    startRecording,
    stopRecording,
    recordingStatus
  } = captureState;

  const topicDisplay = currentTopic ? currentTopic.replace(/_/g, " ") : "Waiting for transcription...";

  const handleShare = async () => {
    try {
      await startCapture();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🎥 Screen Share</h3>
      </div>
      
      {!isCapturing ? (
        <button style={styles.shareButton} onClick={handleShare}>
          <span style={styles.icon}>🖥️</span> Share Screen
        </button>
      ) : (
        <div style={styles.activeContainer}>
          <div style={styles.videoWrapper}>
            <video
              ref={videoRef}
              autoPlay
              muted
              style={styles.video}
            />
          </div>
          
          <div style={styles.controls}>
            {recordingStatus === 'idle' && (
              <button style={styles.recordButton} onClick={() => startRecording(lectureId)}>
                Start Recording
              </button>
            )}
            {recordingStatus === 'recording' && (
              <div style={styles.recordingBadge}>
                <span style={styles.pulse}>🔴</span> Recording
              </div>
            )}
            <button style={styles.stopButton} onClick={stopCapture}>
              Stop
            </button>
          </div>
          
          <div style={styles.topicBox}>
            <p style={styles.topicLabel}>Current Topic:</p>
            <p style={styles.topicValue}>{topicDisplay}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: "rgba(10, 14, 26, 0.7)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(201, 168, 76, 0.2)",
    borderRadius: "16px",
    padding: "1.5rem",
    color: "white",
  },
  header: {
    marginBottom: "1rem",
  },
  title: {
    margin: 0,
    color: "var(--gryffindor-gold)",
    fontSize: "1.2rem",
  },
  shareButton: {
    width: "100%",
    padding: "1rem",
    background: "transparent",
    border: "2px solid var(--gryffindor-gold)",
    color: "var(--gryffindor-gold)",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "1.1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    transition: "all 0.2s",
  },
  icon: {
    fontSize: "1.5rem",
  },
  activeContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  videoWrapper: {
    width: "100%",
    maxHeight: "200px",
    borderRadius: "8px",
    overflow: "hidden",
    background: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
  },
  controls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
  },
  recordButton: {
    flex: 1,
    padding: "0.5rem",
    background: "rgba(220, 38, 38, 0.2)",
    border: "1px solid #dc2626",
    color: "#ff8a8a",
    borderRadius: "8px",
    cursor: "pointer",
  },
  stopButton: {
    padding: "0.5rem 1rem",
    background: "rgba(255, 255, 255, 0.1)",
    border: "none",
    color: "white",
    borderRadius: "8px",
    cursor: "pointer",
  },
  recordingBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "#ff8a8a",
    fontWeight: "bold",
  },
  pulse: {
    animation: "pulse 1.5s infinite",
  },
  topicBox: {
    background: "rgba(255,255,255,0.05)",
    padding: "0.75rem",
    borderRadius: "8px",
  },
  topicLabel: {
    margin: 0,
    fontSize: "0.8rem",
    opacity: 0.7,
  },
  topicValue: {
    margin: "0.25rem 0 0 0",
    color: "var(--magic-purple, #7c3aed)",
    fontWeight: "bold",
  }
};
