"""Accio Analogy — retrieval pipeline orchestration (Phase 4/5/6, production).

This router orchestrates the full retrieval → rewrite → TTS pipeline:
  1. Embed the confusing chunk (AI lead's Embedder)
  2. Search VectorAI DB for the best past explanation (AI lead's VectorAIClient)
  3. Rewrite as an analogy via Gemini (AI lead's GeminiClient)
  4. Convert to speech via ElevenLabs (AI lead's ElevenLabsClient)
  5. Return an AnalogyResponse with measured latencies

The AI/ML services are injected as dependencies — they're owned by the AI lead.
If any service is unavailable, the pipeline degrades gracefully:
  - Embedder/VectorAI down → return an error (core dependency)
  - Gemini down → return the raw retrieved explanation
  - ElevenLabs down → return text only, no audio_url

The WebSocket hub calls `run_retrieval_pipeline()` when the threshold fires.
REST clients can also trigger retrieval directly via POST /retrieval/accio.
"""
from __future__ import annotations

import logging
import time as _time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response

from config import settings
from dependencies import get_embedder, get_vectorai
from models.schemas import AnalogyResponse, AnalogyRequest, InterestAvatar, RetrievalResult
from services.offline_cache import get_cached_analogy

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retrieval", tags=["retrieval"])

AUDIO_CACHE: dict[str, bytes] = {}

async def run_retrieval_pipeline(
    concept_node: str,
    chunk_text: str,
    avatar: InterestAvatar,
    student_ids: Optional[list[str]] = None,
) -> AnalogyResponse:
    """Full pipeline: embed → retrieve → rewrite → TTS.

    Called by the WebSocket hub when threshold fires, or by the REST endpoint.

    Returns an AnalogyResponse with latencies measured per-stage.
    Raises HTTPException only on total failure (embedder/retrieval down).
    """
    latency = {"embedding": 0.0, "retrieval": 0.0, "gemini": 0.0, "elevenlabs": 0.0}

    # ─── 1. Embed the confusing chunk ─────────────────────────────
    embedder = get_embedder()
    try:
        query_vector, emb_ms = embedder.encode_with_latency(chunk_text)
        latency["embedding"] = emb_ms
        logger.debug("Embedding: %.1fms (dim=%d)", emb_ms, len(query_vector))
    except Exception as e:
        logger.error("Embedding failed — cannot proceed: %s", e)
        raise HTTPException(status_code=503, detail=f"Embedding service unavailable: {e}")

    # ─── 2. Retrieve best past explanations from VectorAI DB ──────
    vectorai = get_vectorai()
    try:
        t0 = _time.perf_counter()
        hits = vectorai.search_similar(query_vector, limit=3)
        latency["retrieval"] = (_time.perf_counter() - t0) * 1000
        logger.debug("Retrieval: %.1fms (%d hits)", latency["retrieval"], len(hits))

        if not hits:
            logger.warning("No retrieval hits for concept '%s' — using chunk text as-is",
                           concept_node)
            best_text = chunk_text
        else:
            hit = hits[0]
            if isinstance(hit, dict):
                # Result is {"id": ..., "payload": {"text": ..., ...}, "score": ...}
                payload = hit.get("payload", {})
                best_text = payload.get("text") or hit.get("text") or chunk_text
            else:
                best_text = getattr(hit, "text", None) or chunk_text
            if not best_text:
                best_text = chunk_text
    except Exception as e:
        logger.error("Retrieval failed: %s", e)
        # Core failure — can't do anything without retrieval
        raise HTTPException(status_code=503, detail=f"Retrieval service unavailable: {e}")

    # ─── 3. Rewrite as an analogy via Gemini ──────────────────────
    analogy_text = best_text  # Default: return raw retrieved text
    try:
        from services.gemini_client import GeminiClient
        gemini = GeminiClient()
        analogy_text, gemini_ms = gemini.rewrite_analogy(concept_node, best_text, avatar)
        latency["gemini"] = gemini_ms
        logger.debug("Gemini rewrite: %.1fms", gemini_ms)
    except Exception as e:
        # Non-fatal: return the raw retrieved text if Gemini fails
        logger.warning("Gemini rewrite failed (non-fatal, using raw text): %s", e)
        latency["gemini"] = 0.0

    # ─── 4. Convert to speech via ElevenLabs ──────────────────────
    audio_url = None
    try:
        from services.elevenlabs_client import ElevenLabsClient
        tts = ElevenLabsClient()
        # Generate audio and get latency
        import uuid
        import base64
        audio_bytes, tts_ms = tts.text_to_speech(analogy_text)
        latency["elevenlabs"] = tts_ms
        if audio_bytes:
            job_id = str(uuid.uuid4())
            AUDIO_CACHE[job_id] = audio_bytes
            # Use base64 for now as per instructions
            encoded = base64.b64encode(audio_bytes).decode("utf-8")
            audio_url = f"data:audio/mpeg;base64,{encoded}"
        logger.debug("ElevenLabs TTS: latency=%.1fms", tts_ms)
    except Exception as e:
        # Non-fatal: return text only, no audio
        logger.warning("ElevenLabs TTS failed (non-fatal, text-only): %s", e)

    total_ms = sum(latency.values())
    logger.info("Pipeline complete: concept='%s' total=%.0fms "
                "(embed=%.0f retrieve=%.0f gemini=%.0f)",
                concept_node, total_ms, latency["embedding"],
                latency["retrieval"], latency["gemini"])

    return AnalogyResponse(
        concept_node=concept_node,
        original_text=best_text,
        analogy_text=analogy_text,
        avatar=avatar,
        latency_ms=latency,
        audio_url=audio_url,
    )


