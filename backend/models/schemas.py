"""Pydantic models for the Legilimens data pipeline.

Every message that crosses the WebSocket or REST boundary has a schema here.
Keep the schema as the single source of truth — frontend types mirror these.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────

class SignalType(str, Enum):
    LOST = "lost"        # 🪄 "I'm lost"
    GOT_IT = "gotit"     # ✅ "Got it"
    SLOWER = "slower"    # ⏩ "Slower"


class InterestAvatar(str, Enum):
    """Student interest profile — used by Gemino (Gemini) for analogy tailoring."""
    CRICKETER = "cricketer"
    GAMER = "gamer"
    COOK = "cook"
    # Extend with more avatars as needed


# ─── Phase 2: Capture (Muffliato → FastAPI) ───────────────────────

class StudentPing(BaseModel):
    """A student's confusion/got-it signal, sent over WebSocket."""
    student_id: str = Field(..., max_length=64, pattern=r"^[a-zA-Z0-9_\-@\.]+$", description="Student identifier (anonymous for privacy)")
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    signal_type: SignalType
    lecture_id: int


# ─── Phase 1: Data foundation ────────────────────────────────────

class LectureChunk(BaseModel):
    """A ~15s segment of transcribed lecture, ready for embedding + upsert."""
    chunk_id: str = Field(..., max_length=128)
    lecture_id: int
    text: str = Field(..., max_length=10000)
    topic_node: str = Field(..., max_length=128)
    subtopic: str = Field(default="", max_length=256)
    difficulty: int = Field(default=3, ge=1, le=10)
    source: str = Field(default="lecture", max_length=32)  # "lecture" | "textbook"
    ts: float = 0.0                  # Start timestamp within the lecture (seconds)
    vector: Optional[list[float]] = None  # Populated after embedding


# ─── Phase 7: Analytics (Pensieve) ────────────────────────────────

class ConfusionEvent(BaseModel):
    """A row in Actian Vector `confusion_events` table."""
    event_id: int
    lecture_id: int
    student_id: str
    concept_node: str
    ts: datetime
    signal_type: SignalType
    cohort: str = "default"


class TopConfusingMoment(BaseModel):
    """Pensieve: one entry in the 'top-3 worst moments' report."""
    concept_node: str
    lost_count: int
    avg_density: float  # Rolling 60s confusion density at peak
    total_signals: int = 0


# ─── Phase 4-5: Retrieval + Generation ────────────────────────────

class AnalogyRequest(BaseModel):
    """Triggered when threshold is met. Retrieves + rewrites an analogy."""
    concept_node: str = Field(..., max_length=256)
    chunk_text: str = Field(default="", max_length=10000)
    student_ids: list[str] = Field(default_factory=list, max_length=500)
    avatar: InterestAvatar = InterestAvatar.CRICKETER


class RetrievalResult(BaseModel):
    """One hit from VectorAI DB similarity search."""
    text: str
    topic_node: str
    source: str
    score: float


class AnalogyResponse(BaseModel):
    """The complete analogy ready for Sonorus (ElevenLabs TTS) and student delivery."""
    concept_node: str
    original_text: str       # Best retrieved explanation
    analogy_text: str         # Gemini-rewritten analogy (or raw text on fallback)
    avatar: InterestAvatar
    latency_ms: dict          # {"embedding": X, "retrieval": Y, "gemini": Z, "elevenlabs": W}
    audio_url: Optional[str] = None  # TTS audio URL (None if ElevenLabs unavailable)

class RecordingChunk(BaseModel):
    chunk_id: str
    lecture_id: int
    start_ts: float
    end_ts: float
    transcript: str
    file_path: str
    indexed: bool = False
    created_at: datetime
