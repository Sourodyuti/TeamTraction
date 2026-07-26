"use client";

/**
 * LatencyBreakdown — horizontal per-stage latency bars for the Accio pipeline.
 *
 * Works from either:
 *   - a LatencyBadge WS message (flat *_ms fields), or
 *   - an AnalogyResponse.latency_ms dict (snake-free keys: embedding/retrieval/...).
 *
 * Shows the budget target (from handoff.md) as a reference tick on each bar
 * so judges can see on-prem vs cloud latency at a glance.
 */
import type { LatencyBadge, AnalogyResponse } from "@/lib/types";

interface Props {
  /** A latency_badge WS message — preferred source (live). */
  badge?: LatencyBadge | null;
  /** An analogy REST response — alternative source (manual trigger). */
  analogy?: AnalogyResponse | null;
}

const STAGES = [
  { key: "embedding", label: "Embed", spell: "accio", color: "#7c3aed", budget: 15, unit: "ms" },
  { key: "retrieval", label: "Retrieve", spell: "accio", color: "#D4AF37", budget: 50, unit: "ms" },
  { key: "gemini", label: "Gemino (LLM)", spell: "gemino", color: "#2563eb", budget: 800, unit: "ms" },
  { key: "elevenlabs", label: "Sonorus (TTS)", spell: "sonorus", color: "#059669", budget: 1600, unit: "ms" },
] as const;

export function LatencyBreakdown({ badge, analogy }: Props) {
  const values = extract(badge, analogy);
  const total = values.reduce((s, v) => s + v, 0);
  const hasData = badge != null || analogy != null;
  const maxBudget = Math.max(...STAGES.map((s) => s.budget));

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.title}>⚡ Accio Latency Breakdown</span>
        {hasData && (
          <span style={styles.totalBadge}>
            {total.toFixed(0)} ms total
          </span>
        )}
      </div>

      {!hasData && <div style={styles.empty}>Awaiting first Accio run…</div>}

      {hasData && (
        <div style={styles.bars}>
          {STAGES.map((stage, i) => {
            const ms = values[i];
            // Scale: bar fills proportionally to its budget, capped at 100%.
            const pct = Math.min(100, (ms / stage.budget) * 100);
            const overBudget = ms > stage.budget;
            return (
              <div key={stage.key} style={styles.row}>
                <div style={styles.rowLabel}>
                  <span style={{ ...styles.dot, background: stage.color }} />
                  <span style={styles.stageName}>{stage.label}</span>
                </div>
                <div style={styles.track}>
                  <div
                    style={{
                      ...styles.fill,
                      width: `${pct}%`,
                      background: overBudget
                        ? "linear-gradient(90deg, #f97316, #ef4444)"
                        : `linear-gradient(90deg, ${stage.color}88, ${stage.color})`,
                    }}
                  />
                  {/* Budget reference tick */}
                  <div
                    style={{ ...styles.tick, left: "100%" }}
                    title={`budget ${stage.budget}ms`}
                  />
                </div>
                <div style={styles.value}>
                  <span style={{ color: overBudget ? "#f87171" : "#F5E6C8", fontVariantNumeric: "tabular-nums" }}>
                    {ms.toFixed(1)}
                  </span>
                  <span style={styles.unit}> ms</span>
                  <span style={styles.budgetLabel}>/ {stage.budget}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={styles.legend}>
        bar width = % of budget · <span style={{ color: "#f87171" }}>red</span> = over budget · tick = target
      </div>
    </div>
  );
}

function extract(badge?: LatencyBadge | null, analogy?: AnalogyResponse | null): number[] {
  if (badge) {
    return [
      badge.embedding_ms ?? 0,
      badge.retrieval_ms ?? 0,
      badge.gemini_ms ?? 0,
      badge.elevenlabs_ms ?? 0,
    ];
  }
  if (analogy?.latency_ms) {
    return [
      analogy.latency_ms.embedding ?? 0,
      analogy.latency_ms.retrieval ?? 0,
      analogy.latency_ms.gemini ?? 0,
      analogy.latency_ms.elevenlabs ?? 0,
    ];
  }
  return [0, 0, 0, 0];
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: "12px",
    padding: "1.25rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  title: {
    fontFamily: '"Cinzel", serif',
    color: "#D4AF37",
    fontSize: "1rem",
    letterSpacing: "0.03em",
  },
  totalBadge: {
    background: "rgba(212,175,55,0.15)",
    border: "1px solid rgba(212,175,55,0.4)",
    color: "#D4AF37",
    padding: "0.2rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontFamily: '"JetBrains Mono", monospace',
    fontVariantNumeric: "tabular-nums",
  },
  empty: {
    color: "rgba(245,230,200,0.4)",
    fontStyle: "italic",
    textAlign: "center",
    padding: "1.5rem 0",
    fontSize: "0.9rem",
  },
  bars: { display: "flex", flexDirection: "column", gap: "0.7rem" },
  row: {
    display: "grid",
    gridTemplateColumns: "130px 1fr 110px",
    alignItems: "center",
    gap: "0.75rem",
  },
  rowLabel: { display: "flex", alignItems: "center", gap: "0.4rem" },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  stageName: { color: "#D4C4A8", fontSize: "0.82rem" },
  track: {
    position: "relative",
    height: 14,
    background: "rgba(255,255,255,0.06)",
    borderRadius: "7px",
    overflow: "visible",
  },
  fill: {
    height: "100%",
    borderRadius: "7px",
    transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
  },
  tick: {
    position: "absolute",
    top: -3,
    height: 20,
    width: 2,
    background: "rgba(245,230,200,0.5)",
    borderRadius: "1px",
  },
  value: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "0.78rem",
    textAlign: "right",
  },
  unit: { color: "rgba(245,230,200,0.5)" },
  budgetLabel: { color: "rgba(245,230,200,0.3)", marginLeft: "0.3rem", fontSize: "0.7rem" },
  legend: {
    marginTop: "0.85rem",
    fontSize: "0.7rem",
    color: "rgba(245,230,200,0.4)",
    textAlign: "center",
  },
};
