"""Whisper service — local ASR integration (stretch goal, Phase 1+).

Interfaces with whisper.cpp for near-real-time transcription of lecture audio.
The core demo uses a pre-recorded, pre-transcribed lecture, so this is a stretch —
not a critical dependency.

If whisper.cpp isn't available, all methods gracefully degrade to stubs.
"""
from __future__ import annotations


class WhisperService:
    """Interface to whisper.cpp for local ASR."""

    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path
        self._available = False
        self._try_load()

    def _try_load(self) -> None:
        """Attempt to load the whisper.cpp model. Gracefully no-op if unavailable."""
        try:
            # TODO: Load whisper.cpp bindings or subprocess interface.
            #   This is a stretch goal — don't block Phase 0 on this.
            self._available = False
        except Exception:
            self._available = False

    @property
    def available(self) -> bool:
        return self._available

    def transcribe_file(self, audio_path: str) -> str:
        """Transcribe an audio file, return full transcript text.

        TODO: Implement using whisper.cpp subprocess or bindings.
        """
        if not self._available:
            raise RuntimeError("Whisper model not loaded — this is a stretch goal")
        return "TODO: transcribe"

    def transcribe_stream_chunk(self, audio_chunk: bytes, language: str = "en") -> str:
        """Transcribe a short audio chunk (~15s) for real-time ingestion.

        TODO: Implement streaming transcription.
        """
        if not self._available:
            raise RuntimeError("Whisper model not loaded — this is a stretch goal")
        return "TODO: stream transcribe"
