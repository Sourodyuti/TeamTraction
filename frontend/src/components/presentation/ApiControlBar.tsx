"use client";

import React, { useState, useEffect } from "react";

interface ApiControlBarProps {
  onKeysChanged: (geminiKey: string, elevenKey: string) => void;
  onThemeToggle?: (isDark: boolean) => void;
  onSimulateWave?: () => void;
}

export function ApiControlBar({ onKeysChanged, onThemeToggle, onSimulateWave }: ApiControlBarProps) {
  const [geminiKey, setGeminiKey] = useState("");
  const [elevenKey, setElevenKey] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Client AI Mode Active");

  useEffect(() => {
    const savedGemini = localStorage.getItem("legilimens_gemini_key") || "";
    const savedEleven = localStorage.getItem("legilimens_eleven_key") || "";
    setGeminiKey(savedGemini);
    setElevenKey(savedEleven);
    if (savedGemini || savedEleven) {
      onKeysChanged(savedGemini, savedEleven);
      setStatusMsg("Cloud API Keys Connected");
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("legilimens_gemini_key", geminiKey);
    localStorage.setItem("legilimens_eleven_key", elevenKey);
    onKeysChanged(geminiKey, elevenKey);
    setStatusMsg(geminiKey || elevenKey ? "API Keys Updated" : "Offline Demo Mode");
    setIsExpanded(false);
  };

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    onThemeToggle?.(nextDark);
    if (nextDark) {
      document.body.classList.add("dark-magic");
      document.body.classList.remove("light-parchment");
    } else {
      document.body.classList.add("light-parchment");
      document.body.classList.remove("dark-magic");
    }
  };

  return (
    <div style={styles.headerBar}>
      <div style={styles.brandGroup}>
        <span style={styles.wandIcon}>🔮</span>
        <span style={styles.brandTitle}>LEGILIMENS</span>
        <span style={styles.badgePill}>{statusMsg}</span>
      </div>

      <div style={styles.actionGroup}>
        {onSimulateWave && (
          <button
            onClick={onSimulateWave}
            style={styles.simulateBtn}
            title="Simulate 40% student confusion wave"
          >
            ⚡ Trigger Confusion Wave
          </button>
        )}

        <button onClick={handleToggleTheme} style={styles.themeBtn}>
          {isDark ? "📜 Light Parchment" : "🌙 Midnight Magic"}
        </button>

        <button onClick={() => setIsExpanded(!isExpanded)} style={styles.keysBtn}>
          🔑 Configure Keys
        </button>
      </div>

      {isExpanded && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>✨ Presentation API Configuration</h3>
              <button onClick={() => setIsExpanded(false)} style={styles.closeBtn}>×</button>
            </div>
            <p style={styles.modalText}>
              Input your <b>Gemini 1.5 Flash</b> and <b>ElevenLabs</b> keys for live real-time audio synthesis.
              If left empty, Legilimens runs in deterministic fallback mode so your judge presentation <b>never fails</b>.
            </p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Gemini API Key (Gemino Analogy Rewrite):</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>ElevenLabs API Key (Sonorus Voice Synthesis):</label>
              <input
                type="password"
                value={elevenKey}
                onChange={(e) => setElevenKey(e.target.value)}
                placeholder="sk_..."
                style={styles.input}
              />
            </div>

            <div style={styles.modalFooter}>
              <button onClick={handleSave} style={styles.saveBtn}>Save & Connect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerBar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "54px",
    background: "rgba(253, 251, 247, 0.92)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(212, 175, 55, 0.35)",
    boxShadow: "0 2px 15px rgba(212, 175, 55, 0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1.25rem",
    zIndex: 9999,
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  wandIcon: {
    fontSize: "1.2rem",
  },
  brandTitle: {
    fontFamily: '"Cinzel", serif',
    fontWeight: 700,
    fontSize: "1.1rem",
    letterSpacing: "0.1em",
    color: "#7A1C1C",
  },
  badgePill: {
    fontFamily: '"Inter", sans-serif',
    fontSize: "0.72rem",
    fontWeight: 600,
    background: "rgba(212, 175, 55, 0.18)",
    color: "#8B6B1B",
    border: "1px solid rgba(212, 175, 55, 0.4)",
    padding: "0.2rem 0.6rem",
    borderRadius: "20px",
  },
  actionGroup: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  simulateBtn: {
    fontFamily: '"Cinzel", serif',
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#FFFFFF",
    background: "linear-gradient(135deg, #7A1C1C 0%, #B22222 100%)",
    border: "1px solid #D4AF37",
    padding: "0.45rem 0.9rem",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(122, 28, 28, 0.25)",
  },
  themeBtn: {
    fontFamily: '"Inter", sans-serif',
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#5C4033",
    background: "rgba(212, 175, 55, 0.15)",
    border: "1px solid rgba(212, 175, 55, 0.35)",
    padding: "0.45rem 0.8rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  keysBtn: {
    fontFamily: '"Inter", sans-serif',
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#7A1C1C",
    background: "#F5E6C8",
    border: "1px solid #D4AF37",
    padding: "0.45rem 0.8rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(26, 15, 46, 0.65)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
  },
  modalCard: {
    width: "480px",
    background: "#FDFBF7",
    border: "2px solid #D4AF37",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  modalTitle: {
    fontFamily: '"Cinzel", serif',
    color: "#7A1C1C",
    fontSize: "1.15rem",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "1.5rem",
    color: "#8B6B1B",
    cursor: "pointer",
  },
  modalText: {
    fontSize: "0.85rem",
    color: "#5C4033",
    lineHeight: 1.4,
    marginBottom: "1rem",
  },
  inputGroup: {
    marginBottom: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  label: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#7A1C1C",
  },
  input: {
    padding: "0.6rem",
    borderRadius: "6px",
    border: "1px solid #D4AF37",
    background: "#FFF8EA",
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "0.85rem",
    color: "#2C1A04",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "1.2rem",
  },
  saveBtn: {
    fontFamily: '"Cinzel", serif',
    fontWeight: 700,
    color: "#1A0F2E",
    background: "linear-gradient(135deg, #F0D57A 0%, #D4AF37 100%)",
    border: "1px solid #B8941F",
    padding: "0.6rem 1.2rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
};
