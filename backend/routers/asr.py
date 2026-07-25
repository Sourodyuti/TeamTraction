"""ASR ingestion router — transcript → current_chunk + embedding (Phase 1/2, production).

Accepts transcript chunks from Whisper.cpp (or the pre-recorded transcript) and:
  1. Stores the chunk in the `current_chunk` table (so pings can tag to it)
  2. Triggers async embedding + upsert to VectorAI DB (via AI lead's services)
  3. Broadcasts a 'chunk_update' to connected dashboards

In production, Whisper streams chunks every ~15s. For the demo, the transcript
is pre-recorded and ingested in bulk or via timed playback.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from models.database import get_vector_connection
from models.schemas import LectureChunk

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/asr", tags=["asr"])


# ─── Request models ──────────────────────────────────────────────

class ChunkIngest(BaseModel):
    """Incoming transcript chunk from Whisper."""
    text: str = Field(..., min_length=1, max_length=5000)
    topic_node: str = Field("general", max_length=64)
    lecture_id: int = Field(1, ge=1)
    ts: float = Field(0.0, ge=0, description="Start timestamp within lecture (seconds)")
    difficulty: int = Field(3, ge=1, le=10)
    source: str = Field("lecture")


class ChunkResponse(BaseModel):
    """Response after ingesting a chunk."""
    chunk_id: str
    status: str
    topic_node: str
    embedded: bool


# ─── Core ingestion logic ────────────────────────────────────────

def _store_current_chunk(chunk: ChunkIngest, chunk_id: str) -> None:
    """Upsert the chunk into the current_chunk table (tracks the 'live' concept node)."""
    text_preview = chunk.text[:256]  # Truncate for the preview column
    ts_now = datetime.now(timezone.utc)

    try:
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            # Upsert: if lecture_id exists, update; otherwise insert
            cursor.execute(
                """
                MERGE INTO current_chunk t
                USING (SELECT ? AS lecture_id, ? AS chunk_id, ? AS topic_node,
                              ? AS text_preview, ? AS ts) AS src
                ON (t.lecture_id = src.lecture_id)
                WHEN MATCHED THEN UPDATE SET
                    chunk_id = src.chunk_id,
                    topic_node = src.topic_node,
                    text_preview = src.text_preview,
                    ts = src.ts
                WHEN NOT MATCHED THEN INSERT
                    (lecture_id, chunk_id, topic_node, text_preview, ts)
                    VALUES (src.lecture_id, src.chunk_id, src.topic_node, src.text_preview, src.ts)
                """,
                (chunk.lecture_id, chunk_id, chunk.topic_node, text_preview, ts_now),
            )
    except Exception as e:
        # Fallback: simple INSERT/UPDATE if MERGE not supported
        logger.warning("MERGE failed, trying INSERT/UPDATE: %s", e)
        try:
            with get_vector_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "DELETE FROM current_chunk WHERE lecture_id = ?",
                    (chunk.lecture_id,),
                )
                cursor.execute(
                    """INSERT INTO current_chunk (lecture_id, chunk_id, topic_node, text_preview, ts)
                       VALUES (?, ?, ?, ?, ?)""",
                    (chunk.lecture_id, chunk_id, chunk.topic_node, text_preview, ts_now),
                )
        except Exception as e2:
            logger.error("Failed to store current chunk: %s", e2)
            raise


async def _embed_and_upsert(chunk: ChunkIngest, chunk_id: str) -> bool:
    """Embed the chunk and upsert to VectorAI DB (async, non-blocking).

    Delegates to the AI lead's services. Returns True on success.
    This runs as a background task — the ingestion endpoint doesn't block on it.
    """
    try:
        from main import get_embedder, get_vectorai

        embedder = get_embedder()
        vectorai = get_vectorai()

        # Embed
        vector = embedder.encode(chunk.text)[0]

        # Upsert to VectorAI DB
        point = {
            "id": chunk_id,
            "vector": vector,
            "payload": {
                "topic_node": chunk.topic_node,
                "ts": chunk.ts,
                "diff": chunk.difficulty,
                "source": chunk.source,
                "lecture_id": chunk.lecture_id,
                "text": chunk.text,
            },
        }
        vectorai.upsert_chunks([point])

        logger.debug("Embedded + upserted chunk %s (topic=%s)", chunk_id, chunk.topic_node)
        return True

    except Exception as e:
        logger.warning("Embed/upsert failed for chunk %s (non-fatal): %s", chunk_id, e)
        return False


async def _broadcast_chunk_update(lecture_id: int, chunk_id: str, topic_node: str) -> None:
    """Notify connected dashboards that a new chunk arrived."""
    try:
        from routers.websocket import manager
        await manager.broadcast_to_lecture(lecture_id, {
            "type": "chunk_update",
            "lecture_id": lecture_id,
            "chunk_id": chunk_id,
            "topic_node": topic_node,
        })
    except Exception as e:
        logger.debug("Broadcast chunk_update failed (non-fatal): %s", e)


# ─── Endpoints ───────────────────────────────────────────────────

@router.post("/ingest-chunk", response_model=ChunkResponse)
async def ingest_chunk(chunk: ChunkIngest, background_tasks: BackgroundTasks) -> ChunkResponse:
    """Ingest a single transcript chunk.

    1. Stores it in current_chunk (synchronous — pings need it immediately)
    2. Schedules embedding + VectorAI upsert as a background task
    3. Broadcasts chunk_update to dashboards
    """
    chunk_id = f"{chunk.lecture_id}_{int(time.time() * 1000)}"

    # 1. Store in current_chunk (synchronous — this is what pings tag to)
    try:
        _store_current_chunk(chunk, chunk_id)
    except Exception as e:
        logger.error("Failed to store chunk: %s", e)
        raise HTTPException(status_code=503, detail=f"Failed to store chunk: {e}")

    # 2. Schedule embedding + upsert (async — doesn't block the response)
    background_tasks.add_task(_embed_and_upsert, chunk, chunk_id)

    # 3. Broadcast to dashboards
    background_tasks.add_task(_broadcast_chunk_update, chunk.lecture_id, chunk_id, chunk.topic_node)

    logger.info("Ingested chunk %s: topic=%s lecture=%d", chunk_id, chunk.topic_node, chunk.lecture_id)

    return ChunkResponse(
        chunk_id=chunk_id,
        status="stored",
        topic_node=chunk.topic_node,
        embedded=False,  # Will be True after background task completes
    )


@router.post("/ingest-batch")
async def ingest_batch(
    chunks: list[ChunkIngest],
    background_tasks: BackgroundTasks,
) -> dict:
    """Bulk-ingest multiple chunks (used by data-prep scripts).

    Stores all chunks in current_chunk (only the last one per lecture becomes 'current'),
    then schedules embedding for all of them.
    """
    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks provided")
    if len(chunks) > 500:
        raise HTTPException(status_code=413, detail="Too many chunks (max 500 per batch)")

    stored = 0
    chunk_ids: list[str] = []

    for i, chunk in enumerate(chunks):
        chunk_id = f"{chunk.lecture_id}_batch_{int(time.time())}_{i}"
        try:
            _store_current_chunk(chunk, chunk_id)
            chunk_ids.append(chunk_id)
            stored += 1
            background_tasks.add_task(_embed_and_upsert, chunk, chunk_id)
        except Exception as e:
            logger.warning("Failed to store chunk %d: %s", i, e)

    logger.info("Batch ingest: %d/%d chunks stored for lecture %d",
                stored, len(chunks), chunks[0].lecture_id)

    return {
        "status": "partial" if stored < len(chunks) else "complete",
        "stored": stored,
        "total": len(chunks),
        "chunk_ids": chunk_ids[:10],  # Return first 10 for reference
    }


@router.get("/current-chunk/{lecture_id}")
async def get_current_chunk(lecture_id: int) -> dict:
    """Get the current (latest) chunk for a lecture — the live concept node."""
    try:
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT chunk_id, topic_node, text_preview, ts FROM current_chunk "
                "WHERE lecture_id = ?",
                (lecture_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="No current chunk for this lecture")
            return {
                "lecture_id": lecture_id,
                "chunk_id": row[0],
                "topic_node": row[1],
                "text_preview": row[2],
                "ts": row[3].isoformat() if hasattr(row[3], "isoformat") else str(row[3]),
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch current chunk: %s", e)
        raise HTTPException(status_code=503, detail=f"Failed: {e}")


@router.get("/lectures/{lecture_id}/chunks")
async def list_chunks(lecture_id: int, limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    """List recent chunks for a lecture (from VectorAI DB, not current_chunk)."""
    # This would query VectorAI DB for all chunks of a lecture.
    # For now, return current_chunk history if available.
    # TODO: query VectorAI DB with payload filter lecture_id
    try:
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT chunk_id, topic_node, text_preview, ts FROM current_chunk "
                "WHERE lecture_id = ? ORDER BY ts DESC",
                (lecture_id,),
            )
            rows = cursor.fetchall()
            return [
                {
                    "chunk_id": r[0],
                    "topic_node": r[1],
                    "text_preview": r[2],
                    "ts": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
                }
                for r in rows[:limit]
            ]
    except Exception as e:
        logger.error("Failed to list chunks: %s", e)
        raise HTTPException(status_code=503, detail=f"Failed: {e}")
