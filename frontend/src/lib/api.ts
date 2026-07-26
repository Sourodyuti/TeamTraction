/**
 * FastAPI REST client — all endpoint URLs in one place.
 * Automatically attaches JWT from localStorage on every authenticated request.
 */
import type {
  TopConfusingMoment,
  AnalogyResponse,
  RecordingChunk,
  HealthResponse,
  MetricsResponse,
  RetrievalHealthResponse,
  VisionHealthResponse,
  TranscriptionStatusResponse,
  DensityResponse,
  CohortMap,
  SeedResult,
  TTSSpeakResponse,
  VideoResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("legilimens_token")
      : null;
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!resp.ok) {
    let detail = `${resp.status} ${resp.statusText}`;
    try {
      const body = await resp.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return resp.json();
}

export const api = {
  // ─── Vision ─────────────────────────────────────────────────────
  analyzeFrame(
    image: string,
    mime_type: string = "image/jpeg"
  ): Promise<{
    topic_node: string;
    slide_text_summary: string;
    difficulty: number;
    key_terms: string[];
    latency_ms: number;
  }> {
    return apiFetch("/vision/analyze-frame", {
      method: "POST",
      body: JSON.stringify({ image, mime_type }),
    });
  },

  // ─── Health ─────────────────────────────────────────────────────
  health(): Promise<HealthResponse> {
    return apiFetch("/health");
  },

  metrics(): Promise<MetricsResponse> {
    return apiFetch("/metrics");
  },

  // ─── Analytics ──────────────────────────────────────────────────
  getTopMoments(lectureId: number, limit = 3): Promise<TopConfusingMoment[]> {
    return apiFetch(`/analytics/top-moments?lecture_id=${lectureId}&limit=${limit}`);
  },

  /**
   * Raw confusion events from /analytics/density.
   * Returns {data: [{ts, type}]} — density is derived client-side
   * (see lib/analytics-transforms.ts eventsToDensityTimeline).
   */
  getDensity(lectureId: number): Promise<DensityResponse> {
    return apiFetch(`/analytics/density?lecture_id=${lectureId}`);
  },

  /**
   * Cohort heatmap as a map {concept_node: {lost, gotit}}.
   * Normalized into render rows by cohortMapToGrid.
   */
  getCohortHeatmap(lectureId: number): Promise<CohortMap> {
    return apiFetch(`/analytics/cohort-heatmap?lecture_id=${lectureId}`);
  },

  getSummary(lectureId: number): Promise<{ total: number; lost: number; gotit: number }> {
    return apiFetch(`/analytics/summary?lecture_id=${lectureId}`);
  },

  /** Seed 6 demo confusion events (chain_rule + gradient_descent). */
  seedDemo(lectureId: number = 1): Promise<SeedResult> {
    return apiFetch(`/analytics/seed?lecture_id=${lectureId}`, { method: "POST" });
  },

  // ─── Retrieval ──────────────────────────────────────────────────
  retrievalHealth(): Promise<RetrievalHealthResponse> {
    return apiFetch("/retrieval/health");
  },

  triggerAnalogy(
    lectureId: number,
    conceptNode: string,
    chunkText?: string,
    avatar: string = "cricketer"
  ): Promise<AnalogyResponse> {
    return apiFetch("/retrieval/accio", {
      method: "POST",
      body: JSON.stringify({
        lecture_id: lectureId,
        concept_node: conceptNode,
        chunk_text: chunkText ?? conceptNode,
        avatar,
      }),
    });
  },

  /** Demo endpoint with sensible defaults — no request body needed. */
  accioDemo(conceptNode: string = "chain_rule", avatar: string = "cricketer"): Promise<AnalogyResponse> {
    return apiFetch(
      `/retrieval/accio/demo?concept_node=${encodeURIComponent(conceptNode)}&avatar=${encodeURIComponent(avatar)}`
    );
  },

  /** URL for a pre-cached offline analogy MP3 (cable-pull demo). */
  accioCachedUrl(conceptNode: string, avatar: string = "cricketer"): string {
    return `${API_URL}/retrieval/accio-cached?concept_node=${encodeURIComponent(conceptNode)}&avatar=${encodeURIComponent(avatar)}`;
  },

  /** Legacy alias kept for backwards compat with pensieve page */
  triggerAccio(conceptNode: string, chunkText: string): Promise<AnalogyResponse> {
    return this.triggerAnalogy(1, conceptNode, chunkText);
  },

  // ─── Recording ──────────────────────────────────────────────────
  getManifest(lectureId: number): Promise<RecordingChunk[]> {
    return apiFetch(`/recording/${lectureId}/manifest`);
  },

  /** Returns a fully-qualified URL for audio playback (no fetch needed). */
  getChunkAudioUrl(lectureId: number, chunkId: string): string {
    const token = typeof window !== "undefined" ? localStorage.getItem("legilimens_token") : null;
    return `${API_URL}/recording/${lectureId}/chunk/${chunkId}${token ? `?token=${token}` : ""}`;
  },

  // ─── Per-router health ──────────────────────────────────────────
  visionHealth(): Promise<VisionHealthResponse> {
    return apiFetch("/vision/health");
  },

  transcriptionStatus(): Promise<TranscriptionStatusResponse> {
    return apiFetch("/transcription/status");
  },

  // ─── ASR ────────────────────────────────────────────────────────
  ingestChunk(payload: {
    text: string;
    topic_node?: string;
    lecture_id?: number;
    ts?: number;
    difficulty?: number;
    source?: string;
  }): Promise<{ chunk_id: string; status: string; topic_node: string; embedded: boolean }> {
    return apiFetch("/asr/ingest-chunk", {
      method: "POST",
      body: JSON.stringify({
        text: payload.text,
        topic_node: payload.topic_node ?? "general",
        lecture_id: payload.lecture_id ?? 1,
        ts: payload.ts ?? 0,
        difficulty: payload.difficulty ?? 3,
        source: payload.source ?? "lecture",
      }),
    });
  },

  // ─── TTS ────────────────────────────────────────────────────────
  ttsSpeak(text: string, voiceId?: string): Promise<TTSSpeakResponse> {
    return apiFetch("/tts/speak", {
      method: "POST",
      body: JSON.stringify({ text, voice_id: voiceId }),
    });
  },

  ttsHealth(): Promise<{ elevenlabs: boolean; browser_fallback: boolean; ready: boolean }> {
    return apiFetch("/tts/health");
  },

  // ─── Video Recommendations ─────────────────────────────────────
  videoRecommendations(concept: string, maxResults: number = 3): Promise<VideoResponse> {
    return apiFetch(`/videos/recommend/${encodeURIComponent(concept)}?max_results=${maxResults}`);
  },
};
