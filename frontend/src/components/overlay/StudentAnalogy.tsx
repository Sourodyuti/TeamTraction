"use client";

import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { InterestAvatar } from "@/lib/types";
import styles from "./StudentAnalogy.module.css";

interface AnalogyData {
  concept_node: string;
  analogy_text: string;
  audio_url?: string;
}

interface StudentAnalogyProps {
  lectureId: number;
  studentId: string;
  avatar?: InterestAvatar;
}

export function StudentAnalogy({ lectureId, studentId, avatar = InterestAvatar.CRICKETER }: StudentAnalogyProps) {
  const [analogy, setAnalogy] = useState<AnalogyData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const { sendPing, connected } = useWebSocket(lectureId);

  const handleListen = async () => {
    if (analogy?.audio_url) {
      setIsPlaying(true);
      const audio = new Audio(analogy.audio_url);
      await audio.play();
      audio.onended = () => setIsPlaying(false);
    } else if (analogy?.analogy_text) {
      setIsPlaying(true);
      const ttsUrl = `/retrieval/accio-tts?text=${encodeURIComponent(analogy.analogy_text)}`;
      const audio = new Audio(ttsUrl);
      await audio.play();
      audio.onended = () => setIsPlaying(false);
    }
  };

  const handleSave = () => {
    if (analogy) {
      const notes = JSON.parse(localStorage.getItem("legilimens_notes") || "[]");
      notes.push({
        ...analogy,
        savedAt: new Date().toISOString(),
        avatar,
      });
      localStorage.setItem("legilimens_notes", JSON.stringify(notes));
      setSaved(true);
    }
  };

  const handleGotIt = () => {
    sendPing({
      student_id: studentId,
      signal_type: "gotit" as any,
      ts: new Date().toISOString(),
    });
    setAnalogy(null);
    setSaved(false);
  };

  const handleLost = () => {
    sendPing({
      student_id: studentId,
      signal_type: "lost" as any,
      ts: new Date().toISOString(),
    });
  };

  if (analogy) {
    return (
      <div className={styles.overlay}>
        <div className={styles.analogyCard}>
          <div className={styles.header}>
            <span className={styles.icon}>🎯</span>
            <h3 className={styles.title}>
              {analogy.concept_node.replace(/_/g, " ")} — {avatar} Analogy
            </h3>
          </div>
          <p className={styles.text}>{analogy.analogy_text}</p>
          <div className={styles.actions}>
            <button 
              className={styles.btnListen}
              onClick={handleListen}
              disabled={isPlaying}
            >
              {isPlaying ? "🔊 Playing..." : "🔊 Listen"}
            </button>
            <button 
              className={styles.btnSecondary}
              onClick={handleSave}
              disabled={saved}
            >
              {saved ? "✓ Saved" : "📝 Save to Notes"}
            </button>
            <button 
              className={styles.btnGotIt}
              onClick={handleGotIt}
            >
              ✓ Got it now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.controls}>
      <div className={styles.signalButtons}>
        <button 
          className={styles.btnLost}
          onClick={handleLost}
          disabled={!connected}
        >
          🪄 I&apos;m lost
        </button>
        <button 
          className={styles.btnGotItInline}
          onClick={handleGotIt}
          disabled={!connected}
        >
          ✅ Got it
        </button>
        <button 
          className={styles.btnSlower}
          onClick={() => sendPing({
            student_id: studentId,
            signal_type: "slower" as any,
            ts: new Date().toISOString(),
          })}
          disabled={!connected}
        >
          ⏩ Slower
        </button>
      </div>
      <div className={styles.avatarSelect}>
        <label>Your interest:</label>
        <select className={styles.avatarDropdown}>
          <option value="cricketer">🏏 Cricketer</option>
          <option value="gamer">🎮 Gamer</option>
          <option value="cook">👨‍🍳 Cook</option>
        </select>
      </div>
      <div className={styles.connection}>
        {connected ? "🟢 Connected" : "🔴 Connecting..."}
      </div>
    </div>
  );
}
