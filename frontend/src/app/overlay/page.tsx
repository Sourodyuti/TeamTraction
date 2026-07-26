"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types for Electron IPC bridge (exposed via preload.js)            */
/* ------------------------------------------------------------------ */
interface ElectronScreenAPI {
  capture: () => Promise<{ success: true; dataUrl: string } | { success: false; error: string }>;
  getAccess: () => Promise<string>;
}
interface ElectronWindowAPI {
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  setSize: (w: number, h: number) => Promise<void>;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => Promise<void>;
  focus: () => Promise<void>;
}
interface ElectronAPI {
  screen: ElectronScreenAPI;
  window: ElectronWindowAPI;
  onCaptureAndAsk: (callback: () => void) => () => void;
  appQuit: () => Promise<void>;
}
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// 45s between captures — free Gemini tier = 20 req/day.
// Even at 45s this exhausts quota in ~15min of active use.
// Set to 120000 (2min) for sustained sessions.
const CAPTURE_INTERVAL_MS = 45_000;
const MAX_SCREENSHOTS = 4;

/* ------------------------------------------------------------------ */
/*  Main Overlay Page                                                 */
/* ------------------------------------------------------------------ */
export default function OverlayPage() {
  const [isElectron, setIsElectron] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [slideText, setSlideText] = useState<string | null>(null);
  const [keyTerms, setKeyTerms] = useState<string[]>([]);
  const [confusionAlert, setConfusionAlert] = useState<{ concept: string; count: number } | null>(null);
  const [lastAnalogy, setLastAnalogy] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [panelTab, setPanelTab] = useState<"capture" | "analysis" | "ask">("capture");
  const [askInput, setAskInput] = useState("");
  const [askResponse, setAskResponse] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: 20 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const askInputRef = useRef<HTMLInputElement>(null);

  // ── Detect Electron ──
  useEffect(() => {
    const inElectron = typeof window !== "undefined" && !!window.electronAPI;
    setIsElectron(inElectron);
    // Position at right side of screen
    if (typeof window !== "undefined" && position.x === -1) {
      setPosition({ x: window.innerWidth - 440, y: 20 });
    }
  }, []);

  // ── WebSocket for confusion alerts ──
  useEffect(() => {
    const lectureId = 1;
    const wsUrl = `${API_URL.replace(/^http/, "ws")}/ws/lecture/${lectureId}?role=teacher`;
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => setWsConnected(false);
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "confusion_alert") {
              setConfusionAlert({ concept: msg.concept_node, count: msg.lost_count });
              triggerAnalogyForConcept(msg.concept_node);
            }
            if (msg.type === "latency_badge") {
              setLastLatency(msg.total_ms);
            }
          } catch { /* ignore non-JSON */ }
        };
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // ── Listen for Ctrl+Shift+1 capture-and-ask from main process ──
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onCaptureAndAsk) return;
    const cleanup = window.electronAPI.onCaptureAndAsk(() => {
      handleCaptureScreen();
      setPanelTab("ask");
      setTimeout(() => askInputRef.current?.focus(), 100);
    });
    return cleanup;
  }, [isElectron]);

  // ── Auto-capture interval ──
  useEffect(() => {
    if (autoCapture && isElectron) {
      intervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, CAPTURE_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoCapture, isElectron]);

  // ── Dragging ──
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  // ── Core: Capture Screen via Electron IPC ──
  const handleCaptureScreen = useCallback(async () => {
    if (!window.electronAPI?.screen) {
      setError("Electron screen API not available");
      return null;
    }
    setIsCapturing(true);
    setError(null);
    try {
      const result = await window.electronAPI.screen.capture();
      if (result.success) {
        const dataUrl = result.dataUrl;
        setScreenshots((prev) => [dataUrl, ...prev].slice(0, MAX_SCREENSHOTS));
        setCaptureCount((c) => c + 1);
        return dataUrl;
      } else {
        setError(`Capture failed: ${result.error}`);
        return null;
      }
    } catch (err) {
      setError(`Capture error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  // ── Capture + Analyze in one shot ──
  const captureAndAnalyze = useCallback(async () => {
    const dataUrl = await handleCaptureScreen();
    if (!dataUrl) return;
    await analyzeFrame(dataUrl);
  }, [handleCaptureScreen]);

  // 429 rate-limit guard — skip calls while Gemini is backed off
  const rateLimitedRef = useRef<number>(0); // epoch ms when backoff clears

  // ── Send frame to backend vision endpoint (analyze + index into VectorAI DB) ──
  const analyzeFrame = useCallback(async (dataUrl: string) => {
    // Skip if we're inside a 429 backoff window
    if (Date.now() < rateLimitedRef.current) {
      return;
    }
    try {
      const base64 = dataUrl.split(",")[1];
      if (!base64) return;
      const mime = dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      const start = performance.now();
      // analyze-and-index: Gemini Vision result is persisted to VectorAI DB
      const resp = await fetch(`${API_URL}/vision/analyze-and-index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mime_type: mime,
          lecture_id: 1,
          ts: Date.now() / 1000,
        }),
      });
      const elapsed = performance.now() - start;
      if (resp.status === 429) {
        // Back off for 60s on rate limit
        rateLimitedRef.current = Date.now() + 60_000;
        return;
      }
      if (!resp.ok) return;
      const ctx = await resp.json();
      if (ctx.topic_node && ctx.topic_node !== "unknown") {
        setCurrentTopic(ctx.topic_node);
        setSlideText(ctx.slide_text_summary || null);
        setKeyTerms(ctx.key_terms || []);
        setLastLatency(Math.round(elapsed));
      }
    } catch {
      // Non-fatal — retry next interval
    }
  }, []);

  // ── Trigger analogy for a concept ──
  const triggerAnalogyForConcept = useCallback(async (concept: string) => {
    try {
      const resp = await fetch(`${API_URL}/retrieval/accio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecture_id: 1,
          concept_node: concept,
          chunk_text: concept,
          avatar: "cricketer",
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setLastAnalogy(data.analogy_text || data.analogyText || null);
      }
    } catch { /* non-fatal */ }
  }, []);

  // ── Ask AI with screenshot ──
  const handleAsk = useCallback(async () => {
    if (!askInput.trim() && screenshots.length === 0) return;
    setIsAsking(true);
    setAskResponse(null);
    try {
      // Use analyze-and-index so the manual ask screenshot is also persisted
      const latestScreenshot = screenshots[0];
      if (latestScreenshot) {
        const base64 = latestScreenshot.split(",")[1];
        const resp = await fetch(`${API_URL}/vision/analyze-and-index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            mime_type: "image/png",
            lecture_id: 1,
            ts: Date.now() / 1000,
            question: askInput,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setAskResponse(
            `**Topic:** ${data.topic_node}\n\n` +
            `**Summary:** ${data.slide_text_summary}\n\n` +
            `**Key Terms:** ${(data.key_terms || []).join(", ")}` +
            (data.indexed ? `\n\n✅ Indexed as chunk \`${data.chunk_id}\`` : "")
          );
        }
      }
    } catch (err) {
      setAskResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAsking(false);
    }
  }, [askInput, screenshots]);

  // ── Window controls ──
  const handleTogglePin = useCallback(async () => {
    if (!window.electronAPI?.window) return;
    const newState = !alwaysOnTop;
    await window.electronAPI.window.setAlwaysOnTop(newState);
    setAlwaysOnTop(newState);
  }, [alwaysOnTop]);

  const handleMinimize = useCallback(() => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.minimize();
    }
  }, []);

  const handleClose = useCallback(() => {
    if (window.electronAPI?.window) {
      window.electronAPI.window.close();
    }
  }, []);

  /* ================================================================ */
  /*  R E N D E R                                                     */
  /* ================================================================ */
  return (
    <div style={S.root}>
      <div
        style={{
          ...S.panel,
          left: position.x,
          top: position.y,
          height: minimized ? "auto" : undefined,
        }}
      >
        {/* ── Title bar (draggable) ── */}
        <div
          style={S.titleBar}
          onMouseDown={(e) => {
            setDragging(true);
            dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
          }}
        >
          <div style={S.titleLeft}>
            <span style={S.titleIcon}>🔮</span>
            <span style={S.titleText}>Legilimens</span>
            <span style={{ ...S.statusDot, background: wsConnected ? "#10b981" : "#ef4444" }} />
          </div>
          <div style={S.titleControls}>
            <button style={S.ctrlBtn} onClick={handleTogglePin} title={alwaysOnTop ? "Unpin" : "Pin on top"}>
              {alwaysOnTop ? "📌" : "📍"}
            </button>
            <button style={S.ctrlBtn} onClick={() => setMinimized(!minimized)}>
              {minimized ? "▼" : "▲"}
            </button>
            <button style={S.ctrlBtn} onClick={handleMinimize}>─</button>
            <button style={{ ...S.ctrlBtn, ...S.closeBtn }} onClick={handleClose}>✕</button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* ── Tab navigation ── */}
            <div style={S.tabBar}>
              {(["capture", "analysis", "ask"] as const).map((tab) => (
                <button
                  key={tab}
                  style={{ ...S.tab, ...(panelTab === tab ? S.tabActive : {}) }}
                  onClick={() => setPanelTab(tab)}
                >
                  {tab === "capture" && "📷 Capture"}
                  {tab === "analysis" && "🧠 Analysis"}
                  {tab === "ask" && "💬 Ask AI"}
                </button>
              ))}
            </div>

            {/* ── Capture Tab ── */}
            {panelTab === "capture" && (
              <div style={S.tabContent}>
                {/* Auto-capture toggle */}
                <div style={S.row}>
                  <div style={S.toggleRow}>
                    <span style={S.label}>Auto-Capture</span>
                    <button
                      style={{ ...S.toggleBtn, ...(autoCapture ? S.toggleOn : {}) }}
                      onClick={() => setAutoCapture(!autoCapture)}
                    >
                      <span style={{ ...S.toggleThumb, ...(autoCapture ? S.toggleThumbOn : {}) }} />
                    </button>
                  </div>
                  <button
                    style={{ ...S.captureBtn, ...(isCapturing ? S.captureBtnActive : {}) }}
                    onClick={captureAndAnalyze}
                    disabled={isCapturing || !isElectron}
                  >
                    {isCapturing ? (
                      <><span style={S.spinner} /> Capturing...</>
                    ) : (
                      "📸 Capture Now"
                    )}
                  </button>
                </div>

                {/* Status info */}
                <div style={S.statsRow}>
                  <div style={S.stat}>
                    <span style={S.statValue}>{captureCount}</span>
                    <span style={S.statLabel}>Captures</span>
                  </div>
                  <div style={S.stat}>
                    <span style={S.statValue}>{lastLatency ? `${lastLatency}ms` : "—"}</span>
                    <span style={S.statLabel}>Latency</span>
                  </div>
                  <div style={S.stat}>
                    <span style={S.statValue}>{autoCapture ? "ON" : "OFF"}</span>
                    <span style={S.statLabel}>Auto</span>
                  </div>
                </div>

                {/* Screenshot preview strip */}
                {screenshots.length > 0 && (
                  <div style={S.screenshotStrip}>
                    {screenshots.map((s, i) => (
                      <div key={i} style={S.screenshotThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s} alt={`Screenshot ${i + 1}`} style={S.screenshotImg} />
                        {i === 0 && <span style={S.latestBadge}>Latest</span>}
                      </div>
                    ))}
                  </div>
                )}

                {!isElectron && (
                  <div style={S.warningBox}>
                    ⚠️ Screen capture requires the Electron overlay. Run the stealth-client to enable.
                  </div>
                )}

                {error && <div style={S.errorBox}>❌ {error}</div>}
              </div>
            )}

            {/* ── Analysis Tab ── */}
            {panelTab === "analysis" && (
              <div style={S.tabContent}>
                {currentTopic ? (
                  <>
                    <div style={S.topicCard}>
                      <div style={S.topicHeader}>
                        <span style={S.topicIcon}>🎯</span>
                        <span style={S.topicName}>{currentTopic.replace(/_/g, " ")}</span>
                      </div>
                      {slideText && <p style={S.slideText}>{slideText}</p>}
                      {keyTerms.length > 0 && (
                        <div style={S.termRow}>
                          {keyTerms.map((t, i) => (
                            <span key={i} style={S.termPill}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {confusionAlert && (
                      <div style={S.alertCard}>
                        <div style={S.alertHeader}>
                          <span>⚡ Confusion Detected</span>
                          <span style={S.alertCount}>{confusionAlert.count} students</span>
                        </div>
                        <p style={S.alertConcept}>{confusionAlert.concept.replace(/_/g, " ")}</p>
                      </div>
                    )}

                    {lastAnalogy && (
                      <div style={S.analogyCard}>
                        <div style={S.analogyLabel}>✨ Generated Analogy</div>
                        <p style={S.analogyText}>{lastAnalogy}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={S.emptyState}>
                    <span style={S.emptyIcon}>🔍</span>
                    <p style={S.emptyText}>No analysis yet. Capture a screen frame to start.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Ask AI Tab ── */}
            {panelTab === "ask" && (
              <div style={S.tabContent}>
                {screenshots.length > 0 && (
                  <div style={S.askPreview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screenshots[0]} alt="Latest capture" style={S.askPreviewImg} />
                    <span style={S.askPreviewLabel}>Attached screenshot</span>
                  </div>
                )}
                <form
                  style={S.askForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAsk();
                  }}
                >
                  <input
                    ref={askInputRef}
                    style={S.askInput}
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    placeholder="Ask about what's on screen..."
                    disabled={isAsking}
                  />
                  <button style={S.askSubmit} type="submit" disabled={isAsking}>
                    {isAsking ? "..." : "→"}
                  </button>
                </form>
                <div style={S.askHint}>
                  <kbd style={S.kbd}>Ctrl+Shift+1</kbd> Capture & ask from anywhere
                </div>
                {askResponse && (
                  <div style={S.askResponseBox}>
                    <pre style={S.askResponseText}>{askResponse}</pre>
                  </div>
                )}
              </div>
            )}

            {/* ── Bottom status bar ── */}
            <div style={S.bottomBar}>
              <span style={{ ...S.statusLed, background: wsConnected ? "#10b981" : "#ef4444" }} />
              <span style={S.bottomText}>
                {wsConnected ? "WS Live" : "Offline"}
              </span>
              {currentTopic && (
                <>
                  <span style={S.bottomSep}>|</span>
                  <span style={S.bottomTopic}>{currentTopic.replace(/_/g, " ")}</span>
                </>
              )}
              {autoCapture && (
                <>
                  <span style={S.bottomSep}>|</span>
                  <span style={S.bottomAuto}>⏺ Auto</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  S T Y L E S                                                       */
/* ================================================================== */
const S: Record<string, React.CSSProperties> = {
  root: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "transparent",
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    userSelect: "none",
  },
  panel: {
    position: "fixed",
    width: 400,
    maxHeight: "calc(100vh - 40px)",
    background: "rgba(8, 10, 20, 0.92)",
    backdropFilter: "blur(24px) saturate(1.8)",
    WebkitBackdropFilter: "blur(24px) saturate(1.8)",
    border: "1px solid rgba(212, 175, 55, 0.25)",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 60px rgba(212,175,55,0.08)",
    color: "#e8e0d0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: 99999,
  },
  /* Title bar */
  titleBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "linear-gradient(180deg, rgba(212,175,55,0.08) 0%, transparent 100%)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    cursor: "grab",
    minHeight: 42,
  },
  titleLeft: { display: "flex", alignItems: "center", gap: 8 },
  titleIcon: { fontSize: 16 },
  titleText: {
    fontFamily: '"Cinzel", Georgia, serif',
    fontWeight: 700,
    fontSize: 14,
    background: "linear-gradient(135deg, #D4AF37, #F0D57A)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  statusDot: {
    width: 7, height: 7, borderRadius: "50%",
    boxShadow: "0 0 6px currentColor",
  },
  titleControls: { display: "flex", gap: 4 },
  ctrlBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.5)",
    borderRadius: 6,
    width: 26, height: 26,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    fontSize: 11,
    transition: "all 0.15s",
  },
  closeBtn: {
    color: "rgba(239,68,68,0.7)",
  },
  /* Tab bar */
  tabBar: {
    display: "flex",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.15)",
  },
  tab: {
    flex: 1,
    padding: "9px 0",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "rgba(255,255,255,0.4)",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: '"Inter", sans-serif',
  },
  tabActive: {
    color: "#D4AF37",
    borderBottomColor: "#D4AF37",
    background: "rgba(212,175,55,0.06)",
  },
  /* Tab content */
  tabContent: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
    maxHeight: 480,
    flex: 1,
  },
  /* Capture tab */
  row: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  label: {
    fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)",
  },
  toggleBtn: {
    width: 40, height: 22,
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    cursor: "pointer",
    position: "relative",
    transition: "all 0.25s",
    padding: 0,
  },
  toggleOn: {
    background: "rgba(16,185,129,0.3)",
    borderColor: "rgba(16,185,129,0.5)",
  },
  toggleThumb: {
    position: "absolute",
    top: 2, left: 2,
    width: 16, height: 16,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.6)",
    transition: "all 0.25s",
  },
  toggleThumbOn: {
    left: 20,
    background: "#10b981",
    boxShadow: "0 0 6px rgba(16,185,129,0.5)",
  },
  captureBtn: {
    padding: "8px 16px",
    background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08))",
    border: "1px solid rgba(212,175,55,0.3)",
    color: "#D4AF37",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: '"Inter", sans-serif',
    whiteSpace: "nowrap",
  },
  captureBtnActive: {
    background: "rgba(212,175,55,0.2)",
    boxShadow: "0 0 12px rgba(212,175,55,0.2)",
  },
  spinner: {
    display: "inline-block",
    width: 12, height: 12,
    border: "2px solid rgba(212,175,55,0.3)",
    borderTopColor: "#D4AF37",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
  },
  statsRow: {
    display: "flex",
    gap: 8,
  },
  stat: {
    flex: 1,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: "8px 10px",
    textAlign: "center",
  },
  statValue: {
    display: "block",
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 700,
    fontSize: 14,
    color: "#D4AF37",
  },
  statLabel: {
    display: "block",
    fontSize: 9,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginTop: 2,
  },
  screenshotStrip: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    padding: "4px 0",
  },
  screenshotThumb: {
    position: "relative",
    width: 80, height: 50,
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
    flexShrink: 0,
  },
  screenshotImg: {
    width: "100%", height: "100%",
    objectFit: "cover",
  },
  latestBadge: {
    position: "absolute",
    top: 2, left: 2,
    background: "rgba(16,185,129,0.8)",
    color: "#fff",
    fontSize: 7,
    fontWeight: 700,
    padding: "1px 4px",
    borderRadius: 3,
    textTransform: "uppercase",
  },
  warningBox: {
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.25)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 11,
    color: "rgba(251,191,36,0.9)",
    lineHeight: 1.4,
  },
  errorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 11,
    color: "rgba(239,68,68,0.9)",
  },
  /* Analysis tab */
  topicCard: {
    background: "linear-gradient(135deg, rgba(212,175,55,0.08), rgba(139,92,246,0.06))",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: 10,
    padding: 14,
  },
  topicHeader: {
    display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
  },
  topicIcon: { fontSize: 18 },
  topicName: {
    fontFamily: '"Cinzel", serif',
    fontWeight: 700,
    fontSize: 15,
    color: "#D4AF37",
    textTransform: "capitalize",
  },
  slideText: {
    fontSize: 12, color: "rgba(255,255,255,0.65)",
    lineHeight: 1.5, margin: 0,
  },
  termRow: {
    display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10,
  },
  termPill: {
    background: "rgba(139,92,246,0.15)",
    border: "1px solid rgba(139,92,246,0.3)",
    color: "#c4b5fd",
    borderRadius: 12,
    padding: "3px 10px",
    fontSize: 10,
    fontWeight: 600,
  },
  alertCard: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 10,
    padding: 12,
  },
  alertHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontSize: 12, fontWeight: 700, color: "#f87171",
  },
  alertCount: {
    background: "rgba(239,68,68,0.2)",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
  },
  alertConcept: {
    margin: "6px 0 0", fontSize: 13, fontWeight: 600,
    color: "rgba(255,255,255,0.8)", textTransform: "capitalize",
  },
  analogyCard: {
    background: "rgba(139,92,246,0.06)",
    borderLeft: "3px solid #8b5cf6",
    borderRadius: "0 10px 10px 0",
    padding: 12,
  },
  analogyLabel: {
    fontSize: 10, fontWeight: 700, color: "#a78bfa",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
  },
  analogyText: {
    margin: 0, fontSize: 12.5, fontStyle: "italic",
    color: "rgba(255,255,255,0.75)", lineHeight: 1.5,
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
  },
  emptyIcon: { fontSize: 36, display: "block", marginBottom: 12 },
  emptyText: {
    fontSize: 12.5, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5,
  },
  /* Ask tab */
  askPreview: {
    background: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  askPreviewImg: {
    width: "100%", maxHeight: 120, objectFit: "cover",
    display: "block", opacity: 0.8,
  },
  askPreviewLabel: {
    position: "absolute",
    bottom: 6, left: 8,
    background: "rgba(0,0,0,0.6)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 9, fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
  },
  askForm: {
    display: "flex", gap: 8,
  },
  askInput: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#e8e0d0",
    fontSize: 12.5,
    outline: "none",
    fontFamily: '"Inter", sans-serif',
    transition: "border-color 0.2s",
  },
  askSubmit: {
    width: 40, height: 40,
    borderRadius: 8,
    background: "linear-gradient(135deg, #D4AF37, #B8941F)",
    border: "none",
    color: "#1a0f2e",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s",
  },
  askHint: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 10.5, color: "rgba(255,255,255,0.3)",
  },
  kbd: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 10,
    fontFamily: '"JetBrains Mono", monospace',
    color: "rgba(255,255,255,0.5)",
  },
  askResponseBox: {
    background: "rgba(139,92,246,0.06)",
    border: "1px solid rgba(139,92,246,0.2)",
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    overflowY: "auto",
  },
  askResponseText: {
    margin: 0, fontSize: 12, color: "rgba(255,255,255,0.75)",
    lineHeight: 1.6, whiteSpace: "pre-wrap",
    fontFamily: '"Inter", sans-serif',
  },
  /* Bottom bar */
  bottomBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.15)",
    fontSize: 10.5,
  },
  statusLed: {
    width: 6, height: 6, borderRadius: "50%",
    flexShrink: 0,
  },
  bottomText: {
    color: "#D4AF37",
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.05em",
  },
  bottomSep: {
    color: "rgba(255,255,255,0.15)",
  },
  bottomTopic: {
    color: "#c4b5fd",
    fontSize: 10,
    maxWidth: 120,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textTransform: "capitalize",
  },
  bottomAuto: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: 600,
  },
};
