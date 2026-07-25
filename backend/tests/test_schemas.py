"""Tests for Pydantic schema validation."""
import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from models.schemas import (
    AnalogyRequest,
    AnalogyResponse,
    ConfusionEvent,
    InterestAvatar,
    LectureChunk,
    RetrievalResult,
    SignalType,
    StudentPing,
    TopConfusingMoment,
)


class TestSignalType:
    def test_valid_values(self):
        assert SignalType("lost") == SignalType.LOST
        assert SignalType("gotit") == SignalType.GOT_IT
        assert SignalType("slower") == SignalType.SLOWER

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            SignalType("invalid")


class TestInterestAvatar:
    def test_valid_values(self):
        assert InterestAvatar("cricketer") == InterestAvatar.CRICKETER
        assert InterestAvatar("gamer") == InterestAvatar.GAMER
        assert InterestAvatar("cook") == InterestAvatar.COOK

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            InterestAvatar("musician")


class TestStudentPing:
    def test_valid_ping(self):
        ping = StudentPing(
            student_id="student_123",
            signal_type=SignalType.LOST,
            lecture_id=1,
        )
        assert ping.student_id == "student_123"
        assert ping.signal_type == SignalType.LOST
        assert ping.lecture_id == 1
        assert isinstance(ping.ts, datetime)

    def test_auto_generates_timestamp(self):
        ping = StudentPing(
            student_id="s1",
            signal_type=SignalType.GOT_IT,
            lecture_id=1,
        )
        assert ping.ts is not None
        # Should be recent (within last few seconds)
        delta = datetime.now(timezone.utc) - ping.ts
        assert delta.total_seconds() < 5

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            StudentPing(signal_type=SignalType.LOST, lecture_id=1)  # missing student_id


class TestLectureChunk:
    def test_valid_chunk(self):
        chunk = LectureChunk(
            chunk_id="1_0",
            lecture_id=1,
            text="The chain rule multiplies gradients.",
            topic_node="chain_rule",
        )
        assert chunk.chunk_id == "1_0"
        assert chunk.topic_node == "chain_rule"
        assert chunk.difficulty == 3  # default
        assert chunk.source == "lecture"  # default
        assert chunk.vector is None  # not embedded yet

    def test_difficulty_bounds(self):
        with pytest.raises(ValidationError):
            LectureChunk(
                chunk_id="1", lecture_id=1, text="test",
                topic_node="t", difficulty=0,  # below min
            )
        with pytest.raises(ValidationError):
            LectureChunk(
                chunk_id="1", lecture_id=1, text="test",
                topic_node="t", difficulty=11,  # above max
            )


class TestAnalogyRequest:
    def test_valid_request(self):
        req = AnalogyRequest(
            concept_node="chain_rule",
            chunk_text="Gradients multiply layer by layer",
            student_ids=["s1", "s2"],
        )
        assert req.concept_node == "chain_rule"
        assert req.avatar == InterestAvatar.CRICKETER  # default

    def test_custom_avatar(self):
        req = AnalogyRequest(
            concept_node="loss",
            chunk_text="test",
            student_ids=["s1"],
            avatar=InterestAvatar.GAMER,
        )
        assert req.avatar == InterestAvatar.GAMER


class TestAnalogyResponse:
    def test_full_response(self):
        resp = AnalogyResponse(
            concept_node="chain_rule",
            original_text="Raw explanation",
            analogy_text="Like a relay race passing batons",
            avatar=InterestAvatar.CRICKETER,
            latency_ms={"embedding": 10, "retrieval": 38, "gemini": 800},
        )
        assert resp.audio_url is None  # default
        assert resp.latency_ms["retrieval"] == 38

    def test_response_with_audio(self):
        resp = AnalogyResponse(
            concept_node="test",
            original_text="orig",
            analogy_text="analogy",
            avatar=InterestAvatar.COOK,
            latency_ms={},
            audio_url="https://example.com/audio.mp3",
        )
        assert resp.audio_url == "https://example.com/audio.mp3"


class TestConfusionEvent:
    def test_valid_event(self):
        event = ConfusionEvent(
            event_id=12345,
            lecture_id=1,
            student_id="s1",
            concept_node="backprop",
            ts=datetime.now(timezone.utc),
            signal_type=SignalType.LOST,
        )
        assert event.cohort == "default"  # default


class TestTopConfusingMoment:
    def test_valid_moment(self):
        moment = TopConfusingMoment(
            concept_node="chain_rule",
            lost_count=5,
            total_signals=8,
            avg_density=0.625,
        )
        assert moment.lost_count == 5
