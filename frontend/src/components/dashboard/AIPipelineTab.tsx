"use client";

/**
 * AIPipelineTab — the headline sponsor visual.
 *
 * Shows the full Accio → Gemino → Sonorus pipeline as animated stages, each
 * lit with its live ms from the latency_badge WS stream. Includes a
 * latency-history line chart and a manual "Run analogy" trigger that
 * returns the latency_ms breakdown + analogy text + audio.
 *
 * Sponsor story: Embed (on-prem) → Retrieve (Actian VectorAI SDK) →
 * Gemino (Gemini, NVIDIA fallback) → Sonorus (ElevenLabs).
 */
import { useState, useRef, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { LatencyBreakdown } from "./LatencyBreakdown";
import { useLatencyHistory } from "@/hooks/useLatencyHistory";
import type { LatencyBadge, AnalogyResponse } from "@/lib/types";
import { InterestAvatar } from "@/lib/types";

const AVATARS: { key: InterestAvatar; label: string; icon: string }[] = [
  { key: InterestAvatar.CRICKETER, label: "Cricketer", icon: "🏏" },
  { key: InterestAvatar.GAMER, label: "Gamer", icon: "🎮" },
  { key: InterestAvatar.COOK, label: "Cook", icon: "🍳" },
];

const CONCEPTS = ["chain_rule", "gradient_descent", "backpropagation", "neural_networks", "learning_rate"];

interface Props {
  latencyBadge: LatencyBadge | null;
}

export function AIPipelineTab({ latencyBadge }: Props) {
  const history = useLatencyHistory(latencyBadge, 20);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalogyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [concept, setConcept] = useState("chain_rule");
  const [avatar, setAvatar] = useState<InterestAvatar>(InterestAvatar.CRICKETER);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pulse animation when a new badge arrives.
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (latencyBadge) setPulseKey((k) => k + 1);
  }, [latencyBadge]);

  const runAnalogy = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.triggerAnalogy(1, concept, undefined, avatar);
      setResult(res);
      if (res.audio_url && !audioRef.current) audioRef.current = new Audio();
      if (res.audio_url && audioRef.current) {
        audioRef.current.src = res.audio_url;
        audioRef.current.play().catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const stageActive = (stageKey: string) => {
    if (!latencyBadge) return false;
    return {
      embedding: latencyBadge.embedding_ms,
      retrieval: latencyBadge.retrieval_ms,
      gemini: latencyBadge.gemini_ms,
      elevenlabs: latencyBadge.elevenlabs_ms,
    }[stageKey] != null;
  };

  return (
    <div style={styles.wrap}>
      {/* Pipeline visualization */}
      <section style={styles.card}>
        <h2 style={styles.h2}>⚡ Accio Analogy Pipeline</h2>
        <p style={styles.hint}>
          On-prem embed + retrieve, then cloud rewrite + voice. Watch the stages light up as a real
          confusion wave fires Accio.
        </p>
        <div key={pulseKey} className="lg-dash-pipeline" style={styles.pipeline}>
          <PipelineStage
            icon="🔢"
            name="Embed"
            sub="bge-small (on-prem)"
            ms={latencyBadge?.embedding_ms}
            color="#7c3aed"
            active={stageActive("embedding")}
          />
          <Arrow active={stageActive("retrieval")} />
          <PipelineStage
            icon="🗄️"
            name="Retrieve"
            sub="Actian VectorAI SDK"
            ms={latencyBadge?.retrieval_ms}
            color="#D4AF37"
            active={stageActive("retrieval")}
          />
          <Arrow active={stageActive("gemini")} />
          <PipelineStage
            icon="🧠"
            name="Gemino"
            sub="Gemini / NVIDIA"
            ms={latencyBadge?.gemini_ms}
            color="#2563eb"
            active={stageActive("gemini")}
          />
          <Arrow active={stageActive("elevenlabs")} />
          <PipelineStage
            icon="🔊"
            name="Sonorus"
            sub="ElevenLabs TTS"
            ms={latencyBadge?.elevenlabs_ms}
            color="#059669"
            active={stageActive("elevenlabs")}
          />
        </div>
        {latencyBadge && (
          <div style={styles.totalLine}>
            <span style={styles.totalLabel}>total round-trip</span>
            <span style={styles.totalValue}>{latencyBadge.total_ms.toFixed(0)} ms</span>
            <span style={styles.totalConcept}>· {latencyBadge.concept_node.replace(/_/g, " ")}</span>
          </div>
        )}
      </section>

      {/* Manual trigger */}
      <section style={styles.card}>
        <h2 style={styles.h2}>🪄 Run Analogy Manually</h2>
        <p style={styles.hint}>Trigger the full pipeline with a chosen concept + interest avatar.</p>
        <div style={styles.controls}>
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Concept</label>
            <select value={concept} onChange={(e) => setConcept(e.target.value)} style={styles.select}>
              {CONCEPTS.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>Avatar (interest)</label>
            <div style={styles.avatarRow}>
              {AVATARS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAvatar(a.key)}
                  style={{
                    ...styles.avatarBtn,
                    background: avatar === a.key ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.05)",
                    borderColor: avatar === a.key ? "#D4AF37" : "rgba(212,175,55,0.2)",
                  }}
                >
                  <span>{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button style={{ ...styles.runBtn, opacity: running ? 0.7 : 1 }} onClick={runAnalogy} disabled={running}>
            {running ? "⏳ Running…" : "▶ Run analogy"}
          </button>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <strong>Run failed:</strong> {error}
            <div style={styles.errorHint}>
              Backend may be down or API keys missing. The pipeline degrades gracefully — see System tab.
            </div>
          </div>
        )}

        {result && (
          <div style={styles.resultBox}>
            <div style={styles.resultConcept}>{result.concept_node.replace(/_/g, " ")}</div>
            <div style={styles.resultAnalogy}>{result.analogy_text}</div>
            <LatencyBreakdown analogy={result} />
            {result.audio_url && (
              <button style={styles.playBtn} onClick={() => {
                if (!audioRef.current) audioRef.current = new Audio();
                audioRef.current.src = result.audio_url!;
                audioRef.current.play().catch(() => {});
              }}>
                ▶ Replay voice
              </button>
            )}
          </div>
        )}
      </section>

      {/* Latency history chart */}
      <section style={styles.card}>
        <h2 style={styles.h2}>📊 Latency History</h2>
        <p style={styles.hint}>Per-stage ms over recent Accio runs (populated by live confusion waves).</p>
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="index" stroke="rgba(245,230,200,0.4)" fontSize={11} />
              <YAxis stroke="rgba(245,230,200,0.4)" fontSize={11} tickFormatter={(v) => `${v}ms`} />
              <Tooltip
                contentStyle={{ background: "#1A0F2E", border: "1px solid #D4AF37", borderRadius: 8 }}
                formatter={(v: number, name) => [`${v.toFixed(0)}ms`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="embedding" stroke="#7c3aed" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="retrieval" stroke="#D4AF37" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gemini" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="elevenlabs" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total" stroke="#FFD700" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={styles.emptyChart}>
            Trigger confusion waves or run analogies to populate the history.
            <div style={styles.emptyHint}>Each live <code style={styles.code}>latency_badge</code> adds a point.</div>
          </div>
        )}
      </section>
    </div>
  );
}

