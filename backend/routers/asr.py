"""ASR ingestion router — Whisper transcript → embedding pipeline (Phase 1/2).

Accepts transcript chunks from Whisper.cpp (or the pre-recorded transcript),
embeds them with bge-small, and upserts into VectorAI DB.

In production this could stream from Whisper's output; for the demo the
transcript is pre-recorded and pre-transcribed, so this is a bulk-ingest endpoint.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks

from models.schemas import LectureChunk

router = APIRouter(prefix="/asr", tags=["asr"])


@router.post("/ingest-chunk")
async def ingest_chunk(chunk: LectureChunk, background_tasks: BackgroundTasks) -> dict:
    """Ingest a single transcript chunk: embed → upsert to VectorAI DB.

    TODO Phase 1: Implement:
      1. Embed `chunk.text` with bge-small (384-dim).
      2. Upsert the vector + payload into VectorAI DB `lecture_chunks`.
      3. Update the 'current concept_node' tracker for this lecture.

    For now, returns a stub acknowledgment.
    """
    return {
        "status": "stub",
        "chunk_id": chunk.chunk_id,
        "topic_node": chunk.topic_node,
        "message": "TODO: embed + upsert to VectorAI DB (Phase 1)",
    }


@router.post("/ingest-batch")
async def ingest_batch(chunks: list[LectureChunk], background_tasks: BackgroundTasks) -> dict:
    """Bulk-ingest multiple chunks (used by data-prep scripts).

    TODO Phase 1: Process chunks in parallel, embed, upsert.
    """
    return {
        "status": "stub",
        "count": len(chunks),
        "message": "TODO: batch embed + upsert (Phase 1)",
    }
