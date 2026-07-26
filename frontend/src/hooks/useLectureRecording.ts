"use client";

/**
 * useLectureRecording — manages recording session lifecycle.
 *
 * Auto-starts recording when mounted (teacher dashboard),
 * handles beforeunload cleanup, exposes recording state.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { RecordingStatus } from "@/lib/types";

export function useLectureRecording(lectureId: number, autoStart: boolean = false) {
  const [status, setStatus] = useState<RecordingStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number | null>(null);

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    try {
      const s = await api.recordingStatus(lectureId);
      setStatus(s);
      if (s.is_active && s.started_at) {
        const startMs = new Date(s.started_at).getTime();
        startTimeRef.current = startMs;
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }
      return s;
    } catch {
      // Recording endpoint may not be reachable yet
      return null;
    }
  }, [lectureId]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const session = await api.startRecordingSession(lectureId);
      startTimeRef.current = Date.now();
      setStatus({
        lecture_id: lectureId,
        is_active: true,
        started_at: session.started_at,
        duration_seconds: 0,
        chunk_count: 0,
      });
      setElapsed(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
    }
  }, [lectureId]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      await api.stopRecordingSession(lectureId);
      setStatus(prev => prev ? { ...prev, is_active: false } : null);
      startTimeRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop recording");
    }
  }, [lectureId]);

  // Elapsed time ticker
  useEffect(() => {
    if (status?.is_active) {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status?.is_active]);

  // Auto-start on mount if requested
  useEffect(() => {
    fetchStatus().then(s => {
      if (autoStart && (!s || !s.is_active)) {
        startRecording();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount / beforeunload
  useEffect(() => {
    const handleUnload = () => {
      // Use sendBeacon for reliability on page close
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      navigator.sendBeacon(
        `${apiUrl}/recording/${lectureId}/stop`,
        new Blob([JSON.stringify({})], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [lectureId]);

  const formatElapsed = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return {
    status,
    isRecording: status?.is_active ?? false,
    elapsed,
    elapsedFormatted: formatElapsed(elapsed),
    error,
    startRecording,
    stopRecording,
    refresh: fetchStatus,
  };
}
