"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ConceptNode, LatencyBadge, TimelinePoint } from "@/lib/types";

export function useRadarData(lectureId: number = 1) {
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);

  // latencyBadge replaces the old single-number latencyMs.
  // Consumers can read .total_ms for the headline or per-stage fields for
  // the breakdown panel. null until the first Accio fires.
  const [latencyBadge, setLatencyBadge] = useState<LatencyBadge | null>(null);

  const [confusionAlert, setConfusionAlert] = useState<{ concept_node: string; count: number; recommendation: string } | null>(null);
  const [lastAnalogy, setLastAnalogy] = useState<{ concept_node: string; analogy_text: string; audio_url?: string } | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [seenStudents, setSeenStudents] = useState<Set<string>>(new Set());

  const { lastMessage, latencyBadge: wsBadge } = useWebSocket(lectureId, "teacher");

  // Sync the badge from the WS hook directly — this is the fix for audit
  // item #4. The old code listened for 'latency_update' which the backend
  // never sent. The backend sends 'latency_badge' (added in websocket.py).
  useEffect(() => {
    if (wsBadge) setLatencyBadge(wsBadge);
  }, [wsBadge]);

  useEffect(() => {
    if (!lastMessage) return;

    const msg = lastMessage;

    if (msg.type === "radar_update") {
      const { concept_node, signal_type, student_id } = msg;

      if (student_id) {
        setSeenStudents((prev) => {
          const next = new Set(prev);
          next.add(student_id);
          setTotalStudents(next.size);
          return next;
        });
      }

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

    if (msg.type === "confusion_alert") {
      setConfusionAlert({
        concept_node: msg.concept_node,
        count: msg.count,
        recommendation: msg.recommendation,
      });
    }

    if (msg.type === "analogy_ready") {
      setLastAnalogy({
        concept_node: msg.concept_node,
        analogy_text: msg.analogy_text,
        audio_url: msg.audio_url,
      });
    }

    if (msg.type === "transcript_update") {
      setCurrentTopic(msg.topic_node);
    }

    // latency_badge is handled via wsBadge useEffect above,
    // not here, to avoid double state updates.
  }, [lastMessage]);

  return {
    conceptNodes,
    timelineData,
    latencyBadge,     // LatencyBadge | null — full object with per-stage ms
    confusionAlert,
    lastAnalogy,
    currentTopic,
    totalStudents,
  };
}
