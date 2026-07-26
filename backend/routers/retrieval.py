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
from models.schemas import AnalogyResponse, AnalogyRequest, InterestAvatar, RetrievalResult, HybridSearchRequest, HybridSearchResponse, HybridSearchResult, SearchMode
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

    # ─── 1. Embed the confusing chunk ─────────────────────────────────
    embedder = get_embedder()
    try:
        query_vector, emb_ms = embedder.encode_with_latency(chunk_text)
        latency["embedding"] = emb_ms
        logger.debug("Embedding: %.1fms (dim=%d)", emb_ms, len(query_vector))
    except Exception as e:
        logger.error("Embedding failed — cannot proceed: %s", e)
        raise HTTPException(status_code=503, detail=f"Embedding service unavailable: {e}")

    # ─── 2. Retrieve best past explanations from VectorAI DB ──────────
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
                payload = hit.get("payload", {})
                best_text = payload.get("text") or hit.get("text") or chunk_text
            else:
                best_text = getattr(hit, "text", None) or chunk_text
            if not best_text:
                best_text = chunk_text
    except Exception as e:
        logger.error("Retrieval failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Retrieval service unavailable: {e}")

    # ─── 3. Rewrite as an analogy via Gemini (fallback → NVIDIA NIM) ──
    analogy_text = best_text
    try:
        from services.gemini_client import GeminiClient
        gemini = GeminiClient()
        analogy_text, gemini_ms = await gemini.rewrite_analogy(concept_node, best_text, avatar)
        latency["gemini"] = gemini_ms
        logger.debug("Gemini/NVIDIA rewrite: %.1fms", gemini_ms)
    except Exception as e:
        logger.warning("LLM rewrite failed (non-fatal, using raw text): %s", e)
        latency["gemini"] = 0.0

    # ─── 4. Convert to speech via ElevenLabs ───────────────────────
    audio_url = None
    try:
        from services.elevenlabs_client import ElevenLabsClient
        tts = ElevenLabsClient()
        import uuid
        import base64
        res = tts.get_audio_url(analogy_text) if hasattr(tts, "get_audio_url") and callable(getattr(tts, "get_audio_url")) else None
        if res and isinstance(res, str):
            audio_url = res
            latency["elevenlabs"] = 50.0
        else:
            audio_bytes, tts_ms = tts.text_to_speech(analogy_text)
            latency["elevenlabs"] = tts_ms
            if audio_bytes:
                job_id = str(uuid.uuid4())
                AUDIO_CACHE[job_id] = audio_bytes
                encoded = base64.b64encode(audio_bytes).decode("utf-8")
                audio_url = f"data:audio/mpeg;base64,{encoded}"
        logger.debug("ElevenLabs TTS: latency=%.1fms", latency["elevenlabs"])
    except Exception as e:
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


# ─── REST endpoint ─────────────────────────────────────────────

