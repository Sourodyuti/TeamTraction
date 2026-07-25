"""ASR ingestion router — Whisper transcript → embedding pipeline (Phase 1+2).

Accepts transcript chunks from Whisper.cpp (or a pre-recorded transcript),
embeds them with bge-small-en-v1.5, and upserts into VectorAI DB.

Also updates the `current_chunk` tracker in Actian Vector so that
WebSocket pings can tag their concept_node correctly.

Endpoints:
  POST /asr/ingest-chunk   — single chunk, foreground
  POST /asr/ingest-batch   — multiple chunks, background task for upsert
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from models.schemas import LectureChunk
from services.embedder import Embedder
from services.vectorai_client import VectorAIClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/asr", tags=["asr"])

_CURRENT_CHUNK: dict[int, dict] = {}  # lecture_id → {chunk_id, topic_node, text_preview}


# ─── Dependencies ─────────────────────────────────────────────────

def _get_embedder() -> Embedder:
    return Embedder()


def _get_vectorai() -> VectorAIClient:
    client = VectorAIClient()
    if client._client is None:
        client.connect()
    return client


# ─── Helpers ──────────────────────────────────────────────────────

def _embed_and_upsert(chunk: LectureChunk, embedder: Embedder, vectorai: VectorAIClient) -> None:
    """Embed a chunk and upsert into VectorAI DB. Called sync (or in background)."""
    vector, emb_ms = embedder.encode_with_latency(chunk.text)
    logger.debug("Embedded chunk %s (%.1f ms)", chunk.chunk_id, emb_ms)

    vectorai.upsert_chunks([
        {
            "id": chunk.chunk_id,
            "vector": vector,
            "payload": {
                "chunk_id": chunk.chunk_id,
                "lecture_id": chunk.lecture_id,
                "text": chunk.text,
                "topic_node": chunk.topic_node,
                "subtopic": chunk.subtopic,
                "difficulty": chunk.difficulty,
                "source": chunk.source,
                "ts": chunk.ts,
            },
        }
    ])
    logger.info("Upserted chunk %s (lecture=%d, topic=%s)", chunk.chunk_id, chunk.lecture_id, chunk.topic_node)


def _update_current_chunk(chunk: LectureChunk) -> None:
    """Track the active concept_node per lecture (in-memory for speed).
    WebSocket pings read from this to tag events to the right concept.
    """
    _CURRENT_CHUNK[chunk.lecture_id] = {
        "chunk_id": chunk.chunk_id,
        "topic_node": chunk.topic_node,
        "text_preview": chunk.text[:128],
        "ts": chunk.ts,
    }


def get_current_chunk(lecture_id: int) -> dict | None:
    """Return the active chunk for a lecture (used by WebSocket handler)."""
    return _CURRENT_CHUNK.get(lecture_id)


# ─── Endpoints ───────────────────────────────────────────────────

@router.post("/ingest-chunk")
async def ingest_chunk(
    chunk: LectureChunk,
    embedder: Annotated[Embedder, Depends(_get_embedder)] = None,
    vectorai: Annotated[VectorAIClient, Depends(_get_vectorai)] = None,
) -> dict:
    """Ingest a single transcript chunk: embed → upsert to VectorAI DB.

    Updates the in-memory current_chunk tracker so WebSocket pings
    can tag confusion events to this concept_node.
    """
    try:
        _embed_and_upsert(chunk, embedder, vectorai)
        _update_current_chunk(chunk)
    except Exception as exc:
        logger.exception("Failed to ingest chunk %s", chunk.chunk_id)
        raise HTTPException(status_code=503, detail=f"Ingest failed: {exc}") from exc

    return {
        "status": "ok",
        "chunk_id": chunk.chunk_id,
        "topic_node": chunk.topic_node,
        "lecture_id": chunk.lecture_id,
    }


@router.post("/ingest-batch")
async def ingest_batch(
    chunks: list[LectureChunk],
    background_tasks: BackgroundTasks,
    embedder: Annotated[Embedder, Depends(_get_embedder)] = None,
    vectorai: Annotated[VectorAIClient, Depends(_get_vectorai)] = None,
) -> dict:
    """Bulk-ingest multiple chunks in a background task.

    Returns immediately (202 Accepted) and processes in background.
    The last chunk in the list sets the current_chunk for the lecture.
    """
    if not chunks:
        return {"status": "ok", "count": 0, "message": "No chunks to ingest"}

    def _run_batch():
        for chunk in chunks:
            try:
                _embed_and_upsert(chunk, embedder, vectorai)
                _update_current_chunk(chunk)
            except Exception:
                logger.exception("Batch ingest failed for chunk %s", chunk.chunk_id)

    background_tasks.add_task(_run_batch)

    return {
        "status": "accepted",
        "count": len(chunks),
        "message": "Batch ingest queued as background task",
    }


@router.get("/current-chunk/{lecture_id}")
async def current_chunk(lecture_id: int) -> dict:
    """Return the currently active chunk for a lecture (for debugging / ping tagging)."""
    chunk = get_current_chunk(lecture_id)
    if not chunk:
        raise HTTPException(status_code=404, detail=f"No active chunk for lecture {lecture_id}")
    return chunk
