"""ElevenLabs client — voice re-delivery (Phase 6 / Sonorus).

Converts the Gemini-rewritten analogy into speech using a calm tutor voice
and returns the audio (streaming) for targeted delivery to lost students.
"""
from __future__ import annotations


class ElevenLabsClient:
    """Wrapper for ElevenLabs TTS API."""

    def __init__(self, api_key: str | None = None) -> None:
        # TODO Phase 6: Set up the ElevenLabs client with API key.
        #   from elevenlabs import ElevenLabs
        #   self.client = ElevenLabs(api_key=api_key or settings.elevenlabs_api_key)
        pass

    def text_to_speech(self, text: str) -> tuple[bytes, float]:
        """Convert text to speech audio bytes.

        Returns (audio_bytes, latency_ms).

        TODO Phase 6: Implement.
          1. Select a calm tutor voice (voice_id).
          2. Call ElevenLabs.generate(text=text, voice=voice_id).
          3. Return the audio bytes and latency.
          4. For demo: consider streaming directly to WebSocket.
        """
        return b"TODO Phase 6: ElevenLabs TTS audio", 0.0

    def get_audio_url(self, text: str) -> str:
        """Generate speech and return a temporary URL for the audio.

        Alternative to streaming bytes; useful if the frontend fetches audio
        via HTTP rather than WebSocket binary frames.
        """
        # TODO Phase 6: Implement or decide on streaming vs URL approach.
        return "TODO Phase 6: audio URL"
