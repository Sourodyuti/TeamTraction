"use client";

import styles from "./Card.module.css";

export interface CardProps {
  children: React.ReactNode;
  variant?: "parchment" | "dark" | "spell";
  spell?: "muffliato" | "marauders" | "accio" | "gemino" | "sonorus" | "pensieve";
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  role?: string;
  style?: React.CSSProperties;
}

export function Card({
  children,
  variant = "parchment",
  spell,
  className = "",
  hover = false,
  onClick,
}: CardProps) {
  const spellVariants: Record<string, string> = {
    muffliato: "muffliato",
    marauders: "marauders",
    accio: "accio",
    gemino: "gemino",
    sonorus: "sonorus",
    pensieve: "pensieve",
  };

  const variantClass = spell ? styles[spellVariants[spell]] : styles[variant];
  const interactive = hover || onClick;

  return (
    <div
      className={`${styles.card} ${variantClass} ${interactive ? styles.interactive : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.header} ${className}`}>{children}</div>;
}

export function CardContent({
  children,
  className = "",
}: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.content} ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.footer} ${className}`}>{children}</div>;
}