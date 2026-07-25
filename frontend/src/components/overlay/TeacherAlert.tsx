"use client";

import { useState } from "react";
import { useRadarData } from "@/hooks/useRadarData";
import { useScreenShare } from "@/hooks/useScreenShare";
import styles from "./TeacherAlert.module.css";

interface ConfusionAlert {
  concept_node: string;
  count: number;
  recommendation: string;
  audio_url?: string;
}

interface TeacherAlertProps {
  lectureId: number;
  onReexplain?: (concept: string) => void;
  onContinue?: () => void;
}

export function TeacherAlert({ lectureId, onReexplain, onContinue }: TeacherAlertProps) {
  const [alert, setAlert] = useState<ConfusionAlert | null>(null);
  const { conceptNodes, latencyMs } = useRadarData(lectureId);

  const handleDismissAlert = () => {
    setAlert(null);
    onContinue?.();
  };

  const handleReexplain = () => {
    if (alert) {
      onReexplain?.(alert.concept_node);
      setAlert(null);
    }
  };

  return (
    <div className={styles.container}>
      {alert && (
        <div className={styles.alertOverlay}>
          <div className={styles.alertCard}>
            <div className={styles.alertIcon}>⚠️</div>
            <h3 className={styles.alertTitle}>
              {alert.count} students lost on "{alert.concept_node}"
            </h3>
            <p className={styles.alertRecommendation}>{alert.recommendation}</p>
            <div className={styles.alertActions}>
              <button 
                className={styles.btnPrimary}
                onClick={handleReexplain}
              >
                Re-explain with Analogy
              </button>
              <button 
                className={styles.btnSecondary}
                onClick={handleDismissAlert}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.statusBar}>
        <div className={styles.radarMini}>
          {conceptNodes.slice(0, 5).map((node, i) => (
            <div 
              key={node.id}
              className={styles.radarDot}
              data-active={node.confusion > 0.3}
              style={{ 
                backgroundColor: node.confusion > 0.5 ? "#ef4444" : 
                                 node.confusion > 0.3 ? "#f59e0b" : "#10b981"
              }}
              title={node.label}
            />
          ))}
        </div>
        <div className={styles.latencyBadge}>
          <span className={styles.latencyValue}>
            {latencyMs ? `${Math.round(latencyMs)}ms` : "—"}
          </span>
          <span className={styles.latencyLabel}>retrieval</span>
        </div>
      </div>
    </div>
  );
}
