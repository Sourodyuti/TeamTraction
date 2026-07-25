/**
 * FastAPI REST client for the dashboard (Phase 4/7).
 *
 * Wraps fetch calls to the backend. Keeps all endpoint URLs in one place.
 */
import type { TopConfusingMoment, AnalogyResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = {
  async health(): Promise<{ status: string }> {
    const resp = await fetch(`${API_URL}/health`);
    return resp.json();
  },

  async getTopMoments(lectureId: number, limit = 3): Promise<TopConfusingMoment[]> {
    // TODO Phase 7: real /analytics/top-moments endpoint
    const resp = await fetch(
      `${API_URL}/analytics/top-moments?lecture_id=${lectureId}&limit=${limit}`
    );
    if (!resp.ok) throw new Error(`analytics failed: ${resp.status}`);
    return resp.json();
  },

  async getConfusionDensity(lectureId: number): Promise<{ ts: string; density: number }[]> {
    // TODO Phase 7: real /analytics/density endpoint
    const resp = await fetch(`${API_URL}/analytics/density?lecture_id=${lectureId}`);
    if (!resp.ok) throw new Error(`density failed: ${resp.status}`);
    return resp.json();
  },

  async triggerAccio(
    conceptNode: string,
    chunkText: string
  ): Promise<AnalogyResponse> {
    // TODO Phase 4: real /retrieval/accio endpoint
    const resp = await fetch(
      `${API_URL}/retrieval/accio?concept_node=${encodeURIComponent(
        conceptNode
      )}&chunk_text=${encodeURIComponent(chunkText)}`,
      { method: "POST" }
    );
    if (!resp.ok) throw new Error(`retrieval failed: ${resp.status}`);
    return resp.json();
  },
};