function PipelineStage({ icon, name, sub, ms, color, active }: { icon: string; name: string; sub: string; ms?: number; color: string; active: boolean }) {
  return (
    <div
      style={{
        ...styles.stage,
        borderColor: active ? color : "rgba(212,175,55,0.2)",
        boxShadow: active ? `0 0 18px ${color}44` : "none",
        animation: active ? "pulse 2s ease-in-out infinite" : "none",
      }}
    >
      <div style={{ ...styles.stageIcon, color }}>{icon}</div>
      <div style={styles.stageName}>{name}</div>
      <div style={styles.stageSub}>{sub}</div>
      <div style={{ ...styles.stageMs, color: ms != null ? color : "rgba(245,230,200,0.3)" }}>
        {ms != null ? `${ms.toFixed(1)}ms` : "—"}
      </div>
    </div>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div
      className="lg-dash-arrow"
      style={{
        ...styles.arrow,
        color: active ? "#D4AF37" : "rgba(212,175,55,0.2)",
        animation: active ? "pulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      →
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "1.25rem",
  },
  h2: { fontFamily: '"Cinzel", serif', color: "#D4AF37", fontSize: "1.05rem", margin: "0 0 0.4rem", letterSpacing: "0.03em" },
  hint: { fontSize: "0.78rem", color: "rgba(245,230,200,0.5)", margin: "0 0 1rem" },
  pipeline: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    flexWrap: "wrap",
    padding: "1rem 0",
  },
  stage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.2rem",
    background: "rgba(0,0,0,0.25)",
    border: "2px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "0.9rem 1rem",
    minWidth: 110,
    transition: "all 0.3s ease-out",
  },
  stageIcon: { fontSize: "1.8rem" },
  stageName: { fontFamily: '"Cinzel", serif', color: "#F5E6C8", fontSize: "0.9rem", fontWeight: 600 },
  stageSub: { fontSize: "0.65rem", color: "rgba(245,230,200,0.45)", textAlign: "center" as const },
  stageMs: { fontFamily: '"JetBrains Mono", monospace', fontSize: "0.95rem", fontWeight: 700, marginTop: "0.2rem" },
  arrow: { fontSize: "1.5rem", fontWeight: 700, padding: "0 0.2rem" },
  totalLine: { display: "flex", alignItems: "baseline", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem" },
  totalLabel: { fontSize: "0.78rem", color: "rgba(245,230,200,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" },
  totalValue: { fontFamily: '"JetBrains Mono", monospace', fontSize: "1.6rem", fontWeight: 700, color: "#FFD700" },
  totalConcept: { fontSize: "0.8rem", color: "rgba(245,230,200,0.5)" },
  controls: { display: "flex", alignItems: "flex-end", gap: "1.2rem", flexWrap: "wrap", marginBottom: "1rem" },
  controlGroup: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  controlLabel: { fontSize: "0.72rem", color: "rgba(245,230,200,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" },
  select: {
    background: "rgba(0,0,0,0.4)",
    color: "#F5E6C8",
    border: "1px solid rgba(212,175,55,0.3)",
    borderRadius: "6px",
    padding: "0.45rem 0.6rem",
    fontSize: "0.85rem",
  },
  avatarRow: { display: "flex", gap: "0.4rem" },
  avatarBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.1rem",
    border: "1px solid",
    borderRadius: "8px",
    padding: "0.4rem 0.6rem",
    cursor: "pointer",
    color: "#F5E6C8",
    fontSize: "0.72rem",
    transition: "all 0.2s",
  },
  runBtn: {
    background: "rgba(212,175,55,0.15)",
    border: "1px solid rgba(212,175,55,0.5)",
    color: "#D4AF37",
    padding: "0.6rem 1.4rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.88rem",
  },
  resultBox: {
    marginTop: "1rem",
    background: "rgba(0,0,0,0.2)",
    border: "1px solid rgba(187,134,252,0.3)",
    borderRadius: "12px",
    padding: "1.1rem",
  },
  resultConcept: { fontFamily: '"Cinzel", serif', color: "#BB86FC", fontSize: "1.1rem", marginBottom: "0.5rem" },
  resultAnalogy: { color: "#F5E6C8", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1rem" },
  playBtn: {
    background: "rgba(5,150,105,0.15)",
    border: "1px solid rgba(5,150,105,0.5)",
    color: "#50C878",
    padding: "0.4rem 0.85rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
    marginTop: "0.5rem",
  },
  errorBox: {
    marginTop: "1rem",
    background: "rgba(220,20,60,0.08)",
    border: "1px solid rgba(220,20,60,0.3)",
    borderRadius: "8px",
    padding: "0.85rem 1rem",
    color: "#F87171",
    fontSize: "0.82rem",
  },
  errorHint: { fontSize: "0.72rem", color: "rgba(245,230,200,0.5)", marginTop: "0.4rem" },
  emptyChart: {
    textAlign: "center",
    padding: "2.5rem 1rem",
    color: "rgba(245,230,200,0.4)",
    fontSize: "0.85rem",
  },
  emptyHint: { fontSize: "0.75rem", marginTop: "0.4rem" },
  code: { fontFamily: '"JetBrains Mono", monospace', background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.3rem", borderRadius: 4 },
};
