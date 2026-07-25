"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FloatingBackground.module.css";

export interface FloatingParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  color: "gold" | "cyan" | "silver";
}

export function FloatingBackground({
  particleCount = 30,
  className = "",
  spellTheme,
}: {
  particleCount?: number;
  className?: string;
  spellTheme?: "muffliato" | "marauders" | "accio" | "gemino" | "sonorus" | "pensieve";
}) {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newParticles: FloatingParticle[] = [];
    const colors: FloatingParticle["color"][] = spellTheme === "muffliato"
      ? ["cyan", "silver", "cyan"]
      : spellTheme === "accio"
      ? ["gold", "gold", "silver"]
      : spellTheme === "gemino"
      ? ["silver", "gold", "silver"]
      : spellTheme === "sonorus"
      ? ["gold", "gold", "silver"]
      : spellTheme === "pensieve"
      ? ["silver", "gold", "silver"]
      : ["gold", "cyan", "silver"];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 1,
        opacity: Math.random() * 0.5 + 0.1,
        delay: Math.random() * 5,
        duration: Math.random() * 10 + 8,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    setParticles(newParticles);
  }, [particleCount, spellTheme]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className}`}
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`${styles.particle} ${styles[particle.color]}`}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          } as React.CSSProperties}
        />
      ))}
      <div className={styles.glow} />
      <div className={styles.glow2} />
    </div>
  );
}