"use client";

/**
 * useDashboardPolling — aggregates the five health/metrics endpoints into a
 * single `AggregatedHealth` object, polled every `intervalMs` (default 5s).
 *
 * Powers the System tab and the header service pills. Individual endpoint
 * failures degrade gracefully (a null field) rather than failing the whole
 * poll — matching the backend's own graceful-fallback philosophy.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  AggregatedHealth,
  HealthResponse,
  MetricsResponse,
  RetrievalHealthResponse,
  VisionHealthResponse,
  TranscriptionStatusResponse,
  ServiceCard,
} from "@/lib/types";

const SPELL_COLORS = {
  muffliato: "#66FCF1",
  marauders: "#D4AF37",
  accio: "#FF6B35",
  gemino: "#BB86FC",
  sonorus: "#FFD700",
  pensieve: "#8A2BE2",
};

const EMPTY: AggregatedHealth = {
  health: null,
  metrics: null,
  retrieval: null,
  vision: null,
  transcription: null,
  services: [],
  loading: true,
  lastUpdated: null,
};

export function useDashboardPolling(intervalMs: number = 5000) {
  const [agg, setAgg] = useState<AggregatedHealth>(EMPTY);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    // Fan out all five requests; each resolves independently.
    const results = await Promise.allSettled([
      api.health(),
      api.metrics(),
      api.retrievalHealth(),
      api.visionHealth(),
      api.transcriptionStatus(),
    ]);

    const h = results[0].status === "fulfilled" ? results[0].value : null;
    const m = results[1].status === "fulfilled" ? results[1].value : null;
    const r = results[2].status === "fulfilled" ? results[2].value : null;
    const v = results[3].status === "fulfilled" ? results[3].value : null;
    const t = results[4].status === "fulfilled" ? results[4].value : null;

    const services = buildServiceCards(h, m, r, v, t);

    setAgg({
      health: h,
      metrics: m,
      retrieval: r,
      vision: v,
      transcription: t,
      services,
      loading: false,
      lastUpdated: Date.now(),
    });
  }, []);

  useEffect(() => {
    poll();
    timer.current = setInterval(poll, intervalMs);
    return () => clearInterval(timer.current);
  }, [poll, intervalMs]);

  const refresh = useCallback(() => poll(), [poll]);

  return { health: agg, refresh };
}

function buildServiceCards(
  health: HealthResponse | null,
  metrics: MetricsResponse | null,
  retrieval: RetrievalHealthResponse | null,
  vision: VisionHealthResponse | null,
  transcription: TranscriptionStatusResponse | null,
): ServiceCard[] {
  const cards: ServiceCard[] = [];

  // Core services (from /health + /metrics)
  cards.push({
    key: "embedder",
    name: "Embedder (bge-small)",
    healthy: !!(metrics?.embedder_loaded ?? health?.services.embedder),
    detail: "384-dim · on-prem CPU",
    spellColor: SPELL_COLORS.accio,
  });
  cards.push({
    key: "vectorai",
    name: "Actian VectorAI DB",
    healthy: !!(metrics?.vectorai_connected ?? health?.services.vectorai_db),
    detail: "lecture_chunks · 384-dim · cosine",
    spellColor: SPELL_COLORS.accio,
  });
  cards.push({
    key: "actian_vector",
    name: "Actian Vector (analytics)",
    healthy: !!(metrics?.analytics_connected ?? health?.services.actian_vector),
    detail: "Pensieve columnar SQL",
    spellColor: SPELL_COLORS.pensieve,
  });

  // Retrieval pipeline deps
  cards.push({
    key: "gemini",
    name: "Gemini (Gemino)",
    healthy: !!retrieval?.gemini_configured,
    detail: "gemini-2.0-flash-lite",
    spellColor: SPELL_COLORS.gemino,
  });
  cards.push({
    key: "elevenlabs",
    name: "ElevenLabs (Sonorus)",
    healthy: !!retrieval?.elevenlabs_configured,
    detail: "eleven_flash_v2_5",
    spellColor: SPELL_COLORS.sonorus,
  });

  // Vision + Whisper
  cards.push({
    key: "vision",
    name: "Gemini Vision",
    healthy: !!vision?.available,
    detail: vision?.model ?? "gemini-2.5-flash",
    spellColor: SPELL_COLORS.gemino,
  });
  cards.push({
    key: "whisper",
    name: "Whisper (ASR)",
    healthy: !!transcription?.available,
    detail: transcription?.model ?? "base.en",
    spellColor: SPELL_COLORS.muffliato,
  });

  // WebSocket hub (from /metrics active connections)
  const wsActive = (metrics?.active_websocket_connections ?? 0) > 0;
  cards.push({
    key: "ws",
    name: "WebSocket Hub",
    healthy: metrics != null, // hub is up if /metrics responded at all
    detail: metrics
      ? `${metrics.active_websocket_connections ?? 0} conns · ${metrics.active_lectures ?? 0} lectures`
      : "unreachable",
    spellColor: SPELL_COLORS.marauders,
  });

  return cards;
}
