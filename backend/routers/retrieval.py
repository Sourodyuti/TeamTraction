"""Accio Analogy — retrieval endpoint (Phase 4).

Triggers when the confusion threshold is met (≥2 students lost in 20s on
the same concept_node). Embeds the confusing chunk, queries Actian VectorAI DB
for the best past explanation, returns top-3 with latency badges.

Phase 5 adds the Gemini rewrite on top of this.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from models.schemas import (
    AnalogyResponse,
    InterestAvatar,
    RetrievalResult,
)

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


@router.post("/accio", response_model=AnalogyResponse)
async def accio_analogy(concept_node: str, chunk_text: str) -> AnalogyResponse:
    """Embed the confusing chunk → VectorAI DB similarity search → top-3 hits.

    TODO Phase 4: Implement the full flow:
      1. Embed `chunk_text` with bge-small → 384-dim vector.
      2. Query VectorAI DB `lecture_chunks` collection with the vector.
      3. Return top-3 RetrievalResults.
      4. Measure and include latency in response.

    TODO Phase 5: After retrieval, call Gemini to rewrite the best hit
      as an analogy for the student's InterestAvatar.

    For now, returns a stub response.
    """
    # Phase 4 stub — replace with real embed + search
    stub = AnalogyResponse(
        concept_node=concept_node or "unknown",
        original_text="TODO: retrieved from VectorAI DB",
        analogy_text="TODO: rewritten by Gemini (Phase 5)",
        avatar=InterestAvatar.CRICKETER,
        latency_ms={"embedding": 0, "retrieval": 0, "gemini": 0},
    )
    return stub
