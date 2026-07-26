"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Dual-mode screen capture hook.
 * 
 * When running inside the Electron stealth client, uses the native
 * `electronAPI.screen.capture()` IPC for silent, one-shot frame grabs
 * via desktopCapturer — no recording indicator, no user prompt.
 *
 * When running in a normal browser, falls back to `getDisplayMedia()`.
 */
export function useScreenCapture(
  onContextDetected?: (context: {
    topic_node: string;
    comprehensive_summary: string;
    brief_summary: string;
    full_text_transcription: string;
    diagram_descriptions: string;
    key_terms: string[];
    indexed?: boolean;
    chunk_id?: string;
  }) => void,
  lectureId: number = 1
) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "error">("idle");
  const [currentConcept, setCurrentConcept] = useState<string | null>(null);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onContextRef = useRef(onContextDetected);
  onContextRef.current = onContextDetected;

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.screen) {
      setIsElectron(true);
    }
  }, []);

  // ── Electron IPC capture (silent one-shot) ──
  const captureElectron = useCallback(async (): Promise<string | null> => {
    if (!window.electronAPI?.screen) return null;
    try {
      const result = await window.electronAPI.screen.capture();
      if (result.success) {
        setLastScreenshot(result.dataUrl);
        return result.dataUrl;
      }
      console.warn("[useScreenCapture] Electron capture failed:", result.error);
      return null;
    } catch (err) {
      console.error("[useScreenCapture] Electron capture error:", err);
      return null;
    }
  }, []);

  // ── Browser canvas capture ──
  const captureFrame = useCallback(async (): Promise<string | null> => {
    // Prefer Electron path
    if (isElectron) return captureElectron();

    // Fallback: grab from video element
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.min(video.videoHeight, 720);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setLastScreenshot(dataUrl);
    return dataUrl;
  }, [isElectron, captureElectron]);

  // ── Send frame for vision analysis + index into VectorAI DB ──
  const sendFrameForAnalysis = useCallback(async () => {
    try {
      const dataUrl = await captureFrame();
      if (!dataUrl) return;

      const base64 = dataUrl.split(",")[1];
      if (!base64) return;
      const mime = dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";

      // Use analyze-and-index so every captured frame is persisted in VectorAI DB
      const resp = await fetch(`${API_URL}/vision/analyze-and-index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mime_type: mime,
          lecture_id: lectureId,
          ts: Date.now() / 1000,  // wall-clock seconds
        }),
      });
      if (!resp.ok) return;

      const context = await resp.json();
      if (context.topic_node && context.topic_node !== "unknown") {
        setCurrentConcept(context.topic_node);
        onContextRef.current?.(context);
      }
    } catch {
      // Silently retry on next interval
    }
  }, [captureFrame, lectureId]);

  // ── Start screen capture ──
  const startCapture = async () => {
    if (isElectron) {
      // In Electron mode, no continuous stream needed — we do one-shot grabs
      setIsCapturing(true);
      return;
    }
    // Browser fallback
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: true,
      });
      displayStream.getVideoTracks()[0].onended = () => stopCapture();
      setStream(displayStream);
      setIsCapturing(true);
    } catch (err: any) {
      console.error("Screen capture error:", err);
      throw new Error(err.message || "Failed to capture screen");
    }
  };

  // ── Stop screen capture ──
  const stopCapture = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setIsCapturing(false);
    setCurrentConcept(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopRecording();
  }, [stream]);

  // ── Audio recording (WebSocket to backend) ──
  const startRecording = (lectureId: number) => {
    if (!stream) {
      console.error("No stream available to record");
      return;
    }
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn("No audio track found in the stream");
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;

      const wsUrl = `${API_URL.replace(/^http/, "ws")}/transcription/live/${lectureId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setRecordingStatus("recording");
        recorder.start(3000);
      };
      ws.onerror = () => setRecordingStatus("error");

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };
      recorder.onerror = () => setRecordingStatus("error");
    } catch (e) {
      console.error("MediaRecorder setup error:", e);
      setRecordingStatus("error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRecordingStatus("idle");
  };

  // ── Sync video element with stream ──
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // ── Auto-analyze interval ──
  useEffect(() => {
    if (isCapturing && !frameIntervalRef.current) {
      frameIntervalRef.current = setInterval(sendFrameForAnalysis, 5000);
    }
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isCapturing, sendFrameForAnalysis]);

  return {
    startCapture,
    stopCapture,
    stream,
    videoRef,
    isCapturing,
    isElectron,
    startRecording,
    stopRecording,
    recordingStatus,
    captureFrame,
    currentConcept,
    sendFrameForAnalysis,
    lastScreenshot,
  };
}
