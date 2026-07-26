"use client";

import { useEffect, useRef } from "react";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import styles from "./ScreenShare.module.css";

interface ScreenShareProps {
  onStreamReady?: (stream: MediaStream) => void;
  onContextDetected?: (context: { topic_node: string; comprehensive_summary: string; key_terms: string[] }) => void;
}

export function ScreenShare({ onStreamReady, onContextDetected }: ScreenShareProps) {
  const { isCapturing, stream, startCapture, stopCapture, videoRef, recordingStatus } = useScreenCapture(onContextDetected);
  const streamReadyFired = useRef(false);

  useEffect(() => {
    if (isCapturing && stream && !streamReadyFired.current) {
      streamReadyFired.current = true;
      onStreamReady?.(stream);
    }
    if (!isCapturing) {
      streamReadyFired.current = false;
    }
  }, [isCapturing, stream, onStreamReady]);

  const error = recordingStatus === "error" ? "Screen capture failed" : null;

  return (
    <div className={styles.container}>
      {!isCapturing ? (
        <div className={styles.startPanel}>
          <h3 className={styles.title}>Share Your Lecture Window</h3>
          <p className={styles.description}>
            Select the window showing your lecture slides. Students will see 
            this content with overlay alerts.
          </p>
          <button className={styles.btnShare} onClick={startCapture}>
            📺 Share Window
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      ) : (
        <div className={styles.preview}>
          <div className={styles.header}>
            <span className={styles.badge}>🔴 Live</span>
            <span className={styles.status}>Sharing lecture window</span>
            <button className={styles.btnStop} onClick={stopCapture}>
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
