"""Vision router — screen frame analysis via Gemini Vision.

Accepts base64-encoded screen frames, analyzes them with Gemini Vision
to extract lecture context (topic, slide text, difficulty, key terms).
"""
from __future__ import annotations

import base64
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.gemini_vision import get_gemini_vision

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vision", tags=["vision"])


class FrameAnalysisRequest(BaseModel):
    image: str
    mime_type: str = "image/png"
    question: str | None = None


class FrameAnalysisResponse(BaseModel):
    topic_node: str
    comprehensive_summary: str
    brief_summary: str
    full_text_transcription: str
    diagram_descriptions: str
    difficulty: int
    key_terms: list[str]
    latency_ms: float
    answer: str | None = None


@router.post("/analyze-frame", response_model=FrameAnalysisResponse)
async def analyze_frame(req: FrameAnalysisRequest) -> FrameAnalysisResponse:
    vision = get_gemini_vision()
    if not vision or not vision.available:
        raise HTTPException(status_code=503, detail="Gemini Vision not available")

    try:
        image_bytes = base64.b64decode(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    import asyncio
    context, latency_ms = await asyncio.to_thread(
        vision.analyze_frame, image_bytes, req.mime_type, req.question
    )

    topic_node = context.get("topic_node", "unknown")
    comprehensive_summary = context.get("comprehensive_summary", "")
    brief_summary = context.get("brief_summary", "")
    full_text = context.get("full_text_transcription", "")
    diagrams = context.get("diagram_descriptions", "")
    difficulty = context.get("difficulty", 5)

    # Index into VectorDB for future retrieval
    if topic_node != "unknown" and comprehensive_summary:
        from services.knowledge_base import get_knowledge_base
        import uuid
        import time
        
        rich_text = f"Transcription: {full_text}\nDiagrams: {diagrams}\nSummary: {comprehensive_summary}"
        
        kb = get_knowledge_base()
        kb.index_chunk(
            lecture_id=1,
            chunk_id=str(uuid.uuid4()),
            text=rich_text,
            ts=time.time(),
            topic_node=topic_node,
            difficulty=difficulty
        )

    return FrameAnalysisResponse(
        topic_node=topic_node,
        comprehensive_summary=comprehensive_summary,
        brief_summary=brief_summary,
        full_text_transcription=full_text,
        diagram_descriptions=diagrams,
        difficulty=difficulty,
        key_terms=context.get("key_terms", []),
        latency_ms=latency_ms,
        answer=context.get("answer"),
    )


@router.get("/health")
async def vision_health() -> dict:
    vision = get_gemini_vision()
    available = vision is not None and vision.available
    return {
        "available": available,
        "model": "gemini-2.5-flash" if available else None,
    }
