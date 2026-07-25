"""ASR ingestion router — Whisper transcript → embedding pipeline (Phase 1).

Accepts transcript chunks from Whisper.cpp (or the pre-recorded transcript),
embeds them with bge-small, and upserts into VectorAI DB.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from models.schemas import LectureChunk
from services.embedder import Embedder
from services.vectorai_client import VectorAIClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/asr", tags=["asr"])


# ─── Dependency injection helpers ─────────────────────────────────
# These are overridden at app creation time in main.py via app.dependency_overrides
# or by referencing the module-level singletons directly.

def _get_embedder() -> Embedder:
    """Lazy import to avoid circular imports; overridden by main.py lifespan."""
    from main import get_embedder  # noqa: PLC0415
    return get_embedder()


def _get_vectorai() -> VectorAIClient:
    from main import get_vectorai  # noqa: PLC0415
    return get_vectorai()


# ─── Helpers ─────────────────────────────────────────────────────

def _embed_and_upsert(
    chunk: LectureChunk,
    embedder: Embedder,
    vectorai: VectorAIClient,
) -> dict[str, Any]:
    """Core embed → upsert logic (sync, called from both endpoints)."""
    t0 = time.perf_counter()
    vectors = embedder.encode(chunk.text)
    embed_ms = round((time.perf_counter() - t0) * 1000, 1)

    point = {
        "id": chunk.chunk_id,
        "vector": vectors[0],
        "payload": {
            "lecture_id": chunk.lecture_id,
            "topic_node": chunk.topic_node,
            "subtopic": chunk.subtopic,
            "text": chunk.text,
            "difficulty": chunk.difficulty,
            "source": chunk.source,
            "ts": chunk.ts,
        },
    }

    t1 = time.perf_counter()
    vectorai.upsert_chunks([point])
    upsert_ms = round((time.perf_counter() - t1) * 1000, 1)

    return {
        "status": "ok",
        "chunk_id": chunk.chunk_id,
        "topic_node": chunk.topic_node,
        "latency_ms": {"embedding": embed_ms, "upsert": upsert_ms},
    }


def _batch_upsert(
    chunks: list[LectureChunk],
    embedder: Embedder,
    vectorai: VectorAIClient,
) -> None:
    """Background task: embed all texts, upsert in a single call."""
    texts = [c.text for c in chunks]
    t0 = time.perf_counter()
    all_vectors = embedder.encode(texts)
    embed_ms = round((time.perf_counter() - t0) * 1000, 1)

    points = [
        {
            "id": chunk.chunk_id,
            "vector": vec,
            "payload": {
                "lecture_id": chunk.lecture_id,
                "topic_node": chunk.topic_node,
                "subtopic": chunk.subtopic,
                "text": chunk.text,
                "difficulty": chunk.difficulty,
                "source": chunk.source,
                "ts": chunk.ts,
            },
        }
        for chunk, vec in zip(chunks, all_vectors)
    ]

    t1 = time.perf_counter()
    vectorai.upsert_chunks(points)
    upsert_ms = round((time.perf_counter() - t1) * 1000, 1)
    logger.info(
        "Batch ingest: %d chunks embedded in %.1fms, upserted in %.1fms",
        len(chunks), embed_ms, upsert_ms,
    )


# ─── Endpoints ────────────────────────────────────────────────────

@router.post("/ingest-chunk")
async def ingest_chunk(
    chunk: LectureChunk,
    embedder: Embedder = Depends(_get_embedder),
    vectorai: VectorAIClient = Depends(_get_vectorai),
) -> dict:
    """Ingest a single transcript chunk: embed → upsert to VectorAI DB.

    Returns chunk_id, topic_node, and per-step latency.
    """
    if embedder is None or vectorai is None:
        raise HTTPException(status_code=503, detail="AI services not available")
    try:
        return _embed_and_upsert(chunk, embedder, vectorai)
    except Exception as exc:
        logger.exception("ingest-chunk failed for chunk_id=%s", chunk.chunk_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/ingest-batch")
async def ingest_batch(
    chunks: list[LectureChunk],
    background_tasks: BackgroundTasks,
    embedder: Embedder = Depends(_get_embedder),
    vectorai: VectorAIClient = Depends(_get_vectorai),
) -> dict:
    """Bulk-ingest multiple chunks. Embedding + upsert run in a background task.

    Returns immediately so the HTTP client doesn't wait on 50+ embeddings.
    """
    if embedder is None or vectorai is None:
        raise HTTPException(status_code=503, detail="AI services not available")
    if not chunks:
        return {"status": "ok", "count": 0, "message": "no chunks provided"}

    background_tasks.add_task(_batch_upsert, chunks, embedder, vectorai)
    return {
        "status": "accepted",
        "count": len(chunks),
        "message": f"{len(chunks)} chunks queued for embedding + upsert",
    }
