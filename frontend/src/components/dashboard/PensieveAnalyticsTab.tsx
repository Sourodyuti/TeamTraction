"use client";

/**
 * PensieveAnalyticsTab — the Actian Vector columnar-analytics showcase.
 *
 * This is where the two backend/frontend contract fixes pay off:
 *   - Density: derived from raw {ts,type} events via eventsToDensityTimeline.
 *   - Cohort heatmap: the {node:{lost,gotit}} map normalized via cohortMapToGrid.
 *
 * Shows: KPI summary, rolling-density area chart, top-confusing-moments
 * ranked list (with re-teach), and a concept×{lost,gotit} heatmap grid.
 */
import { useEffect, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { api } from "@/lib/api";
import {
  eventsToDensityTimeline,
  cohortMapToGrid,
} from "@/lib/analytics-transforms";
import type {
  TopConfusingMoment,
  DensityEvent,
  CohortRow,
} from "@/lib/types";

interface Props {
  lectureId: number;
  refreshKey: number; // bumped by DemoController to force a re-fetch after seeding
}

export function PensieveAnalyticsTab({ lectureId, refreshKey }: Props) {
  const [summary, setSummary] = useState<{ total: number; lost: number; gotit: number } | null>(null);
  const [moments, setMoments] = useState<TopConfusingMoment[]>([]);
  const [densitySeries, setDensitySeries] = useState<{ ts: number; density: number }[]>([]);
  const [cohort, setCohort] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, momRes, densRes, cohRes] = await Promise.all([
        api.getSummary(lectureId),
        api.getTopMoments(lectureId, 10),
        api.getDensity(lectureId),
        api.getCohortHeatmap(lectureId),
      ]);
      setSummary(sumRes);
      setMoments(momRes);
      setDensitySeries(eventsToDensityTimeline(densRes.data as DensityEvent[], 60));
      setCohort(cohortMapToGrid(cohRes));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [lectureId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleReteach = async (concept: string) => {
    try {
      await api.triggerAnalogy(lectureId, concept);
    } catch (e) {
      console.error("re-teach failed", e);
    }
  };

  if (loading) {
    return (
      <div style={styles.wrap}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 200, borderRadius: 12, marginBottom: "1.25rem" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorBox}>
        <div style={styles.errorTitle}>Analytics unavailable</div>
        <div style={styles.errorDetail}>{error}</div>
        <div style={styles.errorHint}>
          Is the backend running? Try <strong>Load demo data</strong> after it starts.
        </div>
      </div>
    );
  }

  const hasData = (summary?.total ?? 0) > 0;
  const maxMoment = moments.length > 0 ? Math.max(...moments.map((m) => m.lost_count), 1) : 1;

  return (
    <div style={styles.wrap}>
      {/* Summary KPIs */}
      <div style={styles.kpiRow}>
        <KpiTile label="Total Signals" value={summary?.total ?? 0} color="#D4AF37" icon="📡" />
        <KpiTile label="Lost" value={summary?.lost ?? 0} color="#DC143C" icon="🪄" />
        <KpiTile label="Got It" value={summary?.gotit ?? 0} color="#50C878" icon="✅" />
        <KpiTile
          label="Lost Rate"
          value={summary && summary.total > 0 ? `${Math.round((summary.lost / summary.total) * 100)}%` : "—"}
          color="#BB86FC"
          icon="📊"
          isText
        />
      </div>

      {!hasData && (
        <div style={styles.empty}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📜</div>
          <div style={styles.emptyTitle}>No analytics yet</div>
          <div style={styles.emptyHint}>Hit <strong>“Load demo data”</strong> to populate the Pensieve.</div>
        </div>
      )}

      {/* Density timeline */}
      {hasData && densitySeries.length > 0 && (
        <section style={styles.card}>
          <h2 style={styles.h2}>📈 Rolling Confusion Density (60s window)</h2>
          <p style={styles.hint}>
            Derived client-side from raw confusion events. Crosses the trigger line when ≥25% lost.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={densitySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="densityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="ts"
                scale="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                stroke="rgba(245,230,200,0.4)"
                fontSize={11}
              />
              <YAxis
                domain={[0, 1]}
                stroke="rgba(245,230,200,0.4)"
                fontSize={11}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{ background: "#1A0F2E", border: "1px solid #D4AF37", borderRadius: 8 }}
                labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                formatter={(v: number) => [`${(v * 100).toFixed(0)}%`, "Confusion"]}
              />
              <ReferenceLine y={0.25} stroke="#DC143C" strokeDasharray="5 5" label={{ value: "trigger", fill: "#DC143C", fontSize: 10 }} />
              <Area type="monotone" dataKey="density" stroke="#D4AF37" strokeWidth={2} fill="url(#densityGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Top moments + cohort heatmap side by side */}
      {hasData && (
        <div className="lg-dash-two-col" style={styles.twoCol}>
          <section style={styles.card}>
            <h2 style={styles.h2}>🏆 Top Confusing Moments</h2>
            <p style={styles.hint}>Ranked by lost_count from Actian Vector columnar SQL.</p>
            <div style={styles.momentList}>
              {moments.map((m, i) => (
                <div key={m.concept_node} style={styles.momentRow}>
                  <span style={styles.rank}>#{i + 1}</span>
                  <div style={styles.momentBody}>
                    <div style={styles.momentConcept}>{m.concept_node.replace(/_/g, " ")}</div>
                    <div style={styles.momentBarWrap}>
                      <div
                        style={{
                          ...styles.momentBar,
                          width: `${(m.lost_count / maxMoment) * 100}%`,
                          background:
                            m.avg_density > 0.5
                              ? "linear-gradient(90deg,#f97316,#DC143C)"
                              : "linear-gradient(90deg,#D4AF37,#F0D57A)",
                        }}
                      />
                    </div>
                    <div style={styles.momentStats}>
                      <span style={{ color: "#DC143C" }}>{m.lost_count} lost</span>
                      <span style={{ color: "rgba(245,230,200,0.4)" }}>·</span>
                      <span>{m.total_signals} total</span>
                      <span style={{ color: "rgba(245,230,200,0.4)" }}>·</span>
                      <span style={{ color: "#D4AF37" }}>{Math.round(m.avg_density * 100)}% density</span>
                    </div>
                  </div>
                  <button style={styles.reteachBtn} onClick={() => handleReteach(m.concept_node)} title="Re-trigger Accio analogy">
                    🪄 Re-teach
                  </button>
                </div>
              ))}
              {moments.length === 0 && <div style={styles.emptySmall}>No ranked moments.</div>}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>🔥 Concept Heatmap</h2>
            <p style={styles.hint}>Per-concept lost vs got-it distribution.</p>
            <div style={styles.heatList}>
              {cohort.map((row) => {
                const total = row.lost + row.gotit;
                const lostPct = total > 0 ? (row.lost / total) * 100 : 0;
                const gotitPct = total > 0 ? (row.gotit / total) * 100 : 0;
                return (
                  <div key={row.concept_node} style={styles.heatRow}>
                    <div style={styles.heatLabel}>{row.label}</div>
                    <div style={styles.heatBarWrap}>
                      <div style={{ ...styles.heatLost, width: `${lostPct}%` }}>
                        <span style={styles.heatCount}>{row.lost || ""}</span>
                      </div>
                      <div style={{ ...styles.heatGotit, width: `${gotitPct}%` }}>
                        <span style={styles.heatCount}>{row.gotit || ""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {cohort.length === 0 && <div style={styles.emptySmall}>No heatmap data.</div>}
            </div>
            <div style={styles.legend}>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#DC143C" }} /> lost</span>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#50C878" }} /> got it</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value, color, icon, isText }: { label: string; value: number | string; color: string; icon: string; isText?: boolean }) {
  return (
    <div style={{ ...styles.kpiTile, borderColor: `${color}44` }}>
      <div style={{ fontSize: "1.3rem" }}>{icon}</div>
      <div>
        <div style={{ ...styles.kpiValue, color }}>{isText ? value : value}</div>
        <div style={styles.kpiLabel}>{label}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "0.85rem",
  },
  kpiTile: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "0.85rem 1rem",
  },
  kpiValue: { fontFamily: '"JetBrains Mono", monospace', fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  kpiLabel: { fontSize: "0.7rem", color: "rgba(245,230,200,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "12px",
    padding: "1.25rem",
  },
  h2: { fontFamily: '"Cinzel", serif', color: "#D4AF37", fontSize: "1.05rem", margin: "0 0 0.4rem", letterSpacing: "0.03em" },
  hint: { fontSize: "0.78rem", color: "rgba(245,230,200,0.5)", margin: "0 0 1rem" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" },
  momentList: { display: "flex", flexDirection: "column", gap: "0.85rem" },
  momentRow: { display: "flex", alignItems: "center", gap: "0.85rem" },
  rank: { fontFamily: '"Cinzel", serif', color: "#D4AF37", fontSize: "0.9rem", width: 28, flexShrink: 0 },
  momentBody: { flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" },
  momentConcept: { fontSize: "0.88rem", color: "#F5E6C8", fontWeight: 600 },
  momentBarWrap: { height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" },
  momentBar: { height: "100%", borderRadius: 4, transition: "width 0.5s ease-out" },
  momentStats: { display: "flex", gap: "0.4rem", fontSize: "0.72rem", fontFamily: '"JetBrains Mono", monospace', color: "rgba(245,230,200,0.6)" },
  reteachBtn: {
    background: "rgba(212,175,55,0.15)",
    border: "1px solid rgba(212,175,55,0.5)",
    color: "#D4AF37",
    padding: "0.35rem 0.7rem",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 600,
    flexShrink: 0,
  },
  heatList: { display: "flex", flexDirection: "column", gap: "0.6rem" },
  heatRow: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  heatLabel: { fontSize: "0.82rem", color: "#F5E6C8", textTransform: "capitalize" },
  heatBarWrap: { display: "flex", height: 24, borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,0.06)" },
  heatLost: { background: "linear-gradient(90deg,#DC143C,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.5s ease-out" },
  heatGotit: { background: "linear-gradient(90deg,#059669,#50C878)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.5s ease-out" },
  heatCount: { color: "#fff", fontSize: "0.72rem", fontWeight: 700, fontFamily: '"JetBrains Mono", monospace' },
  legend: { display: "flex", gap: "1.2rem", marginTop: "0.85rem", justifyContent: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "rgba(245,230,200,0.6)" },
  legendDot: { width: 8, height: 8, borderRadius: "50%" },
  empty: { textAlign: "center", padding: "3rem 1rem", color: "rgba(245,230,200,0.4)" },
  emptyTitle: { fontFamily: '"Cinzel", serif', color: "#D4AF37", marginBottom: "0.4rem", fontSize: "1.1rem" },
  emptyHint: { fontSize: "0.85rem" },
  emptySmall: { color: "rgba(245,230,200,0.4)", fontStyle: "italic", fontSize: "0.85rem", padding: "0.5rem 0" },
  errorBox: {
    background: "rgba(220,20,60,0.08)",
    border: "1px solid rgba(220,20,60,0.3)",
    borderRadius: 12,
    padding: "1.5rem",
    textAlign: "center",
  },
  errorTitle: { fontFamily: '"Cinzel", serif', color: "#DC143C", marginBottom: "0.5rem" },
  errorDetail: { fontSize: "0.82rem", color: "rgba(245,230,200,0.6)", fontFamily: '"JetBrains Mono", monospace', marginBottom: "0.5rem" },
  errorHint: { fontSize: "0.8rem", color: "rgba(245,230,200,0.5)" },
};
