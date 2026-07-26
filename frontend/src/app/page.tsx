"use client";

import React, { useState, useEffect, useRef } from "react";
import { ApiControlBar } from "@/components/presentation/ApiControlBar";
import { executeDemoPipeline, AnalogyResponse } from "@/services/aiServices";
import { LatencyBadge } from "@/components/overlay/LatencyBadge";

interface ConceptNode {
  id: string;
  label: string;
  confusion: number;
  x: number;
  y: number;
}

const INITIAL_CONCEPTS: ConceptNode[] = [
  { id: "chain_rule", label: "Chain Rule Calculus", confusion: 0.85, x: 220, y: 150 },
  { id: "backprop", label: "Backpropagation", confusion: 0.65, x: 140, y: 220 },
  { id: "activation", label: "Activation Functions", confusion: 0.25, x: 300, y: 240 },
  { id: "loss_func", label: "Loss Function (MSE)", confusion: 0.15, x: 180, y: 90 },
  { id: "gradient_descent", label: "Gradient Descent", confusion: 0.40, x: 280, y: 110 },
];

const INTEREST_AVATARS = [
  { id: "cricketer", label: "🏏 Cricketer", color: "#D4AF37" },
  { id: "gamer", label: "🎮 Gamer", color: "#8A2BE2" },
  { id: "musician", label: "🎵 Musician", color: "#FF6B35" },
  { id: "chef", label: "🍳 Chef", color: "#10B981" },
  { id: "anime", label: "⚡ Anime Fan", color: "#EC4899" },
];

