"""Accio Analogy — retrieval endpoint (Phase 4 + 5).

Triggers when the confusion threshold is met (≥2 students lost in 20s on
the same concept_node). Full pipeline:

  1. Embed `chunk_text` with bge-small → 384-dim vector
  2. Query VectorAI DB `lecture_chunks` collection → top-3 hits
  3. Rewrite the best hit as an avatar-tailored analogy with Gemini
  4. Synthesise the analogy to MP3 with ElevenLabs (optional)
  5. Return AnalogyResponse with per-stage latency badges

Graceful degradation:
  - If VectorAI DB is down  → return the raw chunk_text as fallback
  - If Gemini is unavailable → return the best retrieved explanation
  - If ElevenLabs is down   → return empty audio_url
  - If nothing at all works  → serve from offline cache
"""
from __future__ import annotations

import base64
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from models.schemas import (
    AnalogyRequest,
    AnalogyResponse,
    InterestAvatar,
    RetrievalResult,
)
from services.embedder import Embedder
from services.elevenlabs_client import ElevenLabsClient
from services.gemini_client import GeminiClient
from services.offline_cache import get_cached_analogy
from services.vectorai_client import VectorAIClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


# ─── FastAPI dependencies ─────────────────────────────────────────

def _get_embedder() -> Embedder:
    """Lazy singleton — created once, reused."""
    return Embedder()


def _get_vectorai() -> VectorAIClient:
    """Lazy singleton — auto-connects on first call."""
    client = VectorAIClient()
    if client._client is None:
        client.connect()
    return client


def _get_gemini() -> GeminiClient:
    from config import settings
    return GeminiClient(api_key=settings.gemini_api_key)


def _get_elevenlabs() -> ElevenLabsClient:
    from config import settings
    return ElevenLabsClient(api_key=settings.elevenlabs_api_key)


# ─── Main endpoint ────────────────────────────────────────────────

@router.post("/accio", response_model=AnalogyResponse)
async def accio_analogy(
    concept_node: str,
    chunk_text: str,
    avatar: InterestAvatar = Query(default=InterestAvatar.CRICKETER),
    embedder: Annotated[Embedder, Depends(_get_embedder)] = None,
    vectorai: Annotated[VectorAIClient, Depends(_get_vectorai)] = None,
    gemini: Annotated[GeminiClient, Depends(_get_gemini)] = None,
    elevenlabs: Annotated[ElevenLabsClient, Depends(_get_elevenlabs)] = None,
) -> AnalogyResponse:
    """Full Accio Analogy pipeline: embed → retrieve → rewrite → synthesise."""
    latency: dict[str, float] = {"embedding": 0.0, "retrieval": 0.0, "gemini": 0.0, "tts": 0.0}

    # ── 1. Embed ────────────────────────────────────────────────────
    try:
        query_vector, emb_ms = embedder.encode_with_latency(chunk_text)
        latency["embedding"] = emb_ms
        logger.debug("Embedded chunk (%.1f ms)", emb_ms)
    except Exception:
        logger.exception("Embedding failed — serving from offline cache")
        return _offline_fallback(concept_node, chunk_text, avatar)

    # ── 2. Retrieve ─────────────────────────────────────────────────
    retrieved_text = chunk_text  # Fallback: use the confusing chunk itself
    try:
        hits = vectorai.search_similar(query_vector, limit=3)
        latency["retrieval"] = hits[0].get("latency_ms", 0.0) if hits else 0.0

        if hits:
            best = hits[0]
            retrieved_text = best["payload"].get("text", chunk_text)
            logger.debug(
                "Retrieved best hit: topic=%s score=%.3f",
                best["payload"].get("topic_node", "?"),
                best["score"],
            )
    except Exception:
        logger.exception("VectorAI retrieval failed — falling back to raw chunk")

    # ── 3. Gemini rewrite ───────────────────────────────────────────
    analogy_text, gem_ms = retrieved_text, 0.0
    try:
        analogy_text, gem_ms = gemini.rewrite_analogy(concept_node, retrieved_text, avatar)
        latency["gemini"] = gem_ms
        logger.debug("Gemini rewrite done (%.1f ms)", gem_ms)
    except Exception:
        logger.exception("Gemini rewrite failed — using retrieved text as analogy")
        analogy_text = retrieved_text

    # ── 4. TTS (optional) ──────────────────────────────────────────
    latency["tts"] = 0.0
    try:
        audio_bytes, tts_ms = elevenlabs.text_to_speech(analogy_text)
        latency["tts"] = tts_ms
    except Exception:
        logger.exception("ElevenLabs TTS failed — returning empty audio")
        audio_bytes = b""

    return AnalogyResponse(
        concept_node=concept_node,
        original_text=retrieved_text,
        analogy_text=analogy_text,
        avatar=avatar,
        latency_ms=latency,
    )


@router.post("/accio-batch", response_model=list[RetrievalResult])
async def accio_batch(
    concept_node: str,
    chunk_text: str,
    limit: int = Query(default=3, ge=1, le=10),
    embedder: Annotated[Embedder, Depends(_get_embedder)] = None,
    vectorai: Annotated[VectorAIClient, Depends(_get_vectorai)] = None,
) -> list[RetrievalResult]:
    """Return top-N retrieval hits without Gemini rewrite (for teacher dashboard)."""
    try:
        vector, _ = embedder.encode_with_latency(chunk_text)
        hits = vectorai.search_similar(vector, limit=limit)
    except Exception:
        logger.exception("Batch retrieval failed")
        raise HTTPException(status_code=503, detail="Retrieval service unavailable")

    results = [
        RetrievalResult(
            text=h["payload"].get("text", ""),
            topic_node=h["payload"].get("topic_node", "general"),
            source=h["payload"].get("source", "lecture"),
            score=h["score"],
        )
        for h in hits
    ]
    return results


# ─── Helpers ──────────────────────────────────────────────────────

def _offline_fallback(
    concept_node: str,
    chunk_text: str,
    avatar: InterestAvatar,
) -> AnalogyResponse:
    """Return a cached analogy or a bare-minimum stub so the demo never crashes."""
    cached = get_cached_analogy(concept_node, str(avatar))
    if cached:
        return AnalogyResponse(
            concept_node=concept_node,
            original_text=cached.get("original_text", chunk_text),
            analogy_text=cached.get("analogy_text", chunk_text),
            avatar=avatar,
            latency_ms={"embedding": 0, "retrieval": 0, "gemini": 0, "tts": 0, "source": "cache"},
        )
    return AnalogyResponse(
        concept_node=concept_node,
        original_text=chunk_text,
        analogy_text=chunk_text,
        avatar=avatar,
        latency_ms={"embedding": 0, "retrieval": 0, "gemini": 0, "tts": 0, "source": "fallback"},
    )
