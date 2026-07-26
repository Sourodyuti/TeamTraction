"""Recording service — full session recording with persistent storage.

Manages lecture recording sessions with audio chunk persistence and
manifest tracking. No time-based purge — keeps all chunks for the full
session so students can review anything they missed.
"""
import os
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from models.schemas import RecordingChunk

logger = logging.getLogger(__name__)

RECORDINGS_DIR = Path("recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)

# Maximum recording length as a safety cap (4 hours)
MAX_RECORDING_HOURS = 4


class SessionState:
    """Tracks the state of a recording session."""
    def __init__(self, lecture_id: int, started_at: datetime | None = None):
        self.lecture_id = lecture_id
        self.started_at = started_at or datetime.now(timezone.utc)
        self.is_active = True
        self.chunk_count = 0

    def to_dict(self) -> dict:
        elapsed = (datetime.now(timezone.utc) - self.started_at).total_seconds() if self.started_at else 0
        return {
            "lecture_id": self.lecture_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "is_active": self.is_active,
            "duration_seconds": round(elapsed, 1),
            "chunk_count": self.chunk_count,
        }


class RecordingService:
    def __init__(self):
        self.buffers_list: dict[int, list[RecordingChunk]] = {}
        self._sessions: dict[int, SessionState] = {}
        self._reload_from_disk()

    # ─── Session lifecycle ────────────────────────────────────────

    def start_session(self, lecture_id: int) -> dict:
        """Start a new recording session for a lecture."""
        lecture_dir = RECORDINGS_DIR / str(lecture_id)
        lecture_dir.mkdir(parents=True, exist_ok=True)

        session = SessionState(lecture_id)
        self._sessions[lecture_id] = session

        # Initialize buffer if needed
        if lecture_id not in self.buffers_list:
            self.buffers_list[lecture_id] = []

        # Write session metadata
        meta_path = lecture_dir / "session.json"
        with open(meta_path, "w") as f:
            json.dump(session.to_dict(), f, indent=2)

        logger.info("Recording session started: lecture=%d", lecture_id)
        return session.to_dict()

    def end_session(self, lecture_id: int) -> None:
        """End a recording session, finalize manifest."""
        session = self._sessions.get(lecture_id)
        if session:
            session.is_active = False

        # Write final manifest
        self._write_manifest(lecture_id)

        # Update session metadata
        lecture_dir = RECORDINGS_DIR / str(lecture_id)
        meta_path = lecture_dir / "session.json"
        if session:
            with open(meta_path, "w") as f:
                json.dump(session.to_dict(), f, indent=2)

        logger.info("Recording session ended: lecture=%d chunks=%d",
                     lecture_id, len(self.buffers_list.get(lecture_id, [])))

    def get_session_status(self, lecture_id: int) -> dict:
        """Get current session status."""
        session = self._sessions.get(lecture_id)
        if session:
            session.chunk_count = len(self.buffers_list.get(lecture_id, []))
            return session.to_dict()

        # Check disk for past sessions
        meta_path = RECORDINGS_DIR / str(lecture_id) / "session.json"
        if meta_path.exists():
            try:
                with open(meta_path, "r") as f:
                    return json.load(f)
            except Exception:
                pass

        return {
            "lecture_id": lecture_id,
            "started_at": None,
            "is_active": False,
            "duration_seconds": 0,
            "chunk_count": len(self.buffers_list.get(lecture_id, [])),
        }

    # ─── Chunk management ─────────────────────────────────────────

    def add_chunk(
        self,
        lecture_id: int,
        audio_bytes: bytes,
        start_ts: float,
        end_ts: float,
        transcript_text: str
    ) -> RecordingChunk:
        """Persist an audio chunk and add to the recording buffer.

        No time-based purge — all chunks are kept for the full session.
        """
        lecture_dir = RECORDINGS_DIR / str(lecture_id)
        lecture_dir.mkdir(parents=True, exist_ok=True)

        chunk_id = str(uuid.uuid4())
        file_path = lecture_dir / f"{start_ts}.webm"

        # Persist audio
        with open(file_path, "wb") as f:
            f.write(audio_bytes)

        chunk = RecordingChunk(
            chunk_id=chunk_id,
            lecture_id=lecture_id,
            start_ts=start_ts,
            end_ts=end_ts,
            transcript=transcript_text,
            file_path=str(file_path),
            created_at=datetime.now(timezone.utc)
        )

        if lecture_id not in self.buffers_list:
            self.buffers_list[lecture_id] = []

        self.buffers_list[lecture_id].append(chunk)

        # Update session chunk count
        session = self._sessions.get(lecture_id)
        if session:
            session.chunk_count = len(self.buffers_list[lecture_id])

        # Update manifest on disk
        self._write_manifest(lecture_id)

        # Call knowledge base to index
        try:
            from services.knowledge_base import get_knowledge_base
            kb = get_knowledge_base()
            kb.index_chunk(lecture_id, chunk_id, transcript_text, start_ts)
            chunk.indexed = True
        except Exception as e:
            logger.error("Failed to index chunk in KB: %s", e)

        return chunk

    def get_chunks_for_review(self, lecture_id: int, from_ts: float, to_ts: float) -> list[RecordingChunk]:
        """Get chunks within a time range for student review."""
        if lecture_id not in self.buffers_list:
            return []
        return [c for c in self.buffers_list[lecture_id] if c.start_ts >= from_ts and c.end_ts <= to_ts]

    def get_full_manifest(self, lecture_id: int) -> list[dict]:
        """Read the full manifest from disk (survives restarts)."""
        manifest_path = RECORDINGS_DIR / str(lecture_id) / "manifest.json"
        if not manifest_path.exists():
            # Fall back to in-memory buffer
            if lecture_id in self.buffers_list:
                return [c.model_dump(mode="json") for c in self.buffers_list[lecture_id]]
            return []
        try:
            with open(manifest_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Failed to read manifest for lecture %d: %s", lecture_id, e)
            return []

    # ─── Internal helpers ─────────────────────────────────────────

    def _write_manifest(self, lecture_id: int) -> None:
        """Write current manifest to disk."""
        lecture_dir = RECORDINGS_DIR / str(lecture_id)
        lecture_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = lecture_dir / "manifest.json"
        manifest_data = [c.model_dump(mode="json") for c in self.buffers_list.get(lecture_id, [])]
        with open(manifest_path, "w") as f:
            json.dump(manifest_data, f, indent=2)

    def _reload_from_disk(self) -> None:
        """Scan recordings/ for existing manifests and rebuild in-memory state.

        Called on startup so recording data survives server restarts.
        """
        if not RECORDINGS_DIR.exists():
            return

        loaded = 0
        for lecture_dir in RECORDINGS_DIR.iterdir():
            if not lecture_dir.is_dir():
                continue
            try:
                lecture_id = int(lecture_dir.name)
            except ValueError:
                continue

            # Load manifest
            manifest_path = lecture_dir / "manifest.json"
            if manifest_path.exists():
                try:
                    with open(manifest_path, "r") as f:
                        manifest_data = json.load(f)
                    chunks = []
                    for item in manifest_data:
                        try:
                            chunks.append(RecordingChunk(**item))
                        except Exception:
                            continue
                    if chunks:
                        self.buffers_list[lecture_id] = chunks
                        loaded += 1
                except Exception as e:
                    logger.warning("Failed to load manifest for lecture %d: %s", lecture_id, e)

            # Load session state
            session_path = lecture_dir / "session.json"
            if session_path.exists():
                try:
                    with open(session_path, "r") as f:
                        session_data = json.load(f)
                    if not session_data.get("is_active", False):
                        # Session was properly ended, just record it
                        pass
                    else:
                        # Session was active when server stopped — mark it inactive
                        session_data["is_active"] = False
                        with open(session_path, "w") as f:
                            json.dump(session_data, f, indent=2)
                except Exception:
                    pass

        if loaded:
            logger.info("RecordingService reloaded %d lecture(s) from disk", loaded)


recording_service = RecordingService()

def get_recording_service() -> RecordingService:
    return recording_service