export default function PresentationPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [elevenKey, setElevenKey] = useState("");
  const [selectedInterest, setSelectedInterest] = useState("cricketer");
  const [concepts, setConcepts] = useState<ConceptNode[]>(INITIAL_CONCEPTS);
  const [totalStudents] = useState(20);
  const [lostCount, setLostCount] = useState(8);
  const [activeConcept, setActiveConcept] = useState("chain_rule");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [analogyResult, setAnalogyResult] = useState<AnalogyResponse | null>({
    analogyText:
      "The chain rule is like a relay of fielders passing the ball back to the wicketkeeper: every fielder's position multiplies the effect of the bowler's original delivery.",
    latencyBadge: {
      type: "latency_badge",
      lecture_id: 1,
      concept_node: "chain_rule",
      ts: new Date().toISOString(),
      embedding_ms: 8,
      retrieval_ms: 12,
      gemini_ms: 145,
      elevenlabs_ms: 180,
      total_ms: 345,
    },
    source: "cached-simulation",
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleKeysChanged = (gKey: string, eKey: string) => {
    setGeminiKey(gKey);
    setElevenKey(eKey);
  };

  const handleTriggerAnalogy = async (conceptId: string = activeConcept) => {
    setIsGenerating(true);
    const targetConceptObj = concepts.find((c) => c.id === conceptId);
    const conceptLabel = targetConceptObj ? targetConceptObj.label : conceptId;

    try {
      const res = await executeDemoPipeline({
        concept: conceptId,
        originalText: `In backpropagation, the derivative of loss with respect to weight relies on multiplying partial derivatives along the computational graph layer by layer: dL/dw = (dL/dy) * (dy/dz) * (dz/dw).`,
        studentInterest: selectedInterest,
        geminiApiKey: geminiKey,
        elevenLabsApiKey: elevenKey,
      });

      setAnalogyResult(res);

      if (res.audioUrl) {
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(res.audioUrl);
        audioRef.current = audio;
        audio.onplay = () => setIsPlayingAudio(true);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
        audio.play().catch(() => setIsPlayingAudio(false));
      }
    } catch (err) {
      console.error("[Demo Pipeline] error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSimulateWave = () => {
    setLostCount((prev) => (prev >= 16 ? 4 : prev + 4));
    setConcepts((prev) =>
      prev.map((c) =>
        c.id === "chain_rule"
          ? { ...c, confusion: Math.min(1.0, c.confusion + 0.15) }
          : c
      )
    );
    handleTriggerAnalogy("chain_rule");
  };

  const handleStudentPing = () => {
    setLostCount((prev) => Math.min(totalStudents, prev + 1));
    handleTriggerAnalogy(activeConcept);
  };

  return (
    <main style={styles.pageContainer}>
      {/* Top Header Bar with API Keys and Theme Controls */}
      <ApiControlBar
        onKeysChanged={handleKeysChanged}
        onSimulateWave={handleSimulateWave}
      />

      {/* Main Presentation Grid */}
      <div style={styles.gridContainer}>
        {/* Left Column: Marauder's Confusion Radar */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={styles.cardIcon}>🧭</span>
              <h2 style={styles.cardTitle}>Marauder's Confusion Radar</h2>
            </div>
            <span style={styles.liveTag}>LIVE • ACTIAN VECTORAI DB ON-PREM</span>
          </div>

          {/* D3 Radial Radar View */}
          <div style={styles.radarBox}>
            <svg width="360" height="280" viewBox="0 0 400 300">
              {/* Radar Grid Circles */}
              <circle cx="200" cy="150" r="120" fill="none" stroke="rgba(212, 175, 55, 0.2)" strokeDasharray="4 4" />
              <circle cx="200" cy="150" r="80" fill="none" stroke="rgba(212, 175, 55, 0.25)" strokeDasharray="4 4" />
              <circle cx="200" cy="150" r="40" fill="none" stroke="rgba(212, 175, 55, 0.3)" />
              <line x1="80" y1="150" x2="320" y2="150" stroke="rgba(212, 175, 55, 0.2)" />
              <line x1="200" y1="30" x2="200" y2="270" stroke="rgba(212, 175, 55, 0.2)" />

              {/* Concept Nodes */}
              {concepts.map((node) => {
                const isSelected = node.id === activeConcept;
                const nodeColor =
                  node.confusion > 0.6
                    ? "#DC143C"
                    : node.confusion > 0.3
                    ? "#FFBF00"
                    : "#50C878";

                return (
                  <g
                    key={node.id}
                    onClick={() => {
                      setActiveConcept(node.id);
                      handleTriggerAnalogy(node.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glowing pulse ring if confused */}
                    {node.confusion > 0.5 && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={22}
                        fill="rgba(220, 20, 60, 0.2)"
                        className="pulse-ring"
                      >
                        <animate
                          attributeName="r"
                          values="14;28;14"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.6;0.1;0.6"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isSelected ? 14 : 10}
                      fill={nodeColor}
                      stroke={isSelected ? "#D4AF37" : "#FFFFFF"}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />

                    <text
                      x={node.x}
                      y={node.y + 24}
                      textAnchor="middle"
                      fill="#5C4033"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="Inter, sans-serif"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Stats Bar */}
          <div style={styles.statsRow}>
            <div style={styles.statBox}>
              <span style={styles.statNumber}>{lostCount}/{totalStudents}</span>
              <span style={styles.statLabel}>Students Lost</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statNumber}>{Math.round((lostCount / totalStudents) * 100)}%</span>
              <span style={styles.statLabel}>Confusion Spike</span>
            </div>
            <div style={styles.statBox}>
              <span style={{ ...styles.statNumber, color: "#7A1C1C" }}>{activeConcept}</span>
              <span style={styles.statLabel}>Target Concept</span>
            </div>
          </div>
        </section>

        {/* Right Column: Accio Analogy + Gemino AI Pipeline */}
        <section style={{ ...styles.card, flex: 1 }}>
          <div style={styles.cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={styles.cardIcon}>✨</span>
              <h2 style={styles.cardTitle}>Accio Analogy & Gemino AI Engine</h2>
            </div>
            <span style={styles.spellTag}>SPELL 03 • RETRIEVAL + REWRITE</span>
          </div>

          {/* Student Interest Graph Selector */}
          <div style={styles.interestSection}>
            <label style={styles.sectionLabel}>Student Interest Graph Profile:</label>
            <div style={styles.interestPills}>
              {INTEREST_AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedInterest(avatar.id)}
                  style={{
                    ...styles.interestBtn,
                    background:
                      selectedInterest === avatar.id
                        ? "linear-gradient(135deg, #7A1C1C 0%, #990000 100%)"
                        : "#FFF8EA",
                    color: selectedInterest === avatar.id ? "#FFFFFF" : "#5C4033",
                    borderColor: selectedInterest === avatar.id ? "#D4AF37" : "rgba(212, 175, 55, 0.4)",
                  }}
                >
                  {avatar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Analogy Output Banner */}
          <div style={styles.analogyBox}>
            <div style={styles.analogyMeta}>
              <span style={styles.analogyConcept}>
                ⚡ Concept: <b>{activeConcept}</b> → Tailored for <b>{selectedInterest.toUpperCase()}</b>
              </span>
              <span style={styles.sourceTag}>{analogyResult?.source || "AI Generated"}</span>
            </div>

            <p style={styles.analogyText}>
              {isGenerating ? "🔮 Gemino is rewriting analogy in real-time..." : analogyResult?.analogyText}
            </p>

            {/* Sonorus Audio Player Controls */}
            <div style={styles.audioRow}>
              <button
                onClick={() => handleTriggerAnalogy(activeConcept)}
                disabled={isGenerating}
                style={styles.generateBtn}
              >
                {isGenerating ? "✨ Generating..." : "⚡ Generate & Speak Analogy"}
              </button>

              {isPlayingAudio && (
                <div style={styles.audioWave}>
                  <span style={styles.waveBar}></span>
                  <span style={styles.waveBar}></span>
                  <span style={styles.waveBar}></span>
                  <span style={styles.waveBar}></span>
                  <span style={{ fontSize: "0.8rem", color: "#D4AF37", fontWeight: 600 }}>
                    🔊 Sonorus Speaking...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Latency Badge breakdown */}
          {analogyResult?.latencyBadge && (
            <div style={styles.badgeWrapper}>
              <LatencyBadge badge={analogyResult.latencyBadge} />
            </div>
          )}
        </section>
      </div>

      {/* Bottom Row: Muffliato Student Ping Bar (Interactive Presentation Control) */}
      <footer style={styles.footerBar}>
        <div style={styles.muffliatoGroup}>
          <span style={styles.muffliatoIcon}>📱</span>
          <span style={styles.muffliatoText}>
            <b>Muffliato Student Interface:</b> Test live confusion ping from student device:
          </span>
          <button onClick={handleStudentPing} style={styles.pingBtn}>
            ✋ I'm Lost on {activeConcept}!
          </button>
        </div>

        <div style={styles.systemStatus}>
          <span style={styles.statusDot}></span>
          <span>Actian VectorAI: <b>Connected (:6574)</b></span>
          <span style={{ margin: "0 0.4rem" }}>•</span>
          <span>FastAPI: <b>Online (:8000)</b></span>
        </div>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    minHeight: "100vh",
    paddingTop: "68px",
    paddingBottom: "60px",
    paddingLeft: "1.5rem",
    paddingRight: "1.5rem",
    background: "#FDFBF7",
    color: "#2C1A04",
    fontFamily: '"Inter", sans-serif',
  },
  gridContainer: {
    display: "flex",
    gap: "1.5rem",
    maxWidth: "1280px",
    margin: "0 auto",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(212, 175, 55, 0.4)",
    borderRadius: "12px",
    padding: "1.25rem",
    boxShadow: "0 4px 20px rgba(212, 175, 55, 0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(212, 175, 55, 0.25)",
    paddingBottom: "0.75rem",
  },
  cardIcon: {
    fontSize: "1.3rem",
  },
  cardTitle: {
    fontFamily: '"Cinzel", serif',
    color: "#7A1C1C",
    fontSize: "1.1rem",
    fontWeight: 700,
  },
  liveTag: {
    fontSize: "0.68rem",
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 700,
    background: "rgba(16, 185, 129, 0.15)",
    color: "#059669",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    padding: "0.2rem 0.5rem",
    borderRadius: "4px",
  },
  spellTag: {
    fontSize: "0.68rem",
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 700,
    background: "rgba(212, 175, 55, 0.15)",
    color: "#8B6B1B",
    border: "1px solid rgba(212, 175, 55, 0.4)",
    padding: "0.2rem 0.5rem",
    borderRadius: "4px",
  },
  radarBox: {
    background: "#FFFDF9",
    border: "1px stroke rgba(212, 175, 55, 0.3)",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "0.5rem",
  },
  statsRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.5rem",
    marginTop: "auto",
  },
  statBox: {
    background: "#FFF8EA",
    border: "1px solid rgba(212, 175, 55, 0.3)",
    borderRadius: "6px",
    padding: "0.6rem 0.8rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontFamily: '"Cinzel", serif',
    fontWeight: 700,
    fontSize: "1.1rem",
    color: "#7A1C1C",
  },
  statLabel: {
    fontSize: "0.7rem",
    color: "#8B6B1B",
    marginTop: "0.2rem",
  },
  interestSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  sectionLabel: {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#7A1C1C",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  interestPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  interestBtn: {
    fontFamily: '"Inter", sans-serif',
    fontSize: "0.82rem",
    fontWeight: 600,
    padding: "0.4rem 0.8rem",
    borderRadius: "20px",
    border: "1px solid",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  analogyBox: {
    background: "#FFF8EA",
    border: "1.5px solid #D4AF37",
    borderRadius: "8px",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  analogyMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.8rem",
  },
  analogyConcept: {
    color: "#5C4033",
  },
  sourceTag: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "0.7rem",
    color: "#8B6B1B",
    background: "rgba(212, 175, 55, 0.2)",
    padding: "0.15rem 0.4rem",
    borderRadius: "4px",
  },
  analogyText: {
    fontFamily: '"Cinzel", serif',
    fontSize: "1.05rem",
    lineHeight: "1.5",
    color: "#7A1C1C",
    fontWeight: 600,
    fontStyle: "italic",
  },
  audioRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "0.25rem",
  },
  generateBtn: {
    fontFamily: '"Cinzel", serif',
    fontWeight: 700,
    fontSize: "0.85rem",
    color: "#FFFFFF",
    background: "linear-gradient(135deg, #7A1C1C 0%, #990000 100%)",
    border: "1px solid #D4AF37",
    padding: "0.55rem 1.1rem",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(122, 28, 28, 0.3)",
  },
  audioWave: {
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    background: "rgba(122, 28, 28, 0.08)",
    padding: "0.4rem 0.8rem",
    borderRadius: "20px",
  },
  waveBar: {
    width: "4px",
    height: "14px",
    background: "#D4AF37",
    borderRadius: "2px",
  },
  badgeWrapper: {
    marginTop: "0.5rem",
  },
  footerBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "48px",
    background: "rgba(253, 251, 247, 0.95)",
    borderTop: "1px solid rgba(212, 175, 55, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1.5rem",
    zIndex: 9990,
  },
  muffliatoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  muffliatoIcon: {
    fontSize: "1.1rem",
  },
  muffliatoText: {
    fontSize: "0.82rem",
    color: "#5C4033",
  },
  pingBtn: {
    fontFamily: '"Inter", sans-serif',
    fontWeight: 700,
    fontSize: "0.78rem",
    color: "#DC143C",
    background: "rgba(220, 20, 60, 0.1)",
    border: "1px solid rgba(220, 20, 60, 0.4)",
    padding: "0.35rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  systemStatus: {
    display: "flex",
    alignItems: "center",
    fontSize: "0.75rem",
    color: "#8B6B1B",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#10B981",
    marginRight: "0.4rem",
  },
};
