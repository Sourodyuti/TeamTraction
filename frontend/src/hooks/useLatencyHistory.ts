"use client";

/**
 * useLatencyHistory — accumulates `latency_badge` WebSocket messages into a
 * rolling history (last `maxPoints`) for the AI Pipeline latency chart.
 *
 * Each point carries the per-stage ms so the chart can draw one series per
 * stage (embedding/retrieval/gemini/elevenlabs) plus the total.
 */
import { useEffect, useState } from "react";
import type { LatencyBadge } from "@/lib/types";

export interface LatencyHistoryPoint {
  index: number;          // ordinal, for the X axis
  ts: number;             // epoch ms
  concept_node: string;
  embedding: number;
  retrieval: number;
  gemini: number;
  elevenlabs: number;
  total: number;
}

export function useLatencyHistory(
  badge: LatencyBadge | null,
  maxPoints: number = 20,
): LatencyHistoryPoint[] {
  const [history, setHistory] = useState<LatencyHistoryPoint[]>([]);

  useEffect(() => {
    if (!badge) return;
    setHistory((prev) => {
      const next: LatencyHistoryPoint = {
        index: prev.length,
        ts: new Date(badge.ts).getTime(),
        concept_node: badge.concept_node,
        embedding: badge.embedding_ms ?? 0,
        retrieval: badge.retrieval_ms ?? 0,
        gemini: badge.gemini_ms ?? 0,
        elevenlabs: badge.elevenlabs_ms ?? 0,
        total: badge.total_ms ?? 0,
      };
      // Re-index so the X axis is contiguous after trimming.
      const trimmed = [...prev, next].slice(-maxPoints);
      return trimmed.map((p, i) => ({ ...p, index: i }));
    });
  }, [badge, maxPoints]);

  return history;
}
