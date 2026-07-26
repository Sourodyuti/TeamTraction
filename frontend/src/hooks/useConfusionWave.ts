"use client";

/**
 * useConfusionWave — the demo "trigger" that makes the radar come alive.
 *
 * Strategy (honesty-preserving: real data through the real pipeline):
 *   1. Set the lecture's "current chunk" to the target concept via the ASR
 *      ingest endpoint — this is what tags every ping to a concept_node.
 *   2. Send a burst of `lost` pings from N DISTINCT student_ids, staggered
 *      ~300ms apart, over the live WebSocket. The backend ThresholdTracker
 *      (≥2 unique students lost in 20s) fires the REAL Accio pipeline →
 *      a real latency_badge + analogy_ready arrive on the same socket.
 *
 * No backend changes, no fake data — it's genuine signal flow, just
 * initiated from the dashboard for a controlled demo narrative.
 */
import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { SignalType } from "@/lib/types";
import type { StudentPing } from "@/lib/types";

type SendPing = (ping: Omit<StudentPing, "lecture_id">) => void;

export interface WaveState {
  firing: boolean;
  message: string;
}

const CONCEPT_TEXTS: Record<string, string> = {
  chain_rule: "The chain rule says gradients multiply layer by layer in backpropagation.",
  gradient_descent: "Gradient descent steps toward the minimum by following the negative gradient.",
  backpropagation: "Backpropagation propagates error gradients backward through the network.",
  neural_networks: "A neural network learns by adjusting weights to minimize loss.",
  learning_rate: "The learning rate controls how big each gradient step is.",
};

export function useConfusionWave(
  lectureId: number,
  sendPing: SendPing,
  connected: boolean,
) {
  const [state, setState] = useState<WaveState>({ firing: false, message: "" });

  const triggerWave = useCallback(
    async (conceptNode: string = "chain_rule", studentCount: number = 4) => {
      if (!connected) {
        setState({ firing: false, message: "WebSocket not connected — cannot send pings." });
        return;
      }
      setState({ firing: true, message: `Setting current concept to "${conceptNode}"…` });

      // 1. Set the current chunk so pings tag to this concept.
      try {
        await api.ingestChunk({
          text: CONCEPT_TEXTS[conceptNode] ?? `Explanation of ${conceptNode}.`,
          topic_node: conceptNode,
          lecture_id: lectureId,
          ts: Math.floor(Date.now() / 1000),
          difficulty: 6,
          source: "lecture",
        });
      } catch {
        // Non-fatal: ping will tag to whatever the last current chunk was.
      }

      setState({ firing: true, message: `Sending ${studentCount} "lost" signals…` });

      // 2. Send staggered lost pings from distinct student_ids.
      for (let i = 0; i < studentCount; i++) {
        const studentId = `demo_student_${i + 1}_${Math.random().toString(36).slice(2, 6)}`;
        sendPing({
          student_id: studentId,
          signal_type: SignalType.LOST,
          ts: new Date().toISOString(),
        });
        // Stagger so they land within the 20s window but look organic.
        await new Promise((r) => setTimeout(r, 350));
      }

      setState({
        firing: false,
        message: `Wave sent — threshold (≥2 lost) should fire Accio for "${conceptNode}".`,
      });

      // Clear the message after a few seconds.
      setTimeout(() => setState({ firing: false, message: "" }), 5000);
    },
    [lectureId, sendPing, connected],
  );

  return { wave: state, triggerWave };
}
