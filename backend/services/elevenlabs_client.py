"""ElevenLabs client — voice re-delivery (Phase 6 / Sonorus).

Converts the Gemini-rewritten analogy into speech using a calm tutor voice
and returns the audio bytes for targeted delivery to lost students.

Gracefully degrades when the API key is not set or calls fail.
"""
from __future__ import annotations

import logging
import time

from config import settings

logger = logging.getLogger(__name__)

# Default calm tutor voice — Rachel is warm/clear, good for explanations.
# Override via ELEVENLABS_VOICE_ID env var if needed.
_DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel
_DEFAULT_MODEL_ID = "eleven_flash_v2_5"


class ElevenLabsClient:
    """Wrapper for ElevenLabs TTS API."""

    def __init__(self, api_key: str | None = None) -> None:
        self._client = None
        self._api_key = api_key or settings.elevenlabs_api_key
        self._voice_id = _DEFAULT_VOICE_ID

        if self._api_key:
            try:
                from elevenlabs import ElevenLabs

                self._client = ElevenLabs(api_key=self._api_key)
                logger.info("ElevenLabs client initialized (voice=%s)", self._voice_id)
            except Exception:
                logger.exception("Failed to initialize ElevenLabs client")
                self._client = None
        else:
            logger.warning(
                "ELEVENLABS_API_KEY not set — Sonorus will return empty audio"
            )

    @property
    def available(self) -> bool:
        """True if the ElevenLabs client is initialized and ready."""
        return self._client is not None

    def text_to_speech(self, text: str) -> tuple[bytes, float]:
        """Convert text to speech audio bytes (MP3).

        Returns (audio_bytes, latency_ms).

        On any error or missing API key, returns (b"", 0.0) — never crashes.
        """
        if not self.available:
            logger.warning("ElevenLabs unavailable — returning empty audio")
            return b"", 0.0

        if not text or not text.strip():
            return b"", 0.0

        try:
            start = time.perf_counter()

            # generate() returns an iterator of audio chunks
            audio_iterator = self._client.text_to_speech.convert(
                voice_id=self._voice_id,
                text=text,
                model_id=_DEFAULT_MODEL_ID,
            )

            # Collect all chunks into a single bytes object
            audio_bytes = b"".join(chunk for chunk in audio_iterator)

            elapsed_ms = (time.perf_counter() - start) * 1000

            logger.info(
                "Sonorus TTS generated (%d bytes, %.0fms)",
                len(audio_bytes),
                elapsed_ms,
            )
            return audio_bytes, elapsed_ms

        except Exception as e:
            logger.error("ElevenLabs TTS failed: %s — returning empty audio", e)
            return b"", 0.0
