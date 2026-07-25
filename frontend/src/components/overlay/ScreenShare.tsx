"use client";

import { useScreenShare } from "@/hooks/useScreenShare";
import styles from "./ScreenShare.module.css";

interface ScreenShareProps {
  onStreamReady?: (stream: MediaStream) => void;
  onContextDetected?: (context: { concept_node: string; slide_text: string }) => void;
}

export function ScreenShare({ onStreamReady, onContextDetected }: ScreenShareProps) {
  const { isSharing, stream, startShare, stopShare, videoRef, error } = useScreenShare();

  if (isSharing && stream) {
    onStreamReady?.(stream);
  }

  return (
    <div className={styles.container}>
      {!isSharing ? (
        <div className={styles.startPanel}>
          <h3 className={styles.title}>Share Your Lecture Window</h3>
          <p className={styles.description}>
            Select the window showing your lecture slides. Students will see 
            this content with overlay alerts.
          </p>
          <button className={styles.btnShare} onClick={startShare}>
            📺 Share Window
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      ) : (
        <div className={styles.preview}>
          <div className={styles.header}>
            <span className={styles.badge}>🔴 Live</span>
            <span className={styles.status}>Sharing lecture window</span>
            <button className={styles.btnStop} onClick={stopShare}>
              Stop Sharing
            </button>
          </div>
          <div className={styles.videoContainer}>
            <video 
              ref={videoRef}
              className={styles.video}
              autoPlay
              playsInline
              muted
            />
            <div className={styles.overlay}>
              <div className={styles.hint}>
                Students see your lecture with overlay alerts
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
