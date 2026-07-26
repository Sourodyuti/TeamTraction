"""Tests for the analytics router — mock DB, real SQL logic."""
import pytest
from unittest.mock import patch

from routers.analytics import (
    top_confusing_moments,
    confusion_density,
    lecture_summary,
)


def _mock_rows(rows):
    """Patch _execute_query to return the given rows."""
    return patch("routers.analytics._execute_query", return_value=rows)


class TestTopConfusingMoments:
    @pytest.mark.asyncio
    async def test_returns_sorted_by_lost_count(self):
        rows = [
            ("chain_rule", 7, 10),
            ("loss", 4, 8),
            ("activation", 2, 5),
        ]
        def side_effect(sql, params=()):
            if "AVG" in sql:
                return [(0.5,)]
            return rows
        with patch("routers.analytics._execute_query", side_effect=side_effect):
            result = await top_confusing_moments(lecture_id=1)

        assert result[0].concept_node == "chain_rule"
        assert result[0].lost_count == 7
        assert result[0].total_signals == 10
        assert result[0].avg_density == 0.5
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
        def side_effect(*args, **kwargs):
            if "GROUP BY concept_node" in str(args[0]):
                return rows
            return [(0.5,)] * len(rows)

        with patch("routers.analytics._execute_query", side_effect=side_effect):
            result = await top_confusing_moments(lecture_id=1, limit=2)

        assert len(result) == 2
        assert all(isinstance(m.avg_density, float) for m in result)


class TestConfusionDensity:
    @pytest.mark.asyncio
    async def test_returns_timeline(self):
        from datetime import datetime, timezone
        ts = datetime.now(timezone.utc)

        rows = [(ts, "lost"), (ts, "gotit"), (ts, "lost")]
        with _mock_rows(rows):
            result = await confusion_density(lecture_id=1)

        assert len(result["data"]) == 3
        assert result["data"][0]["type"] == "lost"

    @pytest.mark.asyncio
    async def test_handles_empty(self):
        with _mock_rows([]):
            result = await confusion_density(lecture_id=99)

        assert result["data"] == []


class TestLectureSummary:
    @pytest.mark.asyncio
    async def test_full_summary(self):
        rows = [(100, 40, 35)]
        with _mock_rows(rows):
            result = await lecture_summary(lecture_id=1)

        assert result["total"] == 100
        assert result["lost"] == 40
        assert result["gotit"] == 35

    @pytest.mark.asyncio
    async def test_empty_lecture(self):
        with patch("routers.analytics._execute_query", return_value=[]):
            result = await lecture_summary(lecture_id=99)

        assert result["total"] == 0
        assert result["lost"] == 0
        assert result["gotit"] == 0
