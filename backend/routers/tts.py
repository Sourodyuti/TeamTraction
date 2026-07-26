"""TTS router — Sonorus voice delivery with graceful fallback.

Provides a unified /tts/speak endpoint that:
1. Tries ElevenLabs TTS first
2. Falls back to instructing the frontend to use Web Speech API
"""
from __future__ import annotations

import base64
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["tts"])


class SpeakRequest(BaseModel):
    text: str = Field(..., description="Text to convert to speech")
    voice_id: str | None = Field(default=None, description="Optional ElevenLabs voice ID")


class SpeakResponse(BaseModel):
    text: str
    audio_base64: str | None = None
    mime: str = "audio/mpeg"
    use_browser_tts: bool = False
    source: str = "elevenlabs"


@router.post("/speak", response_model=SpeakResponse)
async def speak(req: SpeakRequest) -> SpeakResponse:
    """Convert text to speech. Falls back to browser TTS if ElevenLabs unavailable."""
    if not req.text.strip():
        return SpeakResponse(text=req.text, use_browser_tts=True, source="empty")

    # Try ElevenLabs first
    try:
        from services.elevenlabs_client import ElevenLabsClient
        tts = ElevenLabsClient()
        if tts.available:
            audio_bytes, latency_ms = tts.text_to_speech(req.text)
            if audio_bytes:
                encoded = base64.b64encode(audio_bytes).decode("utf-8")
                logger.info("TTS via ElevenLabs: %d bytes, %.0fms", len(audio_bytes), latency_ms)
                return SpeakResponse(
                    text=req.text,
                    audio_base64=encoded,
                    mime="audio/mpeg",
                    use_browser_tts=False,
                    source="elevenlabs",
                )
    except Exception as e:
        logger.warning("ElevenLabs TTS failed: %s", e)

    # Fallback: tell frontend to use Web Speech API
    logger.info("TTS fallback to browser Speech API for: %s...", req.text[:50])
    return SpeakResponse(
        text=req.text,
        use_browser_tts=True,
        source="browser",
    )


@router.get("/health")
async def tts_health() -> dict:
    """Check TTS availability."""
    elevenlabs_ok = False
    try:
        from services.elevenlabs_client import ElevenLabsClient
        tts = ElevenLabsClient()
        elevenlabs_ok = tts.available
    except Exception:
        pass

    return {
        "elevenlabs": elevenlabs_ok,
        "browser_fallback": True,
        "ready": True,  # always ready since we have browser fallback
    }
