"use client";

/**
 * Pensieve — post-lecture analytics (Phase 7).
 *
 * Top-3 worst moments + confusion density timeline from Actian Vector SQL.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TopConfusingMoment } from "@/lib/types";

export default function PensievePage() {
  const [moments, setMoments] = useState<TopConfusingMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO Phase 7: wire to real /analytics/top-moments endpoint
    api
      .getTopMoments(1)
      .then(setMoments)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>📜 Pensieve</h1>
        <a href="/dashboard" style={styles.backLink}>← Back to Radar</a>
      </header>

      <section>
        <h2>Top Confusing Moments</h2>
        {loading && <p>Consulting the Pensieve...</p>}
        {error && <p style={{ color: "var(--lost-red)" }}>Error: {error}</p>}
        {!loading && !error && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Concept Node</th>
                <th style={styles.th}>Lost Count</th>
                <th style={styles.th}>Total Signals</th>
                <th style={styles.th}>Avg Density</th>
              </tr>
            </thead>
            <tbody>
              {moments.map((m, i) => (
                <tr key={i}>
                  <td style={styles.td}>{m.concept_node}</td>
                  <td style={styles.td}>{m.lost_count}</td>
                  <td style={styles.td}>{m.total_signals}</td>
                  <td style={styles.td}>{(m.avg_density * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* TODO Phase 7: confusion density timeline chart */}
      {/* TODO Phase 7: one-click "re-teach plan" button per moment */}
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    padding: "1.5rem",
    maxWidth: "900px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
  },
  title: {
    color: "var(--gryffindor-gold)",
  },
  backLink: {
    color: "var(--gryffindor-gold)",
    textDecoration: "none",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginTop: "1rem",
  },
  th: {
    textAlign: "left" as const,
    padding: "0.75rem",
    borderBottom: "2px solid var(--gryffindor-gold)",
    color: "var(--gryffindor-gold)",
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
};
