"""Tests for VectorAnalyticsClient (Actian Vector SQL layer)."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch, call

import pytest

from models.schemas import ConfusionEvent, SignalType


def _make_event(**kwargs) -> ConfusionEvent:
    defaults = dict(
        event_id=1001,
        lecture_id=1,
        student_id="s1",
        concept_node="chain_rule",
        ts=datetime(2026, 7, 25, 10, 0, 0),
        signal_type=SignalType.LOST,
        cohort="default",
    )
    defaults.update(kwargs)
    return ConfusionEvent(**defaults)


class TestVectorAnalyticsClient:
    """Test the VectorAnalyticsClient SQL wrapper."""

    def _make_client(self):
        from services.vector_client import VectorAnalyticsClient
        return VectorAnalyticsClient()

    def test_insert_confusion_event_calls_execute(self):
        """insert_confusion_event should call cursor.execute with correct params."""
        client = self._make_client()
        event = _make_event()

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = lambda s: mock_conn
        mock_conn.__exit__ = MagicMock(return_value=False)

        with patch("services.vector_client.get_vector_connection", return_value=mock_conn):
            client.insert_confusion_event(event)

        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args
        params = call_args[0][1]
        assert params[0] == event.event_id
        assert params[1] == event.lecture_id
        assert params[5] == event.signal_type.value

    def test_insert_batch_uses_executemany(self):
        """insert_confusion_events_batch should call executemany."""
        client = self._make_client()
        events = [_make_event(event_id=i) for i in range(1, 4)]

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = lambda s: mock_conn
        mock_conn.__exit__ = MagicMock(return_value=False)

        with patch("services.vector_client.get_vector_connection", return_value=mock_conn):
            client.insert_confusion_events_batch(events)

        mock_cursor.executemany.assert_called_once()
        rows = mock_cursor.executemany.call_args[0][1]
        assert len(rows) == 3

    def test_insert_batch_empty_is_noop(self):
        """Empty batch should not call any SQL."""
        client = self._make_client()

        with patch("services.vector_client.get_vector_connection") as mock_ctx:
            client.insert_confusion_events_batch([])
            mock_ctx.assert_not_called()

    def test_get_top_confusing_moments_sql(self):
        """get_top_confusing_moments should return parsed dicts."""
        client = self._make_client()

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            ("chain_rule", 5, 8),
            ("backprop", 2, 4),
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = lambda s: mock_conn
        mock_conn.__exit__ = MagicMock(return_value=False)

        with patch("services.vector_client.get_vector_connection", return_value=mock_conn):
            results = client.get_top_confusing_moments(lecture_id=1, limit=2)

        assert len(results) == 2
        assert results[0]["concept_node"] == "chain_rule"
        assert results[0]["lost_count"] == 5
        assert results[0]["total_signals"] == 8
        assert 0.0 <= results[0]["avg_density"] <= 1.0

    def test_get_confusion_density_timeline_sql(self):
        """get_confusion_density_timeline should return {ts, density} dicts."""
        client = self._make_client()

        mock_ts = datetime(2026, 7, 25, 10, 2, 0)
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            (mock_ts, 0.5),
            (mock_ts, 0.75),
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = lambda s: mock_conn
        mock_conn.__exit__ = MagicMock(return_value=False)

        with patch("services.vector_client.get_vector_connection", return_value=mock_conn):
            results = client.get_confusion_density_timeline(lecture_id=1)

        assert len(results) == 2
        assert "ts" in results[0]
        assert "density" in results[0]
        assert isinstance(results[0]["density"], float)

    def test_health_returns_true_when_connected(self):
        """health() should return True when Actian Vector responds to SELECT 1."""
        client = self._make_client()

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = lambda s: mock_conn
        mock_conn.__exit__ = MagicMock(return_value=False)

        with patch("services.vector_client.get_vector_connection", return_value=mock_conn):
            assert client.health() is True

    def test_health_returns_false_on_exception(self):
        """health() should return False when the DB is unreachable."""
        client = self._make_client()

        with patch("services.vector_client.get_vector_connection", side_effect=Exception("ODBC timeout")):
            assert client.health() is False
