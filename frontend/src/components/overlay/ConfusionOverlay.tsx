"use client";

import React, { useRef, useState, useEffect } from "react";
import { useOverlayState } from "@/hooks/useOverlayState";

interface ConfusionOverlayProps {
  conceptNode: string;
  lostCount: number;
  totalStudents: number;
  lastAnalogy?: string;
  onTriggerAnalogy: () => void;
  visible: boolean;
  onClose: () => void;
}

export function ConfusionOverlay({
  conceptNode,
  lostCount,
  totalStudents,
  lastAnalogy,
  onTriggerAnalogy,
  visible,
  onClose
}: ConfusionOverlayProps) {
  const { position, setPosition, opacity, setOpacity } = useOverlayState();
  const [minimized, setMinimized] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const confusionPercent = totalStudents > 0 ? (lostCount / totalStudents) * 100 : 0;
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, setPosition]);

  if (!visible) return null;

  return (
    <div
      style={{
        ...styles.overlay,
        left: position.x,
        top: position.y,
        opacity: opacity,
        transform: `scale(${visible ? 1 : 0.8})`,
      }}
    >
      <div 
        ref={dragRef}
        style={styles.header}
        onMouseDown={(e) => {
          setIsDragging(true);
          setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
          });
        }}
      >
        <span style={styles.title}>🔮 Legilimens</span>
        <div style={styles.controls}>
          <button style={styles.iconBtn} onClick={() => setMinimized(!minimized)}>
            {minimized ? "🔽" : "🔼"}
          </button>
          <button style={styles.iconBtn} onClick={onClose}>✖</button>
        </div>
      </div>
      
      {!minimized ? (
        <div style={styles.content}>
          <div style={styles.gaugeContainer}>
             <svg width="60" height="60" viewBox="0 0 36 36" style={styles.gaugeSvg}>
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={confusionPercent > 50 ? "#dc2626" : "var(--gryffindor-gold, #c9a84c)"}
                strokeWidth="3"
                strokeDasharray={`${confusionPercent}, 100`}
              />
            </svg>
            <div style={styles.gaugeText}>{Math.round(confusionPercent)}%</div>
          </div>
          
          <div style={styles.info}>
            <p style={styles.concept}>{conceptNode.replace(/_/g, " ")}</p>
            <p style={styles.lostText}>⚡ {lostCount} students lost</p>
          </div>
          
          <button style={styles.triggerBtn} onClick={onTriggerAnalogy}>
            Trigger Analogy
          </button>
          
          {lastAnalogy && (
            <div style={styles.analogyCard}>
              <p style={styles.analogyText}>{lastAnalogy}</p>
            </div>
          )}
          
          <div style={styles.sliderContainer}>
             <label style={styles.sliderLabel}>Opacity</label>
             <input 
               type="range" 
               min="40" 
               max="100" 
               value={opacity * 100} 
               onChange={(e) => setOpacity(Number(e.target.value) / 100)}
               style={styles.slider}
             />
          </div>
        </div>
      ) : (
        <div style={{...styles.content, display: 'flex', justifyContent: 'center', padding: '0.5rem'}}>
          <div style={styles.gaugeTextSmall}>{Math.round(confusionPercent)}%</div>
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed" as const,
    width: "300px",
    background: "rgba(10, 14, 26, 0.85)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(201, 168, 76, 0.3)",
    borderRadius: "16px",
    boxShadow: "0 0 20px rgba(201, 168, 76, 0.15)",
    color: "white",
    zIndex: 9999,
    transition: "opacity 0.2s, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
  header: {
    padding: "0.75rem 1rem",
    background: "rgba(0,0,0,0.2)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "grab",
    borderTopLeftRadius: "16px",
    borderTopRightRadius: "16px",
  },
  title: {
    fontWeight: "bold",
    color: "var(--gryffindor-gold, #c9a84c)",
    fontSize: "0.9rem",
  },
  controls: {
    display: "flex",
    gap: "0.5rem",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontSize: "0.8rem",
    opacity: 0.7,
  },
  content: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  gaugeContainer: {
    position: "relative" as const,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  gaugeSvg: {
    transform: "rotate(-90deg)",
  },
  gaugeText: {
    position: "absolute" as const,
    fontSize: "1rem",
    fontWeight: "bold",
  },
  gaugeTextSmall: {
    fontSize: "1.2rem",
    fontWeight: "bold",
    color: "var(--gryffindor-gold, #c9a84c)",
  },
  info: {
    textAlign: "center" as const,
  },
  concept: {
    margin: 0,
    fontWeight: "bold",
    color: "var(--gryffindor-gold, #c9a84c)",
    fontSize: "1.1rem",
    textTransform: "capitalize" as const,
  },
  lostText: {
    margin: "0.25rem 0 0 0",
    color: "#ff8a8a",
    fontSize: "0.9rem",
  },
  triggerBtn: {
    background: "linear-gradient(135deg, rgba(201, 168, 76, 0.2), rgba(124, 58, 237, 0.2))",
    border: "1px solid rgba(201, 168, 76, 0.5)",
    color: "white",
    padding: "0.75rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "all 0.2s",
  },
  analogyCard: {
    background: "rgba(255,255,255,0.05)",
    padding: "0.75rem",
    borderRadius: "8px",
    borderLeft: "2px solid #7c3aed",
  },
  analogyText: {
    margin: 0,
    fontSize: "0.8rem",
    fontStyle: "italic",
    opacity: 0.9,
  },
  sliderContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginTop: "0.5rem",
  },
  sliderLabel: {
    fontSize: "0.7rem",
    opacity: 0.6,
  },
  slider: {
    flex: 1,
  }
};
