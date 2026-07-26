"use client";

import { useState, useEffect } from "react";

export function useOverlayState() {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Bottom right default logic will be in component, we'll store relative offsets or absolute.
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const savedPos = localStorage.getItem("overlay_position");
    if (savedPos) {
      try {
        setPosition(JSON.parse(savedPos));
      } catch (e) {}
    } else {
      // Default position logic
      setPosition({ x: typeof window !== 'undefined' ? window.innerWidth - 350 : 0, y: typeof window !== 'undefined' ? window.innerHeight - 300 : 0 });
    }
  }, []);

  const updatePosition = (newPos: { x: number; y: number }) => {
    setPosition(newPos);
    localStorage.setItem("overlay_position", JSON.stringify(newPos));
  };

  return {
    overlayVisible,
    setOverlayVisible,
    position,
    setPosition: updatePosition,
    opacity,
    setOpacity
  };
}
