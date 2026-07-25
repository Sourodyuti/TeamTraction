"use client";

import styles from "./Section.module.css";

export interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  variant?: "default" | "dark" | "accent" | "parchment";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  innerClassName?: string;
}

export function Section({
  children,
  className = "",
  id,
  variant = "default",
  size = "xl",
  innerClassName = "",
}: SectionProps) {
  const variantClasses = {
    default: "",
    dark: styles.dark,
    accent: styles.accent,
    parchment: styles.parchment,
  };

  const sizeClasses = {
    sm: styles.sm,
    md: styles.md,
    lg: styles.lg,
    xl: styles.xl,
    full: styles.full,
  };

  return (
    <section
      id={id}
      className={`${styles.section} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <div className={`${styles.container} ${innerClassName}`}>
        {children}
      </div>
    </section>
  );
}

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.container} ${className}`}>{children}</div>;
}