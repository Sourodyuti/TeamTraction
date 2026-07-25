import styles from "./Button.module.css";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "ghost" | "outline" | "spell";
  size?: "sm" | "md" | "lg";
  spell?: "muffliato" | "marauders" | "accio" | "gemino" | "sonorus" | "pensieve";
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "gold",
  size = "md",
  spell,
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  style,
  ...props
}: ButtonProps) {
  const spellColors: Record<string, string> = {
    muffliato: "var(--spell-muffliato)",
    marauders: "var(--spell-marauders)",
    accio: "var(--spell-accio)",
    gemino: "var(--spell-gemino)",
    sonorus: "var(--spell-sonorus)",
    pensieve: "var(--spell-pensieve)",
  };

  const spellColor = spell ? spellColors[spell] : undefined;

  const baseStyles: React.CSSProperties = {
    ...style,
    ...(spellColor ? { "--spell-color": spellColor } : {}),
  };

  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ""} ${loading ? styles.loading : ""} ${disabled ? styles.disabled : ""} ${className}`}
      disabled={disabled || loading}
      style={baseStyles}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={loading ? styles.hidden : ""}>{children}</span>
      {loading && !props["aria-label"] && <span className={styles.srOnly}>Loading...</span>}
    </button>
  );
}