"""Tests for the WebSocket hub — ConnectionManager, ThresholdTracker, OfflineQueue."""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from routers.websocket import (
    ConnectionManager,
    ThresholdTracker,
    OfflineQueue,
    manager,
    threshold_tracker,
    offline_queue,
)


class TestConnectionManager:
    def test_connect_adds_connection(self):
        """Connecting a student adds them to the lecture pool."""
        mgr = ConnectionManager()
        ws = MagicMock()
        mgr.connect(1, "student_1", ws)

        assert "student_1" in mgr._connections[1]
        assert len(mgr.get_online_students(1)) == 1

    def test_connect_multiple_students(self):
        mgr = ConnectionManager()
        mgr.connect(1, "s1", MagicMock())
        mgr.connect(1, "s2", MagicMock())
        mgr.connect(2, "s3", MagicMock())  # Different lecture

        assert len(mgr.get_online_students(1)) == 2
        assert len(mgr.get_online_students(2)) == 1

    def test_disconnect_removes_student(self):
        mgr = ConnectionManager()
        ws = MagicMock()
        mgr.connect(1, "s1", ws)
        mgr.disconnect(1, "s1")

        assert "s1" not in mgr._connections.get(1, {})
        assert len(mgr.get_online_students(1)) == 0

    def test_disconnect_cleans_empty_lecture(self):
        mgr = ConnectionManager()
        mgr.connect(1, "s1", MagicMock())
        mgr.disconnect(1, "s1")

        # Lecture key should be removed when empty
        assert 1 not in mgr._connections

    def test_get_online_students_isolation(self):
        """Lectures are isolated — students in one don't appear in another."""
        mgr = ConnectionManager()
        mgr.connect(1, "s1", MagicMock())
        mgr.connect(2, "s2", MagicMock())

        assert "s2" not in mgr.get_online_students(1)
        assert "s1" not in mgr.get_online_students(2)

    @pytest.mark.asyncio
    async def test_broadcast_to_empty_lecture(self):
        """Broadcasting to an empty lecture doesn't error."""
        mgr = ConnectionManager()
        # No connections for lecture 999
        await mgr.broadcast_to_lecture(999, {"type": "test"})  # Should not raise

    @pytest.mark.asyncio
    async def test_send_to_student_delivers(self):
        mgr = ConnectionManager()
        ws = AsyncMock()
        ws.send_text = AsyncMock()
        mgr.connect(1, "s1", ws)

        delivered = await mgr.send_to_student(1, "s1", {"type": "test"})
        assert delivered is True
        ws.send_text.assert_called_once()
        sent_data = json.loads(ws.send_text.call_args[0][0])
        assert sent_data["type"] == "test"

    @pytest.mark.asyncio
    async def test_send_to_missing_student_returns_false(self):
        mgr = ConnectionManager()
        delivered = await mgr.send_to_student(1, "nonexistent", {"type": "test"})
        assert delivered is False

    @pytest.mark.asyncio
    async def test_send_to_student_drops_dead_connection(self):
        mgr = ConnectionManager()
        ws = AsyncMock()
        ws.send_text = AsyncMock(side_effect=RuntimeError("Connection closed"))
        mgr.connect(1, "s1", ws)

        delivered = await mgr.send_to_student(1, "s1", {"type": "test"})
        assert delivered is False
        assert "s1" not in mgr._connections.get(1, {})


class TestThresholdTracker:
    def _make_tracker(self, threshold=2, window=20.0, cooldown=45.0):
        return ThresholdTracker(
            threshold=threshold,
            window_seconds=window,
            cooldown_seconds=cooldown,
        )

    def test_single_lost_does_not_fire(self):
        """One student lost doesn't cross threshold."""
        tt = self._make_tracker(threshold=2)
        fired = tt.record_lost(1, "chain_rule", "s1")
        assert fired is False

    def test_two_unique_students_fire(self):
        """Two unique students lost on same node in window → fires."""
        tt = self._make_tracker(threshold=2)
        tt.record_lost(1, "chain_rule", "s1")
        fired = tt.record_lost(1, "chain_rule", "s2")
        assert fired is True

    def test_same_student_does_not_fire(self):
        """Same student pressing twice doesn't fire (need unique students)."""
        tt = self._make_tracker(threshold=2)
        tt.record_lost(1, "chain_rule", "s1")
        fired = tt.record_lost(1, "chain_rule", "s1")
        assert fired is False

    def test_different_nodes_dont_cross(self):
        """Losses on different concept nodes are tracked independently."""
        tt = self._make_tracker(threshold=2)
        tt.record_lost(1, "chain_rule", "s1")
        tt.record_lost(1, "loss_func", "s2")
        assert tt.record_lost(1, "loss_func", "s3") is True
        assert tt.record_lost(1, "chain_rule", "s3") is True  # Now 2 unique on chain_rule

    def test_cooldown_prevents_refire(self):
        """After firing, same node can't re-fire within cooldown."""
        tt = self._make_tracker(threshold=2, cooldown=999.0)  # Very long cooldown
        tt.record_lost(1, "chain_rule", "s1")
        tt.record_lost(1, "chain_rule", "s2")  # Fires

        # Rapidly add more students — should not fire due to cooldown
        fired_again = tt.record_lost(1, "chain_rule", "s3")
        assert fired_again is False

    def test_reset_lecture(self):
        """Reset clears all tracking for a lecture."""
        tt = self._make_tracker(threshold=2)
        tt.record_lost(1, "chain_rule", "s1")
        tt.reset_lecture(1)

        # After reset, need 2 new pings to fire again
        assert tt.record_lost(1, "chain_rule", "s2") is False
        assert tt.record_lost(1, "chain_rule", "s3") is True

    def test_window_pruning(self):
        """Old pings outside the window are pruned."""
        import time
        tt = self._make_tracker(threshold=2, window=0.1)  # 100ms window
        tt.record_lost(1, "chain_rule", "s1")

        # Wait for window to expire
        time.sleep(0.15)

        # s2 alone shouldn't fire because s1 was pruned
        fired = tt.record_lost(1, "chain_rule", "s2")
        assert fired is False


class TestOfflineQueue:
    @pytest.mark.asyncio
    async def test_enqueue_and_flush(self):
        q = OfflineQueue()
        await q.enqueue({"student_id": "s1"})
        await q.enqueue({"student_id": "s2"})

        assert q.pending == 2
        items = await q.flush()
        assert len(items) == 2
        assert items[0]["student_id"] == "s1"
        assert q.pending == 0

    @pytest.mark.asyncio
    async def test_flush_empty_returns_empty(self):
        q = OfflineQueue()
        items = await q.flush()
        assert items == []

    @pytest.mark.asyncio
    async def test_pending_count(self):
        q = OfflineQueue()
        assert q.pending == 0
        await q.enqueue({"a": 1})
        assert q.pending == 1
