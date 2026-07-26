"use client";

/**
 * WebSocket hook for Muffliato pings + radar updates (Phase 2/3/6).
 *
 * Connects to FastAPI /ws/lecture/{lectureId}. Handles reconnect with backoff.
 *
 * Exposes:
 *   sendPing       — send a student confusion signal
 *   lastMessage    — last raw ServerMessage (for useRadarData)
 *   latencyBadge   — latest LatencyBadge message (flat numeric, for badge UI)
 *   connected      — WebSocket connection state
 *
 * Phase 6 audio: when an 'analogy_audio' or 'analogy_ready' message arrives
 * with an audio_url, the hook auto-plays the audio via a pooled Audio element
 * so the student phone speaks the analogy without any extra React code.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { LatencyBadge, ServerMessage, StudentPing } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "ws://localhost:8001";

export function useWebSocket(
  lectureId: number,
  role: "student" | "teacher" = "student",
  studentId?: string,
) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [latencyBadge, setLatencyBadge] = useState<LatencyBadge | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = useCallback((url: string) => {
    // Reuse or create a single Audio element to avoid overlapping playback
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.pause();
    audio.src = url;
    audio.play().catch((e) => {
      // Autoplay may be blocked before a user gesture — log but don't throw
      console.warn("[Legilimens] audio autoplay blocked:", e);
    });
  }, []);

  const connect = useCallback(() => {
    const base = API_URL.replace(/^http/, "ws");
    const sid = studentId || `user_${Math.random().toString(36).slice(2, 8)}`;
    const wsUrl = `${base}/ws/lecture/${lectureId}?role=${role}&student_id=${sid}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[Legilimens WS] connected", wsUrl);
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        setLastMessage(msg);

        // ── Latency badge: update dedicated state immediately ──
        if (msg.type === "latency_badge") {
          setLatencyBadge(msg as LatencyBadge);
          return; // badge-only message, no further processing needed
        }

        // ── Phase 6: auto-play analogy audio ───────────────────
        if (msg.type === "analogy_audio" && msg.audio_url) {
          playAudio(msg.audio_url);
        }
        if (msg.type === "analogy_ready" && msg.audio_url) {
          playAudio(msg.audio_url);
        }
      } catch (e) {
        console.error("[Legilimens WS] parse error:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Exponential backoff capped at 5s
      reconnectTimer.current = setTimeout(connect, Math.min(5000, 1000));
    };

    ws.onerror = (e) => {
      console.error("[Legilimens WS] error:", e);
      ws.close();
    };
  }, [lectureId, role, studentId, playAudio]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      audioRef.current?.pause();
    };
  }, [connect]);

  const sendPing = useCallback(
    (ping: Omit<StudentPing, "lecture_id">) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const fullPing: StudentPing = { ...ping, lecture_id: lectureId };
        wsRef.current.send(JSON.stringify({ type: "ping", ...fullPing }));
      }
    },
    [lectureId],
  );

  return { connected, lastMessage, latencyBadge, sendPing };
}
