"""Accio Analogy — retrieval + generation endpoint (Phases 4 + 5).

Triggered when confusion threshold is met (≥2 students lost in 20s on the
same concept_node). Full pipeline:

  embed(chunk_text) → VectorAI DB search → Gemini rewrite → ElevenLabs TTS

Endpoints:
  POST /retrieval/accio         — live pipeline (Gemini + ElevenLabs)
  POST /retrieval/accio-cached  — serve pre-cached MP3 (offline/demo mode)
"""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from models.schemas import (
    AnalogyRequest,
    AnalogyResponse,
    InterestAvatar,
    RetrievalResult,
)
from services.embedder import Embedder
from services.gemini_client import GeminiClient
from services.elevenlabs_client import ElevenLabsClient
from services.vectorai_client import VectorAIClient
from services.offline_cache import get_cached_analogy
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


# ─── Dependency helpers ─────────────────────────────────────────────────

def _get_embedder() -> Embedder:
    from main import get_embedder  # noqa: PLC0415
    return get_embedder()


def _get_vectorai() -> VectorAIClient:
    from main import get_vectorai  # noqa: PLC0415
    return get_vectorai()


# ─── Module-level client singletons (lazy-init) ─────────────────────────
# Gemini and ElevenLabs are always constructed (they degrade gracefully
# when API keys are absent), so we keep them as module-level singletons.

_gemini: GeminiClient | None = None
_elevenlabs: ElevenLabsClient | None = None


def _get_gemini() -> GeminiClient:
    global _gemini
    if _gemini is None:
        _gemini = GeminiClient(api_key=settings.gemini_api_key)
    return _gemini


def _get_elevenlabs() -> ElevenLabsClient:
    global _elevenlabs
    if _elevenlabs is None:
        _elevenlabs = ElevenLabsClient(api_key=settings.elevenlabs_api_key)
    return _elevenlabs


# ─── Endpoints ────────────────────────────────────────────────────

@router.post("/accio", response_model=AnalogyResponse)
async def accio_analogy(
    request: AnalogyRequest,
    embedder: Embedder = Depends(_get_embedder),
    vectorai: VectorAIClient = Depends(_get_vectorai),
) -> AnalogyResponse:
    """Full Accio pipeline:
      1. Embed the confusing chunk (bge-small, 384-dim)
      2. VectorAI DB similarity search → top-3 hits
      3. Gemini rewrites best hit as an analogy for the student's avatar
      4. Return AnalogyResponse with latency badges
    """
    if embedder is None or vectorai is None:
        raise HTTPException(status_code=503, detail="Retrieval services not available")

    latency: dict[str, float] = {}

    # Step 1: Embed
    t0 = time.perf_counter()
    vectors = embedder.encode(request.chunk_text)
    latency["embedding"] = round((time.perf_counter() - t0) * 1000, 1)
    query_vec = vectors[0]

    # Step 2: VectorAI DB search
    t1 = time.perf_counter()
    try:
        hits = vectorai.search_similar(query_vec, limit=3)
    except Exception as exc:
        logger.exception("VectorAI DB search failed")
        raise HTTPException(status_code=502, detail=f"VectorAI DB error: {exc}") from exc
    latency["retrieval"] = round((time.perf_counter() - t1) * 1000, 1)

    if not hits:
        raise HTTPException(status_code=404, detail="No matching chunks found in VectorAI DB")

    best_hit = hits[0]
    original_text: str = best_hit["payload"].get("text", request.chunk_text)
    topic_node: str = best_hit["payload"].get("topic_node", request.concept_node)

    # Step 3: Gemini rewrite
    gemini = _get_gemini()
    t2 = time.perf_counter()
    analogy_text, gemini_ms = gemini.rewrite_analogy(
        concept_node=topic_node,
        original_text=original_text,
        avatar=request.avatar,
    )
    latency["gemini"] = round(gemini_ms, 1)

    logger.info(
        "Accio: concept=%s avatar=%s embed=%.1fms retrieval=%.1fms gemini=%.1fms",
        request.concept_node, request.avatar,
        latency["embedding"], latency["retrieval"], latency["gemini"],
    )

    return AnalogyResponse(
        concept_node=request.concept_node,
        original_text=original_text,
        analogy_text=analogy_text,
        avatar=request.avatar,
        latency_ms=latency,
    )


@router.post("/accio-cached")
async def accio_cached(
    concept_node: str,
    avatar: InterestAvatar = InterestAvatar.CRICKETER,
) -> Response:
    """Serve a pre-cached analogy MP3 from disk (offline/cable-pull demo mode).

    Returns audio/mpeg if the cache hit exists, 404 otherwise.
    """
    result = get_cached_analogy(concept_node=concept_node, avatar_str=avatar.value)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No cached analogy for concept={concept_node} avatar={avatar.value}. "
                   "Run scripts/demo_setup.sh to pre-cache.",
        )

    audio_bytes: bytes = result.get("audio", b"")
    if not audio_bytes:
        # Cache hit (JSON metadata) but no MP3 — return the text response
        return Response(
            content=result.get("analogy_text", ""),
            media_type="text/plain",
        )

    return Response(content=audio_bytes, media_type="audio/mpeg")
