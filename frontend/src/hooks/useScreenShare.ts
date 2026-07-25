"use client";

import { useCallback, useRef, useState } from "react";

interface UseScreenShareReturn {
  isSharing: boolean;
  stream: MediaStream | null;
  startShare: () => Promise<void>;
  stopShare: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  error: string | null;
}

export function useScreenShare(): UseScreenShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startShare = useCallback(async () => {
    try {
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          cursor: "always",
        } as MediaTrackConstraints,
        audio: false,
      });

      setStream(mediaStream);
      setIsSharing(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      mediaStream.getVideoTracks()[0].onended = () => {
        setIsSharing(false);
        setStream(null);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start screen share");
      setIsSharing(false);
    }
  }, []);

  const stopShare = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsSharing(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  return {
    isSharing,
    stream,
    startShare,
    stopShare,
    videoRef,
    error,
  };
}
