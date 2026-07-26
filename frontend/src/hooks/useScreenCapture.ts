"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export function useScreenCapture(onContextDetected?: (context: { topic_node: string; slide_text_summary: string; key_terms: string[] }) => void) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'error'>('idle');
  const [currentConcept, setCurrentConcept] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onContextRef = useRef(onContextDetected);
  onContextRef.current = onContextDetected;

  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.min(video.videoHeight, 720);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, []);

  const sendFrameForAnalysis = useCallback(async () => {
    try {
      const imageBase64 = await captureFrame();
      if (!imageBase64) return;

      const resp = await fetch(`${API_URL}/vision/analyze-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, mime_type: "image/jpeg" }),
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
  }, [captureFrame]);

  const startCapture = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: true
      });
      displayStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };
      setStream(displayStream);
      setIsCapturing(true);
    } catch (err: any) {
      console.error("Screen capture error:", err);
      throw new Error(err.message || "Failed to capture screen");
    }
  };

  const stopCapture = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCapturing(false);
    setCurrentConcept(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopRecording();
  }, [stream]);

  const captureAudioChunks = async function* () {
    yield new Blob();
    return;
  };

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
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      
      const wsUrl = `${API_URL.replace(/^http/, "ws")}/transcription/live/${lectureId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setRecordingStatus('recording');
        recorder.start(3000);
      };

      ws.onerror = (e) => {
        console.error("Transcription WS error", e);
        setRecordingStatus('error');
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.onerror = () => {
        setRecordingStatus('error');
      };

    } catch (e) {
      console.error("MediaRecorder setup error:", e);
      setRecordingStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRecordingStatus('idle');
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
    captureAudioChunks,
    startRecording,
    stopRecording,
    recordingStatus,
    captureFrame,
    currentConcept,
    sendFrameForAnalysis,
  };
}
