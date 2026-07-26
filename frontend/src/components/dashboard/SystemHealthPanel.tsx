"use client";

/**
 * SystemHealthPanel — grid of service cards showing the health of every
 * Legilimens component (the "sponsor showcase" panel).
 *
 * Each card is green/red with its model or config detail. This is the
 * developer/ops view of the whole stack at a glance.
 */
import type { ServiceCard } from "@/lib/types";

interface Props {
  services: ServiceCard[];
  loading?: boolean;
}

export function SystemHealthPanel({ services, loading }: Props) {
  if (loading || !services.length) {
    return (
      <div style={styles.grid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer" style={styles.skeleton} />
        ))}
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {services.map((svc) => (
        <div
          key={svc.key}
          style={{
            ...styles.card,
            borderColor: svc.healthy ? `${svc.spellColor}55` : "rgba(220,20,60,0.4)",
            boxShadow: svc.healthy ? `0 0 12px ${svc.spellColor}22` : "none",
          }}
        >
          <div style={styles.cardTop}>
            <span
              style={{
                ...styles.statusDot,
                background: svc.healthy ? "#50C878" : "#DC143C",
                boxShadow: svc.healthy ? "0 0 8px #50C87888" : "0 0 8px #DC143C88",
              }}
            />
            <span style={{ ...styles.cardName, color: svc.spellColor }}>{svc.name}</span>
          </div>
          <div style={styles.cardDetail}>{svc.detail ?? (svc.healthy ? "operational" : "unavailable")}</div>
          <div style={{ ...styles.cardStatus, color: svc.healthy ? "#50C878" : "#DC143C" }}>
            {svc.healthy ? "● operational" : "● offline"}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "0.9rem",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "1rem 1.1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    flexShrink: 0,
    animation: "pulse 2s ease-in-out infinite",
  },
  cardName: {
    fontFamily: '"Inter", sans-serif',
    fontSize: "0.88rem",
    fontWeight: 600,
  },
  cardDetail: {
    fontSize: "0.72rem",
    color: "rgba(245,230,200,0.5)",
    fontFamily: '"JetBrains Mono", monospace',
  },
  cardStatus: {
    fontSize: "0.72rem",
    marginTop: "0.2rem",
    fontWeight: 600,
  },
  skeleton: {
    height: 92,
    borderRadius: 12,
  },
};
