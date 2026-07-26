import os
import json
import logging
import uuid
from datetime import datetime, timezone
from collections import deque
from pathlib import Path

from models.schemas import RecordingChunk

logger = logging.getLogger(__name__)

RECORDINGS_DIR = Path("recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)

class RecordingService:
    def __init__(self):
        self.buffers: dict[int, deque[RecordingChunk]] = {}
        # Assuming ~5 second chunks, 300s = 60 chunks. We'll just keep a deque with maxlen 100 for safety, or purge by time.
        # But we'll just use a list for simplicity and purge older than 300s.
        self.buffers_list: dict[int, list[RecordingChunk]] = {}

    def add_chunk(
        self,
        lecture_id: int,
        audio_bytes: bytes,
        start_ts: float,
        end_ts: float,
        transcript_text: str
    ) -> RecordingChunk:
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
            
        buf = self.buffers_list[lecture_id]
        buf.append(chunk)
        
        # Purge older than 5 minutes (300 seconds)
        latest_ts = buf[-1].end_ts
        self.buffers_list[lecture_id] = [c for c in buf if (latest_ts - c.start_ts) <= 300.0]
        
        # Update manifest
        manifest_path = lecture_dir / "manifest.json"
        manifest_data = [c.model_dump(mode="json") for c in self.buffers_list[lecture_id]]
        with open(manifest_path, "w") as f:
            json.dump(manifest_data, f, indent=2)
            
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
        if lecture_id not in self.buffers_list:
            return []
        return [c for c in self.buffers_list[lecture_id] if c.start_ts >= from_ts and c.end_ts <= to_ts]

recording_service = RecordingService()

def get_recording_service() -> RecordingService:
    return recording_service
