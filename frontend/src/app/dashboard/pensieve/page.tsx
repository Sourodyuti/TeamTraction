"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TopConfusingMoment, CohortCell } from "@/lib/types";
import Link from "next/link";

export default function PensievePage() {
  const [moments, setMoments] = useState<TopConfusingMoment[]>([]);
  const [density, setDensity] = useState<{ ts: string; density: number }[]>([]);
  const [heatmap, setHeatmap] = useState<CohortCell[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("legilimens_token") : null;
    if (!token) {
      setIsAuth(false);
      return;
    }
    setIsAuth(true);

    const loadData = async () => {
      try {
        const [mRes, dRes, hRes] = await Promise.all([
          api.getTopMoments(1),
          api.getDensity(1),
          api.getCohortHeatmap(1)
        ]);
        setMoments(mRes);
        setDensity(dRes);
        setHeatmap(hRes);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleReteach = async (conceptNode: string) => {
    try {
      await api.triggerAnalogy(1, conceptNode);
    } catch (err) {
      console.error(err);
    }
  };

  if (isAuth === false) {
    return (
      <div style={styles.centerAuth}>
        <h2>Not Authorized</h2>
        <Link href="/login" style={{ color: "var(--gryffindor-gold)" }}>Go to Login</Link>
      </div>
    );
  }

  const maxDensity = density.length > 0 ? Math.max(...density.map(d => d.density)) : 1;

  // Process Heatmap Data — CohortCell has concept_node, hour, avg_density
  const uniqueNodes = Array.from(new Set(heatmap.map(h => h.concept_node)));
  const uniqueHours = Array.from(new Set(heatmap.map(h => h.hour))).sort((a, b) => a - b);

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>📜 Pensieve Analytics</h1>
        <Link href="/dashboard" style={styles.backLink}>← Back to Radar</Link>
      </header>

      {error && <div style={{ color: "var(--lost-red)", padding: "1rem" }}>{error}</div>}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Top Confusing Moments</h2>
        {loading ? (
          <div style={styles.skeletonContainer}>
            <div className="shimmer" style={styles.skeletonRow}></div>
            <div className="shimmer" style={styles.skeletonRow}></div>
            <div className="shimmer" style={styles.skeletonRow}></div>
          </div>
        ) : (
          <div style={styles.cardContainer}>
            {moments.map((m, i) => (
              <div key={i} style={styles.parchmentRow}>
                <div style={styles.rowInfo}>
                  <div style={styles.conceptName}>{m.concept_node.replace(/_/g, " ")}</div>
                  <div style={styles.stats}>
                    Lost: <span style={styles.goldText}>{m.lost_count}</span> | 
                    Avg Density: <span style={styles.goldText}>{(m.avg_density * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <button style={styles.reteachBtn} onClick={() => handleReteach(m.concept_node)}>
                  🪄 Re-teach
                </button>
              </div>
            ))}
            {moments.length === 0 && <p style={styles.emptyText}>No confusing moments found.</p>}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Confusion Density Timeline</h2>
        {loading ? (
          <div className="shimmer" style={styles.skeletonChart}></div>
        ) : (
          <div style={styles.chartContainer}>
            {density.length > 0 ? (
              <svg width="100%" height="200" preserveAspectRatio="none">
                {density.map((d, i) => {
                  const barWidth = 100 / density.length;
                  const barHeight = ((d.density / maxDensity) * 180) || 0;
                  return (
                    <rect
                      key={i}
                      x={`${i * barWidth}%`}
                      y={200 - barHeight}
                      width={`${barWidth}%`}
                      height={barHeight}
                      fill="var(--gryffindor-gold)"
                      opacity={0.8}
                      rx="2"
                    />
                  );
                })}
              </svg>
            ) : (
              <p style={styles.emptyText}>No density data available.</p>
            )}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Cohort Heatmap</h2>
        {loading ? (
          <div className="shimmer" style={styles.skeletonChart}></div>
        ) : (
          <div style={styles.heatmapContainer}>
            {heatmap.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {/* Header row: concept nodes */}
                <div style={{ display: "flex", gap: "2px" }}>
                  <div style={{ ...styles.cellHeader, minWidth: 40 }}>Hour</div>
                  {uniqueNodes.map(node => (
                    <div key={node} style={styles.cellHeaderTop}>{node.replace(/_/g," ").substring(0, 12)}</div>
                  ))}
                </div>
                {/* Data rows: one per hour */}
                {uniqueHours.map(hour => (
                  <div key={hour} style={{ display: "flex", gap: "2px" }}>
                    <div style={{ ...styles.cellHeader, minWidth: 40 }}>{hour}h</div>
                    {uniqueNodes.map(node => {
                      const record = heatmap.find(h => h.hour === hour && h.concept_node === node);
                      const score = record ? record.avg_density : 0;
                      return (
                        <div key={`${hour}-${node}`} style={{
                          ...styles.cell,
                          background: score > 0.5 ? "var(--gryffindor-gold)" : "var(--gotit-green)",
                          opacity: score > 0 ? 0.3 + (score * 0.7) : 0.1
                        }}></div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.emptyText}>No heatmap data available.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  centerAuth: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem"
  },
  main: {
    minHeight: "100vh",
    padding: "2rem",
    maxWidth: "1000px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "3rem",
    borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
    paddingBottom: "1rem",
  },
  title: {
    color: "var(--gryffindor-gold)",
    margin: 0,
  },
  backLink: {
    color: "var(--gryffindor-gold)",
    textDecoration: "none",
    opacity: 0.8,
  },
  section: {
    marginBottom: "3rem",
  },
  sectionTitle: {
    color: "var(--text-primary)",
    marginBottom: "1.5rem",
    fontSize: "1.4rem",
  },
  cardContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  parchmentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(145deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)",
    border: "1px solid rgba(212, 175, 55, 0.3)",
    borderRadius: "8px",
    padding: "1.5rem",
    boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
  },
  rowInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  conceptName: {
    fontSize: "1.2rem",
    fontWeight: "bold",
    color: "var(--text-primary)",
  },
  stats: {
    color: "var(--text-secondary)",
    fontSize: "0.9rem",
  },
  goldText: {
    color: "var(--gryffindor-gold)",
    fontWeight: "bold",
  },
  reteachBtn: {
    background: "var(--gryffindor-gold)",
    color: "#000",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "transform 0.2s",
  },
  chartContainer: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "8px",
    padding: "2rem",
    height: "250px",
  },
  heatmapContainer: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "8px",
    padding: "2rem",
    overflowX: "auto" as const,
  },
  cellHeader: {
    width: "80px",
    color: "var(--text-secondary)",
    fontSize: "0.8rem",
    textAlign: "right" as const,
    paddingRight: "0.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  cellHeaderTop: {
    width: "40px",
    color: "var(--text-secondary)",
    fontSize: "0.7rem",
    transform: "rotate(-45deg)",
    transformOrigin: "bottom left",
    whiteSpace: "nowrap" as const,
    marginBottom: "10px",
  },
  cell: {
    width: "40px",
    height: "40px",
    borderRadius: "4px",
  },
  skeletonContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  skeletonRow: {
    height: "80px",
    borderRadius: "8px",
  },
  skeletonChart: {
    height: "250px",
    borderRadius: "8px",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
    textAlign: "center" as const,
  }
};
