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

export interface DensityPoint {
  ts: string;
  density: number;
}

export interface CohortCell {
  concept_node: string;
  hour: number;
  avg_density: number;
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
