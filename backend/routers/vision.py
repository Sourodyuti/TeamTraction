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


class FrameAnalysisResponse(BaseModel):
    topic_node: str
    slide_text_summary: str
    difficulty: int
    key_terms: list[str]
    latency_ms: float


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


@router.get("/health")
async def vision_health() -> dict:
    vision = get_gemini_vision()
    available = vision is not None and vision.available
    return {
        "available": available,
        "model": "gemini-2.5-flash" if available else None,
    }
