/**
 * Shared TypeScript types — mirror the backend Pydantic models.
 * Keep these in sync with backend/models/schemas.py.
 */

export enum SignalType {
  LOST = "lost",
  GOTIT = "gotit",
  SLOWER = "slower",
}

export enum InterestAvatar {
  CRICKETER = "cricketer",
  GAMER = "gamer",
  COOK = "cook",
}

// ─── Phase 2: Capture ─────────────────────────────────────────

export interface StudentPing {
  student_id: string;
  ts: string; // ISO datetime
  signal_type: SignalType;
  lecture_id: number;
  avatar?: string; // Interest profile (cricketer | gamer | cook)
}

// ─── Phase 3: Radar ──────────────────────────────────────────

export interface ConceptNode {
  id: string;
  label: string;
  confusion: number;
  confusionDensity: number;
  lastSignal: string;
  lostCount: number;
  gotItCount: number;
}

export interface TimelinePoint {
  ts: number;
  density: number;
}

export interface ConfusionAlert {
  type: 'confusion_alert';
  lecture_id: number;
  concept_node: string;
  count: number;
  recommendation: string;
  ts: string;
}

export interface AnalogyReady {
  type: 'analogy_ready';
  lecture_id: number;
  concept_node: string;
  original_text: string;
  analogy_text: string;
  avatar: string;
  latency_ms: Record<string, number>;
  audio_url?: string;
}

export interface TranscriptUpdate {
  type: 'transcript_update';
  lecture_id: number;
  chunk_id: string;
  topic_node: string;
  text: string;
  ts: string;
}

export interface RecordingChunk {
  chunk_id: string;
  lecture_id: number;
  start_ts: number;
  end_ts: number;
  transcript: string;
  topic_node?: string;
  duration: number;
}

// ─── Phase 4-6: Latency badge ────────────────────────────────────

/**
 * LatencyBadge mirrors the 'latency_badge' WS message from websocket.py.
 * Flat numeric fields — no nested objects so the badge component can
 * render without any intermediate parsing.
 */
export interface LatencyBadge {
  type: 'latency_badge';
  lecture_id: number;
  concept_node: string;
  embedding_ms: number;
  retrieval_ms: number;
  gemini_ms: number;
  elevenlabs_ms: number;
  total_ms: number;
  ts: string;
}

// ─── Server → Client messages ────────────────────────────────────

export type ServerMessage =
  | { type: "radar_update"; lecture_id: number; student_id: string; signal_type: string; concept_node: string; ts?: string }
  | { type: "analogy_audio"; student_id: string; audio_url: string }
  | { type: "chunk_update"; lecture_id: number; chunk_id: string; topic_node: string }
  | ConfusionAlert
  | AnalogyReady
  | TranscriptUpdate
  | LatencyBadge;

// ─── Phase 7: Analytics ─────────────────────────────────────────

export interface TopConfusingMoment {
  concept_node: string;
  lost_count: number;
  total_signals: number;
  avg_density: number;
}

/**
 * Raw confusion event from GET /analytics/density.
 *
 * NOTE: the backend returns {data: DensityEvent[]} where each event is a
 * raw {ts, type} row — NOT a pre-computed density. Density is derived
 * client-side in lib/analytics-transforms.ts (eventsToDensityTimeline).
 */
export interface DensityEvent {
  ts: string;   // ISO timestamp
  type: SignalType;
}

/** Wrapper returned by the /analytics/density endpoint. */
export interface DensityResponse {
  data: DensityEvent[];
}

/**
 * Cohort heatmap returned by GET /analytics/cohort-heatmap.
 *
 * NOTE: the backend returns a map {concept_node: {lost, gotit}} — NOT an
 * array of cells. There is no "hour" axis. Normalized into render rows
 * by lib/analytics-transforms.ts (cohortMapToGrid).
 */
export type CohortMap = Record<string, { lost: number; gotit: number }>;

/** A single concept row in the cohort heatmap grid. */
export interface CohortRow {
  concept_node: string;
  label: string;
  lost: number;
  gotit: number;
  total: number;
  lostDensity: number; // lost / total, 0..1
}

export interface AnalogyResponse {
  concept_node: string;
  original_text: string;
  analogy_text: string;
  avatar: InterestAvatar;
  audio_url?: string;
  latency_ms: {
    embedding: number;
    retrieval: number;
    gemini: number;
    elevenlabs?: number;
  };
}

// ─── Phase 8: Command-Center dashboard ──────────────────────────────

/** GET /metrics — operational metrics. */
export interface MetricsResponse {
  uptime_seconds: number;
  embedder_loaded: boolean;
  vectorai_connected: boolean;
  analytics_connected: boolean;
  active_websocket_connections?: number;
  active_lectures?: number;
}

/** GET /health. */
export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  services: {
    embedder: boolean;
    vectorai_db: boolean;
    actian_vector: boolean;
  };
}

/** GET /retrieval/health. */
export interface RetrievalHealthResponse {
  embedder: boolean;
  vectorai_db: boolean;
  gemini_configured: boolean;
  elevenlabs_configured: boolean;
  nvidia_configured: boolean;
  ready: boolean;
}

/** POST /tts/speak response. */
export interface TTSSpeakResponse {
  text: string;
  audio_base64: string | null;
  mime: string;
  use_browser_tts: boolean;
  source: string;
}

/** GET /videos/recommend/:concept response. */
export interface VideoResult {
  title: string;
  url: string;
  thumbnail: string;
  channel: string;
  description: string;
  source: string;
}

export interface VideoResponse {
  concept: string;
  videos: VideoResult[];
  source: string;
}

/** GET /vision/health. */
export interface VisionHealthResponse {
  available: boolean;
  model: string;
}

/** GET /transcription/status. */
export interface TranscriptionStatusResponse {
  available: boolean;
  model: string;
}

/**
 * Aggregated system health — merged from the five health/metrics endpoints
 * by useDashboardPolling. One object the dashboard consumes.
 */
export interface ServiceCard {
  key: string;
  name: string;
  healthy: boolean;
  detail?: string;       // model name, "configured", etc.
  spellColor: string;    // themed accent from design-tokens spells palette
}

export interface AggregatedHealth {
  health: HealthResponse | null;
  metrics: MetricsResponse | null;
  retrieval: RetrievalHealthResponse | null;
  vision: VisionHealthResponse | null;
  transcription: TranscriptionStatusResponse | null;
  services: ServiceCard[];
  loading: boolean;
  lastUpdated: number | null; // epoch ms
}

/** Result of POST /analytics/seed. */
export interface SeedResult {
  status: string;
  count: number;
}

/** Result of GET /retrieval/accio/demo (cached offline analogy). */
export interface AccioDemoResponse {
  concept_node: string;
  original_text: string;
  analogy_text: string;
  avatar: string;
  latency_ms: {
    embedding: number;
    retrieval: number;
    gemini: number;
    elevenlabs: number;
  };
  audio_url?: string;
}

// ─── Recording Session ───────────────────────────────────────────

export interface RecordingSession {
  lecture_id: number;
  started_at: string;
  is_active: boolean;
  duration_seconds: number;
  chunk_count: number;
}

export interface RecordingStatus {
  lecture_id: number;
  is_active: boolean;
  started_at: string | null;
  duration_seconds: number;
  chunk_count: number;
}

export interface KBChunk {
  chunk_id: string;
  topic_node: string;
  ts: number;
  text_preview: string;
}
