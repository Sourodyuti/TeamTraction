"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ConceptNode, TimelinePoint } from "@/lib/types";

export function useRadarData(lectureId: number = 1) {
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const { lastMessage } = useWebSocket(lectureId, "teacher");

  useEffect(() => {
    if (!lastMessage) return;

    const msg = lastMessage;

    if (msg.type === "radar_update") {
      const { concept_node, signal_type } = msg;

      setConceptNodes((prev) => {
        const existing = prev.find((n) => n.id === concept_node);
        const baseNode = existing || {
          id: concept_node,
          label: concept_node.replace(/_/g, " "),
          confusion: 0,
          confusionDensity: 0,
          lastSignal: "",
          lostCount: 0,
          gotItCount: 0,
        };

        const newNode: ConceptNode = {
          ...baseNode,
          lostCount: baseNode.lostCount + (signal_type === "lost" ? 1 : 0),
          gotItCount: baseNode.gotItCount + (signal_type === "gotit" ? 1 : 0),
          lastSignal: signal_type,
        };

        const total = newNode.lostCount + newNode.gotItCount;
        newNode.confusionDensity = total > 0 ? newNode.lostCount / total : 0;
        newNode.confusion = newNode.confusionDensity;

        if (existing) {
          return prev.map((n) => (n.id === concept_node ? newNode : n));
        }
        return [...prev, newNode];
      });

      const now = Date.now();
      setConceptNodes((nodes) => {
        const totalLost = nodes.reduce((sum, n) => sum + n.lostCount, 0);
        const totalSignals = nodes.reduce((sum, n) => sum + n.lostCount + n.gotItCount, 0);
        const density = totalSignals > 0 ? totalLost / totalSignals : 0;
        setTimelineData((prev) => [...prev.slice(-99), { ts: now, density }]);
        return nodes;
      });
    }

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