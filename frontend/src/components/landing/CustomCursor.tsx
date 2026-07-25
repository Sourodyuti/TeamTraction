"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CustomCursor.module.css";

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const cursor = cursorRef.current;
    const follower = followerRef.current;
    if (!cursor || !follower) return;

    let animationFrame: number;

    const animate = () => {
      const cursorRect = cursor.getBoundingClientRect();
      const followerRect = follower.getBoundingClientRect();

      const cursorX = cursorRect.left + cursorRect.width / 2;
      const cursorY = cursorRect.top + cursorRect.height / 2;

      const followerX = followerRect.left + followerRect.width / 2;
      const followerY = followerRect.top + followerRect.height / 2;

      const dx = cursorX - followerX;
      const dy = cursorY - followerY;

      follower.style.transform = `translate(${dx * 0.15}px, ${dy * 0.15}px)`;

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [isVisible]);

  // Add hover listeners to interactive elements
  useEffect(() => {
    const handleHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button, a, [role=button], .interactive")
      ) {
        setIsHovering(true);
      }
    };

    const handleHoverEnd = () => setIsHovering(false);

    document.addEventListener("mouseover", handleHover);
    document.addEventListener("mouseout", handleHoverEnd);

    return () => {
      document.removeEventListener("mouseover", handleHover);
      document.removeEventListener("mouseout", handleHoverEnd);
    };
  }, []);

  if (typeof window === "undefined") return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          * {
            cursor: none !important;
          }
          button, a, input, textarea, select, [role="button"], .interactive {
            cursor: none !important;
          }
          @media (prefers-reduced-motion: reduce), (max-width: 1024px) {
            * {
              cursor: auto !important;
            }
          }
        `
      }} />
      <div
        ref={cursorRef}
        className={`${styles.cursor} ${isVisible ? styles.visible : ""} ${isClicking ? styles.clicking : ""} ${isHovering ? styles.hovering : ""}`}
        style={{ left: mousePos.x, top: mousePos.y }}
        aria-hidden="true"
      >
        <div className={styles.cursorRing} />
        <div className={styles.cursorDot} />
      </div>
      <div
        ref={followerRef}
        className={`${styles.follower} ${isVisible ? styles.visible : ""} ${isHovering ? styles.hovering : ""}`}
        aria-hidden="true"
      >
        <div className={styles.followerRing} />
      </div>
    </>
  );
}