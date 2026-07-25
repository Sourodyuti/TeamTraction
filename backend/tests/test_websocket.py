"""Tests for the WebSocket ping handler (Phase 2)."""
from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import pytest


class TestThresholdLogic:
    """Unit-test the threshold helpers without a live WebSocket."""

    def setup_method(self):
        """Reset module-level state between tests."""
        from routers import websocket as ws_module
        ws_module._lost_window.clear()
        ws_module._last_accio.clear()

    def test_record_lost_adds_to_window(self):
        """_record_lost should add an entry to the sliding window."""
        from routers.websocket import _record_lost, _lost_window

        _record_lost(1, "chain_rule")
        assert len(_lost_window[1]) == 1

    def test_threshold_not_met_below_count(self):
        """_should_trigger_accio returns False when count < threshold."""
        from routers.websocket import _record_lost, _should_trigger_accio

        _record_lost(2, "backprop")  # Only 1 — below threshold of 2
        assert not _should_trigger_accio(2, "backprop")

    def test_threshold_met(self):
        """_should_trigger_accio returns True when ≥2 lost signals in window."""
        from routers.websocket import _record_lost, _should_trigger_accio

        _record_lost(3, "chain_rule")
        _record_lost(3, "chain_rule")
        assert _should_trigger_accio(3, "chain_rule")

    def test_threshold_cooldown_prevents_double_trigger(self):
        """After triggering, the same concept should not trigger again within cooldown."""
        from routers.websocket import _record_lost, _should_trigger_accio, _last_accio

        _record_lost(4, "loss")
        _record_lost(4, "loss")
        first = _should_trigger_accio(4, "loss")   # Should trigger
        second = _should_trigger_accio(4, "loss")  # Cooldown — should NOT trigger
        assert first is True
        assert second is False

    def test_window_evicts_old_signals(self):
        """Signals older than 20s should be evicted."""
        from routers import websocket as ws_module

        now = time.monotonic()
        ws_module._lost_window[5].append((now - 25.0, "vanishing_gradient"))  # stale
        ws_module._lost_window[5].append((now - 25.0, "vanishing_gradient"))  # stale

        # Recording a fresh signal should evict the stale ones
        ws_module._record_lost(5, "something_else")

        # Only the fresh signal should remain
        remaining = list(ws_module._lost_window[5])
        assert all((now - ts) < ws_module._LOST_WINDOW_SEC for ts, _ in remaining)

    def test_different_concepts_have_independent_thresholds(self):
        """Two different concept_nodes share the same lecture window but are counted independently."""
        from routers.websocket import _record_lost, _should_trigger_accio

        _record_lost(6, "chain_rule")
        _record_lost(6, "chain_rule")
        _record_lost(6, "backprop")  # Only 1 backprop — below threshold

        assert _should_trigger_accio(6, "chain_rule")     # Should trigger
        # Reset so cooldown doesn't affect next check
        assert not _should_trigger_accio(6, "backprop")   # Should NOT trigger

    def test_ping_writes_to_correct_concept_node(self):
        """handle_ping should tag the event to the current_chunk's topic_node."""
        import asyncio
        from unittest.mock import AsyncMock
        from routers.websocket import handle_ping

        mock_ws = AsyncMock()

        with patch("routers.asr.get_current_chunk", return_value={"topic_node": "loss", "chunk_id": "c1", "text_preview": "The loss measures error."}):
            with patch("routers.websocket._write_event", new_callable=AsyncMock):
                with patch("routers.websocket.broadcast_to_lecture", new_callable=AsyncMock) as mock_broadcast:
                    asyncio.run(handle_ping(
                        websocket=mock_ws,
                        lecture_id=99,
                        data={"type": "ping", "student_id": "s42", "signal_type": "lost"},
                    ))

        # Broadcast should have been called with concept_node = 'loss'
        call_args = mock_broadcast.call_args
        assert call_args is not None
        broadcast_msg = call_args[0][1]
        assert broadcast_msg["concept_node"] == "loss"
