"use client";

/**
 * Radar data hook — shapes the WebSocket feed into radar + timeline data (Phase 3).
 *
 * Listens for radar_update messages and maintains:
 *   - conceptNodes: aggregated confusion density per node (for the radial heatmap)
 *   - timelineData: rolling confusion density over time (for the Recharts timeline)
 *   - latencyMs: latest retrieval latency (for the on-screen badge)
 */
import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ConceptNode, TimelinePoint } from "@/lib/types";

export function useRadarData() {
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const { lastMessage } = useWebSocket(1); // Default lecture_id for dashboard

  useEffect(() => {
    if (!lastMessage) return;

    const msg = lastMessage;

    // Handle radar_update: aggregate confusion by concept_node
    if (msg.type === "radar_update") {
      const { concept_node, signal_type } = msg;

      setConceptNodes((prev) => {
        const existing = prev.find((n) => n.name === concept_node);
        const newNode: ConceptNode = {
          name: concept_node,
          confusionDensity: 0,
          lostCount: 0,
          gotItCount: 0,
        };

        if (existing) {
          newNode.lostCount = existing.lostCount + (signal_type === "lost" ? 1 : 0);
          newNode.gotItCount = existing.gotItCount + (signal_type === "gotit" ? 1 : 0);
        } else if (signal_type === "lost") {
          newNode.lostCount = 1;
        } else if (signal_type === "gotit") {
          newNode.gotItCount = 1;
        }

        const total = newNode.lostCount + newNode.gotItCount;
        newNode.confusionDensity = total > 0 ? newNode.lostCount / total : 0;

        if (existing) {
          return prev.map((n) => (n.name === concept_node ? newNode : n));
        }
        return [...prev, newNode];
      });

      // Also append to timeline
      const now = new Date().toISOString();
      setTimelineData((prev) => {
        const next = [...prev, { ts: now, density: 0 }];
        // Recompute rolling density from concept nodes
        setConceptNodes((nodes) => {
          const totalLost = nodes.reduce((sum, n) => sum + n.lostCount, 0);
          const totalSignals = nodes.reduce((sum, n) => sum + n.lostCount + n.gotItCount, 0);
          const density = totalSignals > 0 ? totalLost / totalSignals : 0;
          next[next.length - 1] = { ts: now, density };
          return nodes;
        });
        // Keep last 100 points
        return next.slice(-100);
      });
    }

    // Handle latency_update: update the on-screen badge
    if (msg.type === "latency_update") {
      setLatencyMs(msg.retrieval_ms ?? msg.total_ms ?? null);
    }
  }, [lastMessage]);

  return {
    conceptNodes,
    timelineData,
    latencyMs,
  };
}