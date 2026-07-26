"""Vision router — screen frame analysis via Gemini Vision.

Accepts base64-encoded screen frames, analyzes them with Gemini Vision
to extract lecture context (topic, slide text, difficulty, key terms).

POST /vision/analyze-frame        — analyze only, return JSON (original)
POST /vision/analyze-and-index    — analyze + index into VectorAI DB (new)
"""
from __future__ import annotations

import base64
import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.gemini_vision import get_gemini_vision

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vision", tags=["vision"])


class FrameAnalysisRequest(BaseModel):
    image: str
    mime_type: str = "image/png"


class FrameAnalysisResponse(BaseModel):
    topic_node: str
    slide_text_summary: str
    difficulty: int
    key_terms: list[str]
    latency_ms: float


class FrameIndexRequest(BaseModel):
    """Analyze a frame AND index its text content into VectorAI DB."""
    image: str
    mime_type: str = "image/png"
    lecture_id: int = 1
    ts: Optional[float] = None          # seconds since lecture start; None = wall-clock


class FrameIndexResponse(BaseModel):
    topic_node: str
    slide_text_summary: str
    difficulty: int
    key_terms: list[str]
    latency_ms: float
    chunk_id: Optional[str] = None
    indexed: bool = False
    index_skipped_reason: Optional[str] = None


@router.post("/analyze-frame", response_model=FrameAnalysisResponse)
async def analyze_frame(req: FrameAnalysisRequest) -> FrameAnalysisResponse:
    vision = get_gemini_vision()
    if not vision or not vision.available:
        raise HTTPException(status_code=503, detail="Gemini Vision not available")

    try:
        image_bytes = base64.b64decode(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    context, latency_ms = vision.analyze_frame(image_bytes, req.mime_type)

    return FrameAnalysisResponse(
        topic_node=context.get("topic_node", "unknown"),
        slide_text_summary=context.get("slide_text_summary", ""),
        difficulty=context.get("difficulty", 5),
        key_terms=context.get("key_terms", []),
        latency_ms=latency_ms,
    )


@router.post("/analyze-and-index", response_model=FrameIndexResponse)
async def analyze_and_index(req: FrameIndexRequest) -> FrameIndexResponse:
    """Analyze a screen frame with Gemini Vision and index the result into VectorAI DB.

    The chunk text stored in the DB is:
        "[topic_node] {slide_text_summary}. Key terms: {key_terms joined}"

    This gives the retrieval pipeline rich semantic context from the slide
    so confusion signals can be matched against what was on screen.

    Skips indexing (but still returns analysis) if:
    - topic_node == "unknown"  (Gemini couldn't parse the slide)
    - slide_text_summary is empty
    """
    vision = get_gemini_vision()
    if not vision or not vision.available:
        raise HTTPException(status_code=503, detail="Gemini Vision not available")

    try:
        image_bytes = base64.b64decode(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    # 1. Analyze the frame
    context, latency_ms = vision.analyze_frame(image_bytes, req.mime_type)

    topic_node = context.get("topic_node", "unknown")
    slide_text = context.get("slide_text_summary", "").strip()
    difficulty = context.get("difficulty", 5)
    key_terms: list[str] = context.get("key_terms", [])

    # 2. Build rich chunk text
    chunk_text_parts = []
    if slide_text:
        chunk_text_parts.append(slide_text)
    if key_terms:
        chunk_text_parts.append("Key terms: " + ", ".join(key_terms))
    chunk_text = f"[{topic_node}] " + ". ".join(chunk_text_parts) if chunk_text_parts else ""

    # 3. Skip indexing if nothing useful was detected
    if topic_node == "unknown" or not chunk_text.strip():
        logger.info("Vision frame skipped indexing: topic=unknown or empty text (lecture=%d)", req.lecture_id)
        return FrameIndexResponse(
            topic_node=topic_node,
            slide_text_summary=slide_text,
            difficulty=difficulty,
            key_terms=key_terms,
            latency_ms=latency_ms,
            indexed=False,
            index_skipped_reason="topic_node=unknown or slide_text empty — nothing useful to index",
        )

    # 4. Index into VectorAI DB via KnowledgeBase
    ts = req.ts if req.ts is not None else time.time()
    import uuid
    chunk_id = f"{req.lecture_id}_vision_{int(ts * 1000)}_{uuid.uuid4().hex[:8]}"

    chunk_indexed = False
    try:
        from services.knowledge_base import get_knowledge_base
        kb = get_knowledge_base()
        chunk_indexed = kb.index_chunk(
            lecture_id=req.lecture_id,
            chunk_id=chunk_id,
            text=chunk_text,
            ts=ts,
            topic_node=topic_node,
            difficulty=difficulty,
        )
        if chunk_indexed:
            logger.info(
                "Vision frame indexed: lecture=%d topic=%s chunk=%s (%.0fms)",
                req.lecture_id, topic_node, chunk_id, latency_ms,
            )
        else:
            logger.warning(
                "Vision frame NOT indexed to VectorAI DB: lecture=%d topic=%s — "
                "check knowledge_base logs.",
                req.lecture_id, topic_node,
            )
    except Exception:
        logger.exception("Unexpected error indexing vision frame chunk '%s'", chunk_id)

    return FrameIndexResponse(
        topic_node=topic_node,
        slide_text_summary=slide_text,
        difficulty=difficulty,
        key_terms=key_terms,
        latency_ms=latency_ms,
        chunk_id=chunk_id if chunk_indexed else None,
        indexed=chunk_indexed,
    )


@router.get("/health")
async def vision_health() -> dict:
    vision = get_gemini_vision()
    available = vision is not None and vision.available
    return {
        "available": available,
        "model": "gemini-2.5-flash" if available else None,
    }

