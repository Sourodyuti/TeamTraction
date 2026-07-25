"use client";

/**
 * Radar data hook — shapes the WebSocket feed into radar + timeline data (Phase 3).
 *
 * Listens for radar_update messages and maintains:
 *   - conceptNodes: aggregated confusion density per node (for the radial heatmap)
 *   - timelineData: rolling confusion density over time (for the Recharts timeline)
 *   - latencyMs: latest retrieval latency (for the on-screen badge, Phase 4)
 */
import { useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ConceptNode, TimelinePoint } from "@/lib/types";

export function useRadarData() {
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const { lastMessage } = useWebSocket(1); // Default lecture_id for dashboard

  // TODO Phase 3: When lastMessage is a radar_update, update conceptNodes
  //   and append to timelineData. When it's a retrieval result, update latencyMs.
  // For now this is a stub — the WebSocket hook feeds messages, this shapes them.

  return {
    conceptNodes,
    timelineData,
    latencyMs,
  };
}
