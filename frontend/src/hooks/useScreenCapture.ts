"use client";

import { useRef, useState, useCallback } from "react";

export function useScreenCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'error'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startCapture = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: true
      });
      setStream(displayStream);
      setIsCapturing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
      }
      displayStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };
    } catch (err: any) {
      console.error("Screen capture error:", err);
      throw new Error(err.message || "Failed to capture screen");
    }
  };

  const stopCapture = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCapturing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopRecording();
  }, [stream]);

  const captureAudioChunks = async function* () {
    // This is optional if we use the MediaRecorder pattern directly in startRecording
    yield new Blob();
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
      
      const wsUrl = `ws://localhost:8001/transcription/live/${lectureId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setRecordingStatus('recording');
        recorder.start(3000); // chunk every 3 seconds
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

  return {
    startCapture,
    stopCapture,
    stream,
    videoRef,
    isCapturing,
    captureAudioChunks,
    startRecording,
    stopRecording,
    recordingStatus
  };
}
