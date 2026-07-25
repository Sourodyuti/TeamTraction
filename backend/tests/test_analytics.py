"""Tests for the analytics router — mock DB, real SQL logic."""
import pytest
from unittest.mock import MagicMock, patch

from routers.analytics import (
    top_confusing_moments,
    confusion_density,
    lecture_summary,
    _execute_query,
)


# ─── Helper: mock _execute_query ──────────────────────────────────

def _mock_rows(rows):
    """Patch _execute_query to return the given rows."""
    return patch("routers.analytics._execute_query", return_value=rows)


class TestTopConfusingMoments:
    @pytest.mark.asyncio
    async def test_returns_sorted_by_lost_count(self):
        """Results should be sorted by lost_count descending."""
        rows = [
            ("activation", 2, 5),
            ("chain_rule", 7, 10),
            ("loss", 4, 8),
        ]
        with _mock_rows(rows):
            # Patch the density sub-query
            with patch("routers.analytics._execute_query", return_value=rows):
                result = await top_confusing_moments(lecture_id=1)

        # Should be sorted by lost_count desc: chain_rule(7), loss(4), activation(2)
        assert result[0].concept_node == "chain_rule"
        assert result[0].lost_count == 7
        assert result[1].concept_node == "loss"

    @pytest.mark.asyncio
    async def test_empty_lecture_returns_empty(self):
        with patch("routers.analytics._execute_query", return_value=[]):
            result = await top_confusing_moments(lecture_id=99)

        assert result == []

    @pytest.mark.asyncio
    async def test_respects_limit(self):
        rows = [
            ("a", 5, 8),
            ("b", 4, 7),
            ("c", 3, 6),
            ("d", 2, 5),
        ]
        # First call returns rows, second call (density) returns densities
        def side_effect(*args, **kwargs):
            if "GROUP BY concept_node" in str(args[0]):
                return rows
            return [(0.5,)] * len(rows)

        with patch("routers.analytics._execute_query", side_effect=side_effect):
            result = await top_confusing_moments(lecture_id=1, limit=2)

        assert len(result) == 2


class TestConfusionDensity:
    @pytest.mark.asyncio
    async def test_returns_timeline(self):
        from datetime import datetime, timezone
        ts = datetime.now(timezone.utc)

        rows = [(ts, 0.1), (ts, 0.3), (ts, 0.8)]
        with _mock_rows(rows):
            result = await confusion_density(lecture_id=1)

        assert len(result) == 3
        assert result[0]["density"] == 0.1

    @pytest.mark.asyncio
    async def test_handles_zero_density(self):
        from datetime import datetime, timezone
        ts = datetime.now(timezone.utc)

        rows = [(ts, 0.0), (ts, 0.0)]
        with _mock_rows(rows):
            result = await confusion_density(lecture_id=1)

        for point in result:
            assert point["density"] == 0.0


class TestLectureSummary:
    @pytest.mark.asyncio
    async def test_full_summary(self):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        rows = [(100, 40, 35, 25, 15, 8, now, now)]
        with _mock_rows(rows):
            result = await lecture_summary(lecture_id=1)

        assert result["total_signals"] == 100
        assert result["lost_count"] == 40
        assert result["unique_students"] == 15
        assert result["confusion_rate"] == 0.4

    @pytest.mark.asyncio
    async def test_empty_lecture(self):
        with patch("routers.analytics._execute_query", return_value=[(0, None, None, None, None, None, None, None)]):
            result = await lecture_summary(lecture_id=99)

        assert result["total_signals"] == 0
        assert result["confusion_rate"] == 0.0