# ─── REST endpoint ───────────────────────────────────────────────

@router.post("/accio", response_model=AnalogyResponse)
async def accio_analogy(request: AnalogyRequest) -> AnalogyResponse:
    """Trigger Accio Analogy manually via REST.

    Body:
        {
            "concept_node": "chain_rule",
            "chunk_text": "The chain rule multiplies gradients layer by layer...",
            "student_ids": ["student_abc"],
            "avatar": "cricketer"
        }
    """
    logger.info("REST trigger: accio analogy for '%s' (avatar=%s)",
                request.concept_node, request.avatar.value)

    return await run_retrieval_pipeline(
        concept_node=request.concept_node,
        chunk_text=request.chunk_text,
        avatar=request.avatar,
        student_ids=request.student_ids,
    )


@router.get("/accio/demo", response_model=AnalogyResponse)
async def accio_demo(
    concept_node: str = "chain_rule",
    chunk_text: str = "The chain rule says gradients multiply layer by layer in backpropagation.",
    avatar: InterestAvatar = InterestAvatar.CRICKETER,
) -> AnalogyResponse:
    """Demo endpoint with sensible defaults — for quick testing without a request body."""
    return await run_retrieval_pipeline(
        concept_node=concept_node,
        chunk_text=chunk_text,
        avatar=avatar,
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


@router.get("/audio/{job_id}")
async def get_audio(job_id: str) -> Response:
    """Serve pre-generated audio bytes."""
    if job_id not in AUDIO_CACHE:
        raise HTTPException(status_code=404, detail="Audio not found or expired")
    return Response(content=AUDIO_CACHE[job_id], media_type="audio/mpeg")


@router.get("/health")
async def retrieval_health() -> dict:
    """Check the health of the retrieval pipeline dependencies."""
    embedder_ok = False
    vectorai_ok = False
    gemini_configured = bool(settings.gemini_api_key)
    elevenlabs_configured = bool(settings.elevenlabs_api_key)

    try:
        get_embedder()
        embedder_ok = True
    except Exception:
        pass

    try:
        vdb = get_vectorai()
        vectorai_ok = vdb.health()
    except Exception:
        pass

    return {
        "embedder": embedder_ok,
        "vectorai_db": vectorai_ok,
        "gemini_configured": gemini_configured,
        "elevenlabs_configured": elevenlabs_configured,
        "ready": embedder_ok and vectorai_ok,
    }
