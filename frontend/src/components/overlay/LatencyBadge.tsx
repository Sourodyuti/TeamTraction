"use client";

/**
 * LatencyBadge — the headline latency metric the spec calls out as
 * judge-critical. Renders when a 'latency_badge' WS message arrives
 * after Accio fires. Shows total_ms large, with a collapsible
 * per-stage breakdown on hover.
 *
 * Animates in, auto-dismisses after 8s.
 * Pure CSS — no extra animation libraries.
 * Themed to Legilimens gold (#d3a625) on dark purple (#1a0f2e).
 */
import { useEffect, useRef, useState } from "react";
import type { LatencyBadge as LatencyBadgeType } from "@/lib/types";

interface Props {
  badge: LatencyBadgeType | null;
  autoDismissMs?: number;
}

const STAGE_LABELS: Record<string, string> = {
  embedding_ms: "Embed",
  retrieval_ms: "Retrieve",
  gemini_ms: "Gemini",
  elevenlabs_ms: "TTS",
};

const STAGE_COLORS: Record<string, string> = {
  embedding_ms: "#7c3aed",   // violet
  retrieval_ms: "#d3a625",   // gold
  gemini_ms: "#2563eb",      // blue
  elevenlabs_ms: "#059669",  // green
};

export function LatencyBadge({ badge, autoDismissMs = 8000 }: Props) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!badge) return;
    setVisible(true);
    setExpanded(false);
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setVisible(false);
      setExpanded(false);
    }, autoDismissMs);
    return () => clearTimeout(dismissTimer.current);
  }, [badge, autoDismissMs]);

  if (!badge || !visible) return null;

  const stages = (["embedding_ms", "retrieval_ms", "gemini_ms", "elevenlabs_ms"] as const).map((key) => ({
    key,
    label: STAGE_LABELS[key] || key,
    ms: badge[key] ?? 0,
    color: STAGE_COLORS[key] || "#666",
  }));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Retrieval completed in ${badge.total_ms} milliseconds`}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        fontFamily: "system-ui, sans-serif",
        animation: "legilimens-badge-in 0.25s ease-out",
      }}
    >
      <style>{`
        @keyframes legilimens-badge-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        .lg-badge-card {
          background: rgba(26, 15, 46, 0.96);
          border: 1px solid #d3a625;
          border-radius: 12px;
          padding: 0.75rem 1rem;
          min-width: 160px;
          box-shadow: 0 0 24px rgba(211, 166, 37, 0.25);
          cursor: pointer;
          user-select: none;
        }
        .lg-badge-card:hover { border-color: #f0c040; }
        .lg-badge-headline {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
          color: #d3a625;
        }
        .lg-badge-total {
          font-size: 1.75rem;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .lg-badge-unit {
          font-size: 0.75rem;
          color: #a78bfa;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .lg-badge-label {
          font-size: 0.65rem;
          color: #a78bfa;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 0.15rem;
        }
        .lg-badge-concept {
          font-size: 0.7rem;
          color: #c4b5fd;
          margin-top: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        .lg-badge-stages {
          margin-top: 0.6rem;
          border-top: 1px solid rgba(211, 166, 37, 0.2);
          padding-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .lg-stage-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.7rem;
        }
        .lg-stage-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 0.35rem;
          flex-shrink: 0;
        }
        .lg-stage-name { color: #e2d9f3; }
        .lg-stage-ms   { color: #d3a625; font-variant-numeric: tabular-nums; }
        .lg-badge-hint {
          font-size: 0.6rem;
          color: #6b5c9a;
          text-align: right;
          margin-top: 0.4rem;
        }
      `}</style>

      <div
        className="lg-badge-card"
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? "Click to collapse" : "Click to expand stage breakdown"}
      >
        <div className="lg-badge-headline">
          <span className="lg-badge-total">{badge.total_ms.toFixed(0)}</span>
          <span className="lg-badge-unit">ms</span>
        </div>
        <div className="lg-badge-label">⚡ Accio retrieval
        </div>
        <div className="lg-badge-concept">{badge.concept_node.replace(/_/g, " ")}</div>

        {expanded && (
          <div className="lg-badge-stages">
            {stages.map(({ key, label, ms, color }) => (
              <div className="lg-stage-row" key={key}>
                <span>
                  <span
                    className="lg-stage-dot"
                    style={{ backgroundColor: color }}
                  />
                  <span className="lg-stage-name">{label}</span>
                </span>
                <span className="lg-stage-ms">{ms.toFixed(1)} ms</span>
              </div>
            ))}
          </div>
        )}

        {!expanded && (
          <div className="lg-badge-hint">tap for breakdown</div>
        )}
      </div>
    </div>
  );
}
