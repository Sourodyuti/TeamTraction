"use client";

/**
 * WebSocket hook for Muffliato pings + radar updates (Phase 2/3).
 *
 * Connects to FastAPI /ws/lecture/{lectureId}. Handles reconnect with backoff.
 *
 * Usage:
 *   const { sendPing, lastMessage, connected } = useWebSocket(lectureId);
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { StudentPing, ServerMessage } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "ws://localhost:8000";

export function useWebSocket(lectureId: number) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const wsUrl = `${API_URL.replace(/^http/, "ws")}/ws/lecture/${lectureId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[Legilimens WS] connected to", wsUrl);
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        setLastMessage(msg);
        // TODO Phase 6: handle analogy_audio messages (play audio)
      } catch (e) {
        console.error("[Legilimens WS] parse error:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect with backoff (max 5s)
      reconnectTimer.current = setTimeout(connect, Math.min(5000, 1000));
    };

    ws.onerror = (e) => {
      console.error("[Legilimens WS] error:", e);
      ws.close();
    };
  }, [lectureId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendPing = useCallback((ping: Omit<StudentPing, "lecture_id">) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const fullPing: StudentPing = { ...ping, lecture_id: lectureId };
      wsRef.current.send(JSON.stringify({ type: "ping", ...fullPing }));
    }
  }, [lectureId]);

  return { connected, lastMessage, sendPing };
}
