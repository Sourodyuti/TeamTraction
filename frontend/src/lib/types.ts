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

// ─── Phase 2: Capture ────────────────────────────────────────────

export interface StudentPing {
  student_id: string;
  ts: string; // ISO datetime
  signal_type: SignalType;
  lecture_id: number;
}

// ─── Phase 3: Radar ──────────────────────────────────────────────

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

// ─── Server → Client messages ────────────────────────────────────

export type ServerMessage =
  | { type: "radar_update"; lecture_id: number; student_id: string; signal_type: string; concept_node: string }
  | { type: "analogy_audio"; student_id: string; audio_url: string }
  | {
      type: "latency_update";
      retrieval_ms: number;
      embedding_ms?: number;
      gemini_ms?: number;
      total_ms?: number;
      concept_node?: string;
      delivered?: boolean;
    };

// ─── Phase 4-5: Retrieval + Generation ───────────────────────────

export interface AnalogyResponse {
  concept_node: string;
  original_text: string;
  analogy_text: string;
  avatar: InterestAvatar;
  latency_ms: {
    embedding: number;
    retrieval: number;
    gemini: number;
  };
}

// ─── Phase 7: Analytics ──────────────────────────────────────────

export interface TopConfusingMoment {
  concept_node: string;
  lost_count: number;
  total_signals: number;
  avg_density: number;
}
