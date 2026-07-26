import logging
import os
import tempfile

logger = logging.getLogger(__name__)

try:
    from faster_whisper import WhisperModel
    _FASTER_WHISPER_AVAILABLE = True
except ImportError:
    WhisperModel = None  # type: ignore
    _FASTER_WHISPER_AVAILABLE = False
    logger.warning(
        "faster-whisper not installed — Whisper transcription will be unavailable. "
        "Install with: pip install faster-whisper"
    )

class WhisperService:
    def __init__(self):
        self._model = None
        self._available = False
        if not _FASTER_WHISPER_AVAILABLE:
            logger.warning("faster-whisper unavailable — WhisperService is a no-op")
            return
        try:
            self._model = WhisperModel("base.en", device="cpu", compute_type="int8")
            self._available = True
            logger.info("faster-whisper model base.en loaded successfully")
        except Exception as e:
            logger.error("Failed to load faster-whisper model: %s", e)

            
    @property
    def available(self) -> bool:
        return self._available

    def transcribe_file(self, audio_path: str) -> tuple[str, float]:
        """Transcribe a file, returns (full_transcript, duration_seconds)."""
        if not self._available:
            return "", 0.0
        
        segments, info = self._model.transcribe(audio_path, beam_size=5)
        full_text = " ".join([segment.text for segment in segments])
        return full_text, info.duration

    def transcribe_bytes(self, audio_bytes: bytes, language: str = "en") -> tuple[str, list[dict]]:
        """Transcribe audio bytes safely, returning (full_text, [{start, end, text}] segments)."""
        if not self._available or not audio_bytes:
            return "", []

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name

            segments_iter, info = self._model.transcribe(tmp_path, beam_size=5, language=language)
            segments = []
            full_text = []
            for s in segments_iter:
                segments.append({"start": s.start, "end": s.end, "text": s.text})
                full_text.append(s.text)

            return " ".join(full_text), segments
        except Exception as e:
            logger.error("Whisper transcription failed: %s", e)
            return "", []
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    def transcribe_stream_chunk(self, audio_bytes: bytes) -> str:
        """Transcribes a short chunk, returns just the text."""
        full_text, _ = self.transcribe_bytes(audio_bytes)
        return full_text

_whisper_service = WhisperService()

def get_whisper_service() -> WhisperService:
    return _whisper_service
