"use client";

/**
 * Legilimens Command Center — the rebuilt teacher dashboard.
 *
 * A single tabbed surface visualizing the whole pipeline:
 *   Muffliato → Marauder's Radar → Accio (Actian VectorAI) →
 *   Gemino (Gemini/NVIDIA) → Sonorus (ElevenLabs) → Pensieve.
 *
 * Data layer: the existing typed `api` client + WebSocket hooks only.
 *
 * Two WebSocket connections to the same lecture are intentional and harmless:
 *   - useRadarData drives the live radar/timeline/alert/analogy state.
 *   - useWebSocket (shell) exposes sendPing + connected for the DemoController's
 *     confusion wave. The backend fans out broadcasts to all lecture connections,
 *     so the radar instance receives the wave's pings too.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRadarData } from "@/hooks/useRadarData";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useDashboardPolling } from "@/hooks/useDashboardPolling";
import { useConfusionWave } from "@/hooks/useConfusionWave";
import { api } from "@/lib/api";
import { DemoController } from "@/components/dashboard/DemoController";
import { KpiBar } from "@/components/dashboard/KpiBar";
import { LiveRadarTab } from "@/components/dashboard/LiveRadarTab";
import { PensieveAnalyticsTab } from "@/components/dashboard/PensieveAnalyticsTab";
import { AIPipelineTab } from "@/components/dashboard/AIPipelineTab";
import { SystemTab } from "@/components/dashboard/SystemTab";

type TabKey = "radar" | "analytics" | "pipeline" | "system";

const TABS: { key: TabKey; label: string; icon: string; spell: string }[] = [
  { key: "radar", label: "Live Radar", icon: "🛰️", spell: "marauders" },
  { key: "analytics", label: "Analytics", icon: "📜", spell: "pensieve" },
  { key: "pipeline", label: "AI Pipeline", icon: "⚡", spell: "accio" },
  { key: "system", label: "System", icon: "🔌", spell: "gemino" },
];

const SPELL_COLORS: Record<string, string> = {
  marauders: "#D4AF37",
  pensieve: "#8A2BE2",
  accio: "#FF6B35",
  gemino: "#BB86FC",
};

export default function DashboardPage() {
  const [lectureId, setLectureId] = useState(1);
  const [tab, setTab] = useState<TabKey>("radar");
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const [kpiData, setKpiData] = useState<{
    total: number;
    lost: number;
    gotit: number;
    metrics: Awaited<ReturnType<typeof api.metrics>> | null;
    lastLatencyTotal: number | null;
  } | null>(null);

  const { user, loading: authLoading, logout, requireAuth } = useAuth();
  const radar = useRadarData(lectureId);
  // Separate WS connection for the confusion-wave sendPing + connected flag.
  const { connected: wsConnected, sendPing } = useWebSocket(lectureId, "teacher", "dashboard-controller");
  const { wave, triggerWave } = useConfusionWave(lectureId, sendPing, wsConnected);
  const { health: sysHealth } = useDashboardPolling(5000);

  // Teacher-only guard.
  useEffect(() => {
    requireAuth("teacher");
  }, [requireAuth]);

  // Load KPI data (summary + metrics + last latency).
  const loadKpis = useCallback(async () => {
    try {
      const [summary, metrics] = await Promise.all([
        api.getSummary(lectureId).catch(() => ({ total: 0, lost: 0, gotit: 0 })),
        api.metrics().catch(() => null),
      ]);
      setKpiData({
        total: summary.total,
        lost: summary.lost,
        gotit: summary.gotit,
        metrics,
        lastLatencyTotal: radar.latencyBadge?.total_ms ?? null,
      });
    } catch {
      /* non-fatal */
    }
  }, [lectureId, radar.latencyBadge?.total_ms]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis, analyticsRefreshKey, radar.latencyBadge]);

  // Redirect legacy /dashboard/pensieve viewers: they can just open the Analytics tab here.

  if (authLoading || !user) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingIcon}>🔮</div>
        <div style={styles.loadingText}>Verifying access…</div>
      </div>
    );
  }

  const actianHealthy = sysHealth.health?.services.actian_vector ?? false;

  return (
    <main className="lg-dash-main" style={styles.main}>
      <style>{globalStyles}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 className="lg-dash-title" style={styles.title}>
            <span style={styles.titleIcon}>📡</span> Legilimens Command Center
          </h1>
          <div style={styles.lectureInput}>
            <label style={styles.inputLabel}>Lecture</label>
            <input
              type="number"
              min={1}
              value={lectureId}
              onChange={(e) => setLectureId(Number(e.target.value) || 1)}
              style={styles.input}
            />
          </div>
        </div>
        <div style={styles.headerRight}>
          <Pill
            ok={wsConnected}
            okLabel="WS live"
            badLabel="WS off"
            okColor="#50C878"
          />
          <Pill
            ok={actianHealthy}
            okLabel="Actian Vector"
            badLabel="SQLite fallback"
            okColor="#D4AF37"
          />
          {user && (
            <div style={styles.userBadge}>
              <div style={styles.userAvatar}>{user.username[0].toUpperCase()}</div>
              <div style={styles.userMeta}>
                <span style={styles.userName}>{user.username}</span>
                <span style={styles.userRole}>{user.role}</span>
              </div>
              <button onClick={logout} style={styles.logoutBtn} title="Sign out">↩</button>
            </div>
          )}
        </div>
      </header>

      {/* Demo controller (sticky) */}
      <DemoController
        lectureId={lectureId}
        wsConnected={wsConnected}
        onLoad={() => setAnalyticsRefreshKey((k) => k + 1)}
        triggerWave={(c, n) => triggerWave(c, n)}
        waveMessage={wave.message}
        waveFiring={wave.firing}
      />

      {/* KPI bar */}
      <KpiBar data={kpiData} loading={!kpiData} />

      {/* Tabs */}
      <nav style={styles.tabNav}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...styles.tab,
              color: tab === t.key ? SPELL_COLORS[t.spell] : "rgba(245,230,200,0.5)",
              borderColor: tab === t.key ? SPELL_COLORS[t.spell] : "transparent",
              background: tab === t.key ? `${SPELL_COLORS[t.spell]}15` : "transparent",
            }}
          >
            <span style={styles.tabIcon}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Active tab */}
      <div className="lg-dash-tab-body" style={styles.tabBody}>
        {tab === "radar" && (
          <LiveRadarTab
            conceptNodes={radar.conceptNodes}
            timelineData={radar.timelineData}
            latencyBadge={radar.latencyBadge}
            confusionAlert={radar.confusionAlert}
            lastAnalogy={radar.lastAnalogy}
            totalStudents={radar.totalStudents}
            currentTopic={radar.currentTopic}
          />
        )}
        {tab === "analytics" && (
          <PensieveAnalyticsTab lectureId={lectureId} refreshKey={analyticsRefreshKey} />
        )}
        {tab === "pipeline" && <AIPipelineTab latencyBadge={radar.latencyBadge} />}
        {tab === "system" && <SystemTab health={sysHealth} />}
      </div>

      {/* Footer links to other surfaces */}
      <footer style={styles.footer}>
        <span style={styles.footerText}>
          Spells: <em>Muffliato</em> capture · <em>Marauder&apos;s</em> radar · <em>Accio</em> retrieval (Actian VectorAI) · <em>Gemino</em> LLM (Gemini/NVIDIA) · <em>Sonorus</em> TTS (ElevenLabs) · <em>Pensieve</em> analytics (Actian Vector)
        </span>
      </footer>
    </main>
  );
}