@router.post("/accio", response_model=AnalogyResponse)
async def accio_analogy(request: AnalogyRequest) -> AnalogyResponse:
    """Trigger Accio Analogy manually via REST."""
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

    Returns audio/mpeg if a cached MP3 exists, plain text analogy otherwise, 404 if
    nothing is cached at all.

    fix #5: get_cached_analogy() stores MP3 bytes under the key 'audio_bytes'
    (see offline_cache.py). The previous code read result.get('audio', b'')
    which always returned b'' — so the endpoint always fell through to the
    text fallback, silently breaking the cable-pull demo moment.
    """
    result = get_cached_analogy(concept_node=concept_node, avatar_str=avatar.value)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No cached analogy for concept={concept_node} avatar={avatar.value}. "
                "Run scripts/demo_setup.sh to pre-cache."
            ),
        )

    # fix #5: correct key is 'audio_bytes', not 'audio'
    audio_bytes: bytes = result.get("audio_bytes", b"")
    if not audio_bytes:
        # Cache hit (JSON metadata only) — return the text analogy
        return Response(
            content=result.get("analogy_text", ""),
            media_type="text/plain",
        )

    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.get("/audio/{job_id}")
async def get_audio(job_id: str) -> Response:
    """Serve pre-generated audio bytes by job ID."""
    if job_id not in AUDIO_CACHE:
        raise HTTPException(status_code=404, detail="Audio not found or expired")
    return Response(content=AUDIO_CACHE[job_id], media_type="audio/mpeg")


@router.get("/health")
async def retrieval_health() -> dict:
    """Check health of retrieval pipeline dependencies."""
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


# ─── Advanced Search Endpoints (Hybrid Fusion + Filtered) ──────────

@router.post("/search", response_model=HybridSearchResponse)
async def hybrid_search(request: HybridSearchRequest) -> HybridSearchResponse:
    """Advanced search: hybrid fusion, filtered, semantic, or keyword.
    
    Supports:
    - HYBRID: Reciprocal Rank Fusion of semantic + BM25 keyword search
    - FILTERED: Semantic search with structured payload filters
    - SEMANTIC: Pure vector similarity search
    - KEYWORD: Pure BM25 keyword search
    """
    import time as _t
    latency = {}
    
    if request.mode == SearchMode.HYBRID:
        # Use hybrid fusion engine
        try:
            from services.hybrid_search import get_hybrid_engine
            engine = get_hybrid_engine()
            if engine is None:
                raise RuntimeError("Hybrid search engine not initialized")
            
            results, lat = engine.search_with_latency(
                query_text=request.query_text,
                limit=request.limit,
                alpha=request.alpha,
                filter=_build_filter_dict(request),
            )
            latency = lat
        except Exception as e:
            logger.warning("Hybrid search failed, falling back to semantic: %s", e)
            results, latency = _fallback_semantic_search(request)
    
    elif request.mode == SearchMode.FILTERED:
        results, latency = _filtered_search(request)
    
    elif request.mode == SearchMode.KEYWORD:
        try:
            from services.hybrid_search import get_hybrid_engine
            engine = get_hybrid_engine()
            if engine is None:
                raise RuntimeError("Hybrid engine not initialized")
            
            t0 = _t.perf_counter()
            kw_results = engine.bm25_index.search(request.query_text, request.limit)
            kw_ms = (_t.perf_counter() - t0) * 1000
            
            results = [
                {
                    "id": r["id"],
                    "text": r.get("payload", {}).get("text", ""),
                    "topic_node": r.get("payload", {}).get("topic_node", ""),
                    "source": r.get("payload", {}).get("source", ""),
                    "score": r["score"],
                    "keyword_score": r["score"],
                    "payload": r.get("payload", {}),
                }
                for r in kw_results
            ]
            latency = {"keyword_ms": round(kw_ms, 1), "total_ms": round(kw_ms, 1)}
        except Exception as e:
            logger.warning("Keyword search failed, falling back to semantic: %s", e)
            results, latency = _fallback_semantic_search(request)
    
    else:  # SEMANTIC
        results, latency = _fallback_semantic_search(request)
    
    search_results = []
    for r in results:
        search_results.append(HybridSearchResult(
            id=r.get("id", ""),
            text=r.get("text", r.get("payload", {}).get("text", "")),
            topic_node=r.get("topic_node", r.get("payload", {}).get("topic_node", "")),
            source=r.get("source", r.get("payload", {}).get("source", "")),
            score=r.get("score", 0.0),
            semantic_score=r.get("semantic_score"),
            keyword_score=r.get("keyword_score"),
            fusion_method=r.get("fusion_method"),
            payload=r.get("payload", {}),
        ))
    
    return HybridSearchResponse(
        results=search_results,
        mode=request.mode,
        query_text=request.query_text,
        total_results=len(search_results),
        latency_ms=latency,
    )


@router.get("/search/demo")
async def search_demo(
    query: str = "chain rule backpropagation gradient",
    mode: str = "hybrid",
    limit: int = 5,
    alpha: float = 0.6,
    topic_node: Optional[str] = None,
    difficulty_min: Optional[int] = None,
    difficulty_max: Optional[int] = None,
) -> HybridSearchResponse:
    """Demo endpoint for testing advanced search."""
    try:
        search_mode = SearchMode(mode)
    except ValueError:
        search_mode = SearchMode.HYBRID
    
    request = HybridSearchRequest(
        query_text=query,
        mode=search_mode,
        limit=limit,
        alpha=alpha,
        topic_node=topic_node,
        difficulty_min=difficulty_min,
        difficulty_max=difficulty_max,
    )
    return await hybrid_search(request)


def _build_filter_dict(request: HybridSearchRequest) -> dict | None:
    """Build a filter dict from structured request fields."""
    f = {}
    if request.topic_node:
        f["topic_node"] = request.topic_node
    if request.source:
        f["source"] = request.source
    if request.lecture_id is not None:
        f["lecture_id"] = request.lecture_id
    return f or None


def _fallback_semantic_search(request: HybridSearchRequest) -> tuple[list[dict], dict]:
    """Pure semantic search fallback."""
    import time as _t
    
    embedder = get_embedder()
    vectorai = get_vectorai()
    
    t0 = _t.perf_counter()
    query_vector, emb_ms = embedder.encode_with_latency(request.query_text)
    
    t1 = _t.perf_counter()
    hits = vectorai.search_similar(query_vector, limit=request.limit, filter=_build_filter_dict(request))
    ret_ms = (_t.perf_counter() - t1) * 1000
    
    results = [
        {
            "id": h["id"],
            "text": h.get("payload", {}).get("text", ""),
            "topic_node": h.get("payload", {}).get("topic_node", ""),
            "source": h.get("payload", {}).get("source", ""),
            "score": h["score"],
            "semantic_score": h["score"],
            "payload": h.get("payload", {}),
        }
        for h in hits
    ]
    
    latency = {
        "embedding_ms": round(emb_ms, 1),
        "semantic_ms": round(ret_ms, 1),
        "total_ms": round(emb_ms + ret_ms, 1),
    }
    return results, latency


def _filtered_search(request: HybridSearchRequest) -> tuple[list[dict], dict]:
    """Filtered search: semantic + structured payload filters."""
    import time as _t
    
    embedder = get_embedder()
    vectorai = get_vectorai()
    
    t0 = _t.perf_counter()
    query_vector, emb_ms = embedder.encode_with_latency(request.query_text)
    
    t1 = _t.perf_counter()
    # Use the enhanced filtered search if available
    if hasattr(vectorai, 'search_filtered'):
        hits = vectorai.search_filtered(
            query_vector=query_vector,
            limit=request.limit,
            topic_node=request.topic_node,
            source=request.source,
            lecture_id=request.lecture_id,
            difficulty_min=request.difficulty_min,
            difficulty_max=request.difficulty_max,
            ts_min=request.ts_min,
            ts_max=request.ts_max,
        )
    else:
        hits = vectorai.search_similar(query_vector, limit=request.limit, filter=_build_filter_dict(request))
    
    ret_ms = (_t.perf_counter() - t1) * 1000
    
    results = [
        {
            "id": h["id"],
            "text": h.get("payload", {}).get("text", ""),
            "topic_node": h.get("payload", {}).get("topic_node", ""),
            "source": h.get("payload", {}).get("source", ""),
            "score": h["score"],
            "semantic_score": h["score"],
            "payload": h.get("payload", {}),
        }
        for h in hits
    ]
    
    latency = {
        "embedding_ms": round(emb_ms, 1),
        "filtered_search_ms": round(ret_ms, 1),
        "total_ms": round(emb_ms + ret_ms, 1),
    }
    return results, latency
