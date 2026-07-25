"use client";

import styles from "./Badge.module.css";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "gold" | "cyan" | "emerald" | "crimson" | "amber" | "spell";
  size?: "sm" | "md" | "lg";
  spell?: "muffliato" | "marauders" | "accio" | "gemino" | "sonorus" | "pensieve";
  className?: string;
}

export function Badge({
  children,
  variant = "gold",
  size = "md",
  spell,
  className = "",
}: BadgeProps) {
  const spellVariants: Record<string, string> = {
    muffliato: "muffliato",
    marauders: "marauders",
    accio: "accio",
    gemino: "gemino",
    sonorus: "sonorus",
    pensieve: "pensieve",
  };

  const variantClass = spell ? styles[spellVariants[spell]] : styles[variant];

  return (
    <span className={`${styles.badge} ${styles[size]} ${variantClass} ${className}`}>
      {children}
    </span>
  );
}