function Pill({ ok, okLabel, badLabel, okColor }: { ok: boolean; okLabel: string; badLabel: string; okColor: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.3rem 0.7rem",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontFamily: '"JetBrains Mono", monospace',
        background: ok ? `${okColor}15` : "rgba(220,20,60,0.1)",
        border: `1px solid ${ok ? `${okColor}55` : "rgba(220,20,60,0.4)"}`,
        color: ok ? okColor : "#DC143C",
      }}
      title={ok ? okLabel : badLabel}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: ok ? okColor : "#DC143C",
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
      {ok ? okLabel : badLabel}
    </div>
  );
}

const globalStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.08); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .lg-dash-tab-body { animation: fadeIn 0.3s ease-out; }

  /* Responsive: collapse multi-column layouts on smaller / projector-friendlier widths. */
  @media (max-width: 1100px) {
    .lg-dash-radar-grid { grid-template-columns: 1fr !important; }
    .lg-dash-two-col { grid-template-columns: 1fr !important; }
    .lg-dash-pipeline { flex-direction: column !important; }
    .lg-dash-pipeline .lg-dash-arrow { transform: rotate(90deg); }
  }
  @media (max-width: 768px) {
    .lg-dash-main { padding: 1rem !important; }
    .lg-dash-title { font-size: 1.3rem !important; }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: "1.5rem",
    maxWidth: 1500,
    margin: "0 auto",
    color: "#F5E6C8",
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.25rem",
    flexWrap: "wrap",
    gap: "1rem",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" },
  title: {
    fontFamily: '"Cinzel", serif',
    color: "#D4AF37",
    margin: 0,
    fontSize: "1.6rem",
    letterSpacing: "0.02em",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  titleIcon: { fontSize: "1.4rem" },
  lectureInput: { display: "flex", alignItems: "center", gap: "0.4rem" },
  inputLabel: { fontSize: "0.75rem", color: "rgba(245,230,200,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: {
    width: 60,
    background: "rgba(0,0,0,0.4)",
    color: "#F5E6C8",
    border: "1px solid rgba(212,175,55,0.3)",
    borderRadius: "6px",
    padding: "0.3rem 0.5rem",
    fontFamily: '"JetBrains Mono", monospace',
  },
  headerRight: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" },
  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "rgba(212,175,55,0.08)",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: "10px",
    padding: "0.35rem 0.7rem",
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7c3aed, #D4AF37)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#fff",
  },
  userMeta: { display: "flex", flexDirection: "column", lineHeight: 1.15 },
  userName: { fontWeight: 700, fontSize: "0.82rem", color: "#D4AF37" },
  userRole: { fontSize: "0.66rem", color: "rgba(245,230,200,0.45)", textTransform: "uppercase" },
  logoutBtn: {
    background: "none",
    border: "none",
    color: "rgba(245,230,200,0.4)",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "0 0.1rem",
  },
  tabNav: {
    display: "flex",
    gap: "0.4rem",
    borderBottom: "1px solid rgba(212,175,55,0.15)",
    marginBottom: "1.25rem",
    flexWrap: "wrap",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.6rem 1rem",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    fontFamily: '"Cinzel", serif',
    fontSize: "0.88rem",
    fontWeight: 600,
    transition: "all 0.2s",
    marginBottom: "-1px",
  },
  tabIcon: { fontSize: "0.95rem" },
  tabBody: { animation: "fadeIn 0.3s ease-out", paddingBottom: "2rem" },
  footer: {
    marginTop: "2rem",
    paddingTop: "1rem",
    borderTop: "1px solid rgba(212,175,55,0.1)",
    textAlign: "center",
  },
  footerText: { fontSize: "0.72rem", color: "rgba(245,230,200,0.35)", lineHeight: 1.6 },
  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    background: "#0D0714",
  },
  loadingIcon: { fontSize: "3rem", animation: "pulse 2s ease-in-out infinite" },
  loadingText: { fontFamily: '"Cinzel", serif', color: "#D4AF37", fontSize: "1.2rem" },
};
