"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { executeDemoPipeline, AnalogyResponse } from "@/services/aiServices";

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */
interface ConceptNode {
  id: string;
  label: string;
  confusion: number;
  x: number;
  y: number;
}

const INITIAL_CONCEPTS: ConceptNode[] = [
  { id: "chain_rule", label: "Chain Rule", confusion: 0.85, x: 200, y: 140 },
  { id: "backprop", label: "Backpropagation", confusion: 0.65, x: 120, y: 220 },
  { id: "activation", label: "Activation Fn", confusion: 0.25, x: 300, y: 230 },
  { id: "loss_func", label: "Loss (MSE)", confusion: 0.15, x: 160, y: 80 },
  { id: "gradient_descent", label: "Grad Descent", confusion: 0.4, x: 280, y: 100 },
];

const INTEREST_AVATARS = [
  { id: "cricketer", label: "🏏 Cricketer", color: "#D4AF37" },
  { id: "gamer", label: "🎮 Gamer", color: "#8B5CF6" },
  { id: "musician", label: "🎵 Musician", color: "#F97316" },
  { id: "chef", label: "🍳 Chef", color: "#10B981" },
  { id: "anime", label: "⚡ Anime Fan", color: "#EC4899" },
];

const SPELLS = [
  { icon: "🔇", name: "Muffliato", desc: "Anonymous confusion ping", color: "#66FCF1", tag: "01" },
  { icon: "🧭", name: "Marauder's Map", desc: "Live confusion radar", color: "#D4AF37", tag: "02" },
  { icon: "✨", name: "Accio + Gemino", desc: "Retrieve & rewrite analogy", color: "#8B5CF6", tag: "03" },
  { icon: "🔊", name: "Sonorus", desc: "Text-to-speech delivery", color: "#F59E0B", tag: "04" },
  { icon: "🔮", name: "Pensieve", desc: "Analytics dashboard", color: "#EC4899", tag: "05" },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                    */
/* ------------------------------------------------------------------ */
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
  const [showApiPanel, setShowApiPanel] = useState(false);
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTriggerAnalogy = useCallback(
    async (conceptId: string = activeConcept) => {
      setIsGenerating(true);
      try {
        const res = await executeDemoPipeline({
          concept: conceptId,
          originalText: `In backpropagation, the derivative of loss with respect to weight relies on multiplying partial derivatives along the computational graph.`,
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
    },
    [activeConcept, selectedInterest, geminiKey, elevenKey]
  );

  const handleSimulateWave = useCallback(() => {
    setLostCount((prev) => (prev >= 16 ? 4 : prev + 4));
    setConcepts((prev) =>
      prev.map((c) =>
        c.id === "chain_rule" ? { ...c, confusion: Math.min(1.0, c.confusion + 0.15) } : c
      )
    );
    handleTriggerAnalogy("chain_rule");
  }, [handleTriggerAnalogy]);

  const handleStudentPing = useCallback(() => {
    setLostCount((prev) => Math.min(totalStudents, prev + 1));
    handleTriggerAnalogy(activeConcept);
  }, [totalStudents, activeConcept, handleTriggerAnalogy]);

  const confusionPercent = Math.round((lostCount / totalStudents) * 100);
  const activeConceptObj = concepts.find((c) => c.id === activeConcept);

  return (
    <main style={S.page}>
      {/* ── Animated background ── */}
      <div style={S.bgOrbs} aria-hidden="true">
        <div style={{ ...S.orb, ...S.orb1 }} />
        <div style={{ ...S.orb, ...S.orb2 }} />
        <div style={{ ...S.orb, ...S.orb3 }} />
      </div>

      {/* ── Top navigation bar ── */}
      <nav style={S.nav}>
        <div style={S.navLeft}>
          <span style={S.navLogo}>🔮</span>
          <span style={S.navTitle}>Legilimens</span>
          <span style={S.navVersion}>v0.1.0</span>
        </div>
        <div style={S.navRight}>
          <button style={S.navBtn} onClick={() => setShowApiPanel(!showApiPanel)}>
            ⚙️ API Keys
          </button>
          <a href="/muffliato" style={S.navLink}>📱 Muffliato</a>
          <a href="/dashboard" style={S.navLink}>📊 Dashboard</a>
          <div style={S.navStatus}>
            <span style={S.navStatusDot} />
            <span style={S.navStatusText}>System Online</span>
          </div>
        </div>
      </nav>

      {/* ── API Key Panel (collapsible) ── */}
      {showApiPanel && (
        <div style={S.apiPanel}>
          <div style={S.apiPanelInner}>
            <div style={S.apiField}>
              <label style={S.apiLabel}>Gemini API Key</label>
              <input
                style={S.apiInput}
                type="password"
                placeholder="AIza..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>
            <div style={S.apiField}>
              <label style={S.apiLabel}>ElevenLabs API Key</label>
              <input
                style={S.apiInput}
                type="password"
                placeholder="sk-..."
                value={elevenKey}
                onChange={(e) => setElevenKey(e.target.value)}
              />
            </div>
            <button style={S.waveBtn} onClick={handleSimulateWave}>
              ⚡ Simulate Confusion Wave
            </button>
          </div>
        </div>
      )}

      {/* ── Hero header ── */}
      <header style={{ ...S.hero, opacity: mounted ? 1 : 0 }}>
        <div style={S.heroBadge}>
          <span style={S.heroBadgeDot} />
          LIVE DEMO • ACTIAN VECTORAI DB ON-PREM
        </div>
        <h1 style={S.heroTitle}>
          The Spell That Reads{" "}
          <span style={S.heroHighlight}>Collective Minds</span>
        </h1>
        <p style={S.heroSub}>
          Real-time confusion detection → personalized analogy generation → voice delivery — all in under 2 seconds.
        </p>
      </header>

      {/* ── Main grid ── */}
      <div style={S.grid}>
        {/* ── LEFT: Confusion Radar ── */}
        <section style={S.card}>
          <div style={S.cardHead}>
            <div style={S.cardHeadLeft}>
              <span style={S.cardIcon}>🧭</span>
              <h2 style={S.cardTitle}>Marauder&apos;s Confusion Radar</h2>
            </div>
            <span style={S.liveTag}>
              <span style={S.liveTagDot} /> LIVE
            </span>
          </div>

          {/* SVG Radar */}
          <div style={S.radarWrap}>
            <svg width="100%" height="280" viewBox="0 0 400 300" style={{ display: "block" }}>
              <defs>
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(212,175,55,0.06)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
              <rect width="400" height="300" fill="url(#radarGlow)" rx="8" />
              <circle cx="200" cy="150" r="120" fill="none" stroke="rgba(212,175,55,0.12)" strokeDasharray="4 6" />
              <circle cx="200" cy="150" r="80" fill="none" stroke="rgba(212,175,55,0.15)" strokeDasharray="4 6" />
              <circle cx="200" cy="150" r="40" fill="none" stroke="rgba(212,175,55,0.2)" />
              <line x1="80" y1="150" x2="320" y2="150" stroke="rgba(212,175,55,0.08)" />
              <line x1="200" y1="30" x2="200" y2="270" stroke="rgba(212,175,55,0.08)" />

              {concepts.map((node) => {
                const isActive = node.id === activeConcept;
                const color =
                  node.confusion > 0.6 ? "#EF4444" : node.confusion > 0.3 ? "#F59E0B" : "#10B981";
                return (
                  <g
                    key={node.id}
                    onClick={() => {
                      setActiveConcept(node.id);
                      handleTriggerAnalogy(node.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {node.confusion > 0.5 && (
                      <circle cx={node.x} cy={node.y} r="22" fill="rgba(239,68,68,0.15)">
                        <animate attributeName="r" values="14;26;14" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isActive ? 13 : 9}
                      fill={color}
                      stroke={isActive ? "#D4AF37" : "rgba(255,255,255,0.3)"}
                      strokeWidth={isActive ? 3 : 1.5}
                      style={{ filter: isActive ? "drop-shadow(0 0 8px rgba(212,175,55,0.5))" : undefined }}
                    />
                    <text
                      x={node.x}
                      y={node.y + 24}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.7)"
                      fontSize="10"
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

          {/* Stats row */}
          <div style={S.statsRow}>
            <div style={S.statCard}>
              <span style={S.statNum}>{lostCount}/{totalStudents}</span>
              <span style={S.statLbl}>Students Lost</span>
            </div>
            <div style={S.statCard}>
              <span style={{ ...S.statNum, color: confusionPercent > 50 ? "#EF4444" : "#F59E0B" }}>
                {confusionPercent}%
              </span>
              <span style={S.statLbl}>Confusion</span>
            </div>
            <div style={S.statCard}>
              <span style={{ ...S.statNum, color: "#D4AF37", fontSize: 13 }}>
                {activeConceptObj?.label || activeConcept}
              </span>
              <span style={S.statLbl}>Active Concept</span>
            </div>
          </div>
        </section>

        {/* ── RIGHT: Analogy Engine ── */}
        <section style={{ ...S.card, flex: 1.2 }}>
          <div style={S.cardHead}>
            <div style={S.cardHeadLeft}>
              <span style={S.cardIcon}>✨</span>
              <h2 style={S.cardTitle}>Accio Analogy + Gemino Engine</h2>
            </div>
            <span style={S.spellTag}>SPELL 03 • RETRIEVAL + REWRITE</span>
          </div>

          {/* Interest selector */}
          <div>
            <label style={S.sectionLabel}>Student Interest Profile</label>
            <div style={S.pillRow}>
              {INTEREST_AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedInterest(a.id)}
                  style={{
                    ...S.pill,
                    ...(selectedInterest === a.id ? S.pillActive : {}),
                    borderColor: selectedInterest === a.id ? a.color : "rgba(255,255,255,0.1)",
                    ...(selectedInterest === a.id
                      ? { background: `linear-gradient(135deg, ${a.color}22, ${a.color}11)`, color: a.color }
                      : {}),
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Analogy output */}
          <div style={S.analogyBox}>
            <div style={S.analogyMeta}>
              <span style={S.analogyConcept}>
                ⚡ <strong>{activeConcept.replace(/_/g, " ")}</strong> → <strong>{selectedInterest.toUpperCase()}</strong>
              </span>
              <span style={S.sourceTag}>{analogyResult?.source || "—"}</span>
            </div>
            <p style={S.analogyText}>
              {isGenerating ? (
                <span style={S.generatingText}>
                  <span style={S.genDot} /> Gemino is rewriting analogy in real-time...
                </span>
              ) : (
                analogyResult?.analogyText
              )}
            </p>
            <div style={S.actionRow}>
              <button
                onClick={() => handleTriggerAnalogy(activeConcept)}
                disabled={isGenerating}
                style={S.generateBtn}
              >
                {isGenerating ? "✨ Generating..." : "⚡ Generate & Speak"}
              </button>
              {isPlayingAudio && (
                <div style={S.audioIndicator}>
                  <span style={S.audioBar} /><span style={S.audioBar} /><span style={S.audioBar} /><span style={S.audioBar} />
                  <span style={S.audioLabel}>🔊 Speaking...</span>
                </div>
              )}
            </div>
          </div>

          {/* Latency badge */}
          {analogyResult?.latencyBadge && (
            <div style={S.latencyRow}>
              {[
                { label: "Embed", value: analogyResult.latencyBadge.embedding_ms, color: "#10B981" },
                { label: "Retrieve", value: analogyResult.latencyBadge.retrieval_ms, color: "#3B82F6" },
                { label: "Gemini", value: analogyResult.latencyBadge.gemini_ms, color: "#8B5CF6" },
                { label: "TTS", value: analogyResult.latencyBadge.elevenlabs_ms, color: "#F59E0B" },
                { label: "Total", value: analogyResult.latencyBadge.total_ms, color: "#D4AF37" },
              ].map((l) => (
                <div key={l.label} style={S.latencyChip}>
                  <span style={{ ...S.latencyValue, color: l.color }}>{l.value}ms</span>
                  <span style={S.latencyLabel}>{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Spells strip ── */}
      <div style={S.spellsStrip}>
        {SPELLS.map((spell) => (
          <div key={spell.name} style={S.spellCard}>
            <span style={{ ...S.spellIcon, color: spell.color }}>{spell.icon}</span>
            <div>
              <span style={S.spellName}>{spell.name}</span>
              <span style={S.spellDesc}>{spell.desc}</span>
            </div>
            <span style={{ ...S.spellTagBadge, borderColor: `${spell.color}44`, color: spell.color }}>
              {spell.tag}
            </span>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <footer style={S.footer}>
        <div style={S.footerLeft}>
          <span style={S.footerIcon}>📱</span>
          <span style={S.footerText}>
            <strong>Muffliato Student Interface:</strong> Test live confusion ping
          </span>
          <button onClick={handleStudentPing} style={S.pingBtn}>
            ✋ I&apos;m Lost on {activeConcept.replace(/_/g, " ")}!
          </button>
        </div>
        <div style={S.footerRight}>
          <span style={S.footerDot} />
          <span>Actian VectorAI: <strong>Connected</strong></span>
          <span style={S.footerSep}>•</span>
          <span>FastAPI: <strong>Online</strong></span>
        </div>
      </footer>

      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-40px) scale(1.1)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,50px) scale(0.9)} }
        @keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,60px) scale(1.05)} }
        @keyframes pulseGen { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes audioWave { 0%,100%{height:6px} 50%{height:16px} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </main>
  );
}

/* ================================================================== */
/*  S T Y L E S                                                       */
/* ================================================================== */
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(145deg, #0a0b14 0%, #0d0e1a 40%, #111225 100%)",
    color: "#e8e0d0",
    fontFamily: '"Inter", system-ui, sans-serif',
    position: "relative",
    overflow: "hidden",
  },
  bgOrbs: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
  },
  orb: {
    position: "absolute", borderRadius: "50%", filter: "blur(120px)", opacity: 0.3,
  },
  orb1: {
    width: 600, height: 600, top: "-15%", left: "-10%",
    background: "radial-gradient(circle, rgba(212,175,55,0.15), transparent 70%)",
    animation: "float1 20s ease-in-out infinite",
  },
  orb2: {
    width: 500, height: 500, top: "40%", right: "-5%",
    background: "radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)",
    animation: "float2 25s ease-in-out infinite",
  },
  orb3: {
    width: 400, height: 400, bottom: "-10%", left: "30%",
    background: "radial-gradient(circle, rgba(16,185,129,0.1), transparent 70%)",
    animation: "float3 18s ease-in-out infinite",
  },
  /* Nav */
  nav: {
    position: "sticky", top: 0, zIndex: 100,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 24px",
    background: "rgba(10,11,20,0.8)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  navLeft: { display: "flex", alignItems: "center", gap: 10 },
  navLogo: { fontSize: 20 },
  navTitle: {
    fontFamily: '"Cinzel", Georgia, serif',
    fontWeight: 700, fontSize: 16,
    background: "linear-gradient(135deg, #D4AF37, #F0D57A)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  },
  navVersion: {
    fontSize: 10, color: "rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.05)",
    padding: "2px 8px", borderRadius: 10,
    fontFamily: '"JetBrains Mono", monospace',
  },
  navRight: { display: "flex", alignItems: "center", gap: 16 },
  navBtn: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "6px 14px",
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    fontFamily: '"Inter", sans-serif', transition: "all 0.2s",
  },
  navLink: {
    color: "rgba(255,255,255,0.5)", textDecoration: "none",
    fontSize: 12, fontWeight: 500, transition: "color 0.2s",
  },
  navStatus: { display: "flex", alignItems: "center", gap: 6 },
  navStatusDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#10B981", boxShadow: "0 0 8px rgba(16,185,129,0.4)",
  },
  navStatusText: {
    fontSize: 11, color: "#10B981",
    fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
  },
  /* API Panel */
  apiPanel: {
    position: "relative", zIndex: 50,
    background: "rgba(15,16,30,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)",
    padding: "16px 24px",
  },
  apiPanelInner: { display: "flex", gap: 16, alignItems: "flex-end", maxWidth: 1200, margin: "0 auto" },
  apiField: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  apiLabel: { fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" },
  apiInput: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, padding: "8px 12px", color: "#e8e0d0", fontSize: 13,
    outline: "none", fontFamily: '"JetBrains Mono", monospace',
  },
  waveBtn: {
    background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))",
    border: "1px solid rgba(239,68,68,0.3)", color: "#F87171",
    borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap",
    fontFamily: '"Inter", sans-serif', transition: "all 0.2s",
  },
  /* Hero */
  hero: {
    position: "relative", zIndex: 10,
    textAlign: "center", padding: "48px 24px 24px",
    transition: "opacity 0.8s ease-out",
  },
  heroBadge: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 20, padding: "6px 16px",
    fontSize: 10, fontWeight: 700, color: "#10B981",
    fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em",
    marginBottom: 20,
  },
  heroBadgeDot: {
    width: 6, height: 6, borderRadius: "50%",
    background: "#10B981", boxShadow: "0 0 6px #10B981",
    animation: "pulseGen 1.5s ease-in-out infinite",
  },
  heroTitle: {
    fontFamily: '"Cinzel", Georgia, serif',
    fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800,
    color: "#F5F0E8", lineHeight: 1.15, margin: "0 auto",
    maxWidth: 700,
  },
  heroHighlight: {
    background: "linear-gradient(135deg, #D4AF37, #F0D57A, #D4AF37)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
    animation: "shimmer-text 3s linear infinite",
  },
  heroSub: {
    fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 600,
    margin: "16px auto 0", lineHeight: 1.6,
  },
  /* Grid */
  grid: {
    position: "relative", zIndex: 10,
    display: "flex", gap: 20, padding: "20px 24px",
    maxWidth: 1300, margin: "0 auto",
  },
  /* Cards */
  card: {
    flex: 1,
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: 20,
    backdropFilter: "blur(8px)",
    display: "flex", flexDirection: "column", gap: 16,
    position: "relative", overflow: "hidden",
  },
  cardHead: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  cardHeadLeft: { display: "flex", alignItems: "center", gap: 8 },
  cardIcon: { fontSize: 18 },
  cardTitle: {
    fontFamily: '"Cinzel", serif', fontSize: 15, fontWeight: 700,
    color: "#F5F0E8", margin: 0,
  },
  liveTag: {
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 10, fontWeight: 700, color: "#10B981",
    fontFamily: '"JetBrains Mono", monospace',
    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 6, padding: "3px 10px",
  },
  liveTagDot: {
    width: 5, height: 5, borderRadius: "50%",
    background: "#10B981",
    animation: "pulseGen 1.5s ease-in-out infinite",
  },
  spellTag: {
    fontSize: 9, fontWeight: 700, color: "#D4AF37",
    fontFamily: '"JetBrains Mono", monospace',
    background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: 6, padding: "3px 10px",
    letterSpacing: "0.06em",
  },
  /* Radar */
  radarWrap: {
    background: "rgba(0,0,0,0.2)", borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.04)", overflow: "hidden",
  },
  /* Stats */
  statsRow: { display: "flex", gap: 8 },
  statCard: {
    flex: 1, background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 10, padding: "10px 12px",
    textAlign: "center",
  },
  statNum: {
    display: "block",
    fontFamily: '"Cinzel", serif', fontWeight: 700,
    fontSize: 18, color: "#F5F0E8",
  },
  statLbl: {
    display: "block", fontSize: 9, color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2,
  },
  /* Interest */
  sectionLabel: {
    display: "block", fontSize: 10, fontWeight: 700,
    color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 8,
  },
  pillRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  pill: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)",
    borderRadius: 20, padding: "7px 16px",
    fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    transition: "all 0.25s",
    fontFamily: '"Inter", sans-serif',
  },
  pillActive: {
    boxShadow: "0 0 16px rgba(212,175,55,0.1)",
  },
  /* Analogy */
  analogyBox: {
    background: "linear-gradient(135deg, rgba(212,175,55,0.04), rgba(139,92,246,0.03))",
    border: "1px solid rgba(212,175,55,0.15)",
    borderRadius: 12, padding: 16,
    display: "flex", flexDirection: "column", gap: 12,
  },
  analogyMeta: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontSize: 12,
  },
  analogyConcept: { color: "rgba(255,255,255,0.6)", textTransform: "capitalize" },
  sourceTag: {
    fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4,
  },
  analogyText: {
    fontFamily: '"Cinzel", serif', fontSize: 15,
    lineHeight: 1.6, color: "#F0D57A",
    fontWeight: 500, fontStyle: "italic", margin: 0,
  },
  generatingText: {
    display: "flex", alignItems: "center", gap: 8,
    color: "rgba(255,255,255,0.4)", fontStyle: "normal", fontSize: 13,
  },
  genDot: {
    display: "inline-block", width: 8, height: 8,
    borderRadius: "50%", background: "#D4AF37",
    animation: "pulseGen 1s ease-in-out infinite",
  },
  actionRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  generateBtn: {
    fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: 13,
    color: "#1a0f2e",
    background: "linear-gradient(135deg, #D4AF37, #B8941F)",
    border: "none", padding: "10px 24px", borderRadius: 8,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(212,175,55,0.25), 0 0 0 1px rgba(212,175,55,0.3)",
    transition: "all 0.2s",
  },
  audioIndicator: {
    display: "flex", alignItems: "center", gap: 4,
    background: "rgba(212,175,55,0.06)", padding: "6px 14px", borderRadius: 20,
  },
  audioBar: {
    display: "inline-block", width: 3, height: 10, borderRadius: 2,
    background: "#D4AF37",
    animation: "audioWave 0.6s ease-in-out infinite",
  },
  audioLabel: { fontSize: 11, color: "#D4AF37", fontWeight: 600, marginLeft: 4 },
  /* Latency */
  latencyRow: {
    display: "flex", gap: 8, flexWrap: "wrap",
  },
  latencyChip: {
    flex: 1, minWidth: 80,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 8, padding: "8px 10px", textAlign: "center",
  },
  latencyValue: {
    display: "block",
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 700, fontSize: 14,
  },
  latencyLabel: {
    display: "block", fontSize: 8, color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2,
  },
  /* Spells strip */
  spellsStrip: {
    position: "relative", zIndex: 10,
    display: "flex", gap: 12, padding: "12px 24px",
    maxWidth: 1300, margin: "0 auto",
    overflowX: "auto",
  },
  spellCard: {
    flex: 1, minWidth: 180,
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 10, padding: "10px 14px",
  },
  spellIcon: { fontSize: 22, flexShrink: 0 },
  spellName: {
    display: "block",
    fontFamily: '"Cinzel", serif', fontSize: 12, fontWeight: 700,
    color: "#F5F0E8",
  },
  spellDesc: {
    display: "block", fontSize: 10, color: "rgba(255,255,255,0.35)",
  },
  spellTagBadge: {
    marginLeft: "auto", flexShrink: 0,
    fontSize: 9, fontWeight: 700,
    fontFamily: '"JetBrains Mono", monospace',
    border: "1px solid", borderRadius: 4, padding: "2px 6px",
  },
  /* Footer */
  footer: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    zIndex: 100, height: 48,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 24px",
    background: "rgba(10,11,20,0.9)", backdropFilter: "blur(12px)",
    borderTop: "1px solid rgba(255,255,255,0.04)",
    fontSize: 12,
  },
  footerLeft: { display: "flex", alignItems: "center", gap: 10 },
  footerIcon: { fontSize: 16 },
  footerText: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  pingBtn: {
    fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: 11,
    color: "#F87171",
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
    padding: "5px 14px", borderRadius: 8, cursor: "pointer",
    transition: "all 0.2s",
  },
  footerRight: {
    display: "flex", alignItems: "center", gap: 8,
    color: "rgba(255,255,255,0.4)", fontSize: 11,
  },
  footerDot: {
    width: 7, height: 7, borderRadius: "50%",
    background: "#10B981", boxShadow: "0 0 6px rgba(16,185,129,0.3)",
  },
  footerSep: { color: "rgba(255,255,255,0.15)" },
};
