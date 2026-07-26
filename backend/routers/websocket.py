"""WebSocket hub for Muffliato pings — Phase 2.

Endpoint: /ws/lecture/{lecture_id}

Protocol (Server -> Client message types):
  radar_update    broadcast on every ping — student confusion event
  confusion_alert broadcast when 'lost' count hits teacher alert threshold
  analogy_ready   broadcast when Accio pipeline completes (full payload)
  latency_badge   broadcast immediately after Accio — flat numeric keys
                  so the frontend overlay can render the headline metric
                  without parsing the full analogy_ready payload.
                  Keys: retrieval_ms, gemini_ms, elevenlabs_ms, total_ms
  error           sent to the offending client only

Client -> Server:
  ping            student confusion signal
  teacher_alert_dismiss  teacher dismisses alert
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.schemas import ConfusionEvent, InterestAvatar, SignalType, StudentPing

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


# ─── ConnectionManager ───────────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections partitioned by lecture_id and student_id/role."""

    MAX_CONNECTIONS_PER_LECTURE = 200
    MAX_TEACHERS_PER_LECTURE = 10

    def __init__(self) -> None:
        self._connections: Dict[int, Dict[str, Dict]] = defaultdict(dict)
        self._teacher_connections: Dict[int, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    def can_accept(self, lecture_id: int, role: str) -> bool:
        if role == "teacher":
            return len(self._teacher_connections.get(lecture_id, set())) < self.MAX_TEACHERS_PER_LECTURE
        student_count = sum(
            1 for e in self._connections.get(lecture_id, {}).values()
            if e.get("role") == "student"
        )
        teacher_count = len(self._teacher_connections.get(lecture_id, set()))
        return (student_count + teacher_count) < self.MAX_CONNECTIONS_PER_LECTURE

    def connect(self, lecture_id: int, student_id: str, websocket: WebSocket, role: str = "student") -> None:
        self._connections[lecture_id][student_id] = {"ws": websocket, "role": role}
        if role == "teacher":
            self._teacher_connections[lecture_id].add(websocket)

    def disconnect(self, lecture_id: int, student_id: str) -> None:
        if lecture_id in self._connections:
            entry = self._connections[lecture_id].pop(student_id, None)
            if entry and entry.get("role") == "teacher":
                ws = entry.get("ws")
                if ws:
                    self._teacher_connections[lecture_id].discard(ws)
            if not self._connections[lecture_id]:
                del self._connections[lecture_id]
                self._teacher_connections.pop(lecture_id, None)

    def get_online_students(self, lecture_id: int) -> List[str]:
        if lecture_id not in self._connections:
            return []
        return [
            sid for sid, entry in self._connections[lecture_id].items()
            if entry.get("role") == "student"
        ]

    async def broadcast_to_lecture(self, lecture_id: int, message: dict) -> None:
        if lecture_id not in self._connections:
            return
        dead: List[str] = []
        for student_id, entry in list(self._connections[lecture_id].items()):
            ws = entry.get("ws")
            if not ws:
                continue
            try:
                if isinstance(message, dict):
                    await ws.send_json(message)
                else:
                    await ws.send_text(message)
            except Exception:
                dead.append(student_id)
        for sid in dead:
            self.disconnect(lecture_id, sid)

    async def send_to_student(self, lecture_id: int, student_id: str, message: dict) -> bool:
        entry = self._connections.get(lecture_id, {}).get(student_id)
        if not entry or not entry.get("ws"):
            return False
        ws = entry["ws"]
        try:
            await ws.send_text(json.dumps(message) if isinstance(message, dict) else message)
            return True
        except Exception:
            self.disconnect(lecture_id, student_id)
            return False

    async def send_teacher_alert(self, lecture_id: int, message: dict) -> None:
        dead: List[WebSocket] = []
        for ws in list(self._teacher_connections.get(lecture_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._teacher_connections[lecture_id].discard(ws)


manager = ConnectionManager()


# ─── ThresholdTracker ─────────────────────────────────────────────

class ThresholdTracker:
    """Tracks sliding-window 'lost' signals per concept node and enforces cooldowns."""

    def __init__(self, threshold: int = 2, window_seconds: float = 20.0, cooldown_seconds: float = 30.0) -> None:
        self.threshold = threshold
        self.window_seconds = window_seconds
        self.cooldown_seconds = cooldown_seconds
        self._windows: Dict[int, Dict[str, deque]] = defaultdict(lambda: defaultdict(deque))
        self._last_fired: Dict[str, float] = {}

    def record_lost(self, lecture_id: int, concept_node: str, student_id: str) -> bool:
        """Record a 'lost' signal. Returns True if threshold crossed and cooldown elapsed."""
        now = time.monotonic()
        key = f"{lecture_id}:{concept_node}"

        if now - self._last_fired.get(key, 0.0) < self.cooldown_seconds:
            return False

        dq = self._windows[lecture_id][concept_node]
        dq.append((now, student_id))

        while dq and (now - dq[0][0]) > self.window_seconds:
            dq.popleft()

        unique_students = {sid for _, sid in dq}
        if len(unique_students) >= self.threshold:
            self._last_fired[key] = now
            return True

        return False

    def reset_lecture(self, lecture_id: int) -> None:
        self._windows.pop(lecture_id, None)
        keys_to_remove = [k for k in self._last_fired if k.startswith(f"{lecture_id}:")]
        for k in keys_to_remove:
            self._last_fired.pop(k, None)


threshold_tracker = ThresholdTracker()


# ─── OfflineQueue ─────────────────────────────────────────────────

class OfflineQueue:
    """In-memory queue for offline student pings when Wi-Fi drops."""

    def __init__(self) -> None:
        self._queue: deque = deque()
        self._lock = asyncio.Lock()

    async def enqueue(self, item: dict) -> None:
        async with self._lock:
            self._queue.append(item)

    async def flush(self) -> List[dict]:
        async with self._lock:
            items = list(self._queue)
            self._queue.clear()
            return items

    @property
    def pending(self) -> int:
        return len(self._queue)


offline_queue = OfflineQueue()


# ─── WebSocket Endpoint ───────────────────────────────────────────

@router.websocket("/lecture/{lecture_id}")
async def lecture_websocket(websocket: WebSocket, lecture_id: int) -> None:
    role = websocket.query_params.get("role", "student")
    student_id = websocket.query_params.get("student_id", f"user_{id(websocket)}")

    if not manager.can_accept(lecture_id, role):
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": f"Lecture {lecture_id} is full. Maximum {manager.MAX_CONNECTIONS_PER_LECTURE} connections."
        })
        await websocket.close(code=1008)
        logger.warning("WS rejected lecture=%d role=%s — connection limit reached", lecture_id, role)
        return

    await websocket.accept()

    manager.connect(lecture_id, student_id, websocket, role=role)
    logger.info("WS connect lecture=%d student_id=%s role=%s", lecture_id, student_id, role)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await handle_ping(websocket, lecture_id, data, fallback_student_id=student_id)
            elif msg_type == "teacher_alert_dismiss":
                pass
            else:
                logger.debug("Unknown WS message type: %s", msg_type)

    except WebSocketDisconnect:
        manager.disconnect(lecture_id, student_id)
        logger.info("WS disconnect lecture=%d student_id=%s", lecture_id, student_id)
    except Exception:
        logger.exception("WS error lecture=%d student_id=%s", lecture_id, student_id)
        manager.disconnect(lecture_id, student_id)


# ─── Ping Handler ─────────────────────────────────────────────────

async def handle_ping(
    websocket: WebSocket,
    lecture_id: int,
    data: dict,
    fallback_student_id: str = "anonymous",
) -> None:
    student_id = data.get("student_id") or fallback_student_id
    try:
        ping = StudentPing(
            student_id=student_id,
            signal_type=SignalType(data.get("signal_type", "lost")),
            lecture_id=lecture_id,
        )
    except Exception:
        logger.warning("Invalid ping payload: %s", data)
        await websocket.send_json({"type": "error", "message": "Invalid ping payload"})
        return

    from routers.asr import get_current_chunk_sync
    current = get_current_chunk_sync(lecture_id) or {"topic_node": "unknown", "chunk_id": "unknown", "text_preview": ""}
    concept_node = current["topic_node"]

    event = ConfusionEvent(
        event_id=int(time.time() * 1000),
        lecture_id=lecture_id,
        student_id=ping.student_id,
        concept_node=concept_node,
        ts=ping.ts,
        signal_type=ping.signal_type,
    )
    asyncio.create_task(_write_event(event))

    radar_update = {
        "type": "radar_update",
        "lecture_id": lecture_id,
        "student_id": ping.student_id,
        "signal_type": ping.signal_type.value,
        "concept_node": concept_node,
        "ts": ping.ts.isoformat(),
    }
    await manager.broadcast_to_lecture(lecture_id, radar_update)

    if ping.signal_type == SignalType.LOST:
        fired = threshold_tracker.record_lost(lecture_id, concept_node, ping.student_id)

        alert_msg = {
            "type": "confusion_alert",
            "lecture_id": lecture_id,
            "concept_node": concept_node,
            "count": len(threshold_tracker._windows[lecture_id][concept_node]),
            "recommendation": f"Students experiencing confusion on {concept_node}",
            "ts": datetime.now().isoformat(),
        }
        await manager.send_teacher_alert(lecture_id, alert_msg)

        if fired:
            logger.info("Threshold met: lecture=%d concept=%s — triggering Accio", lecture_id, concept_node)
            avatar_str = data.get("avatar", "cricketer")
            try:
                avatar = InterestAvatar(avatar_str)
            except ValueError:
                avatar = InterestAvatar.CRICKETER

            asyncio.create_task(
                _trigger_accio(
                    lecture_id=lecture_id,
                    concept_node=concept_node,
                    chunk_text=current.get("text_preview", concept_node),
                    avatar=avatar,
                )
            )


async def broadcast_to_lecture(lecture_id: int, message: dict) -> None:
    await manager.broadcast_to_lecture(lecture_id, message)


async def send_teacher_alert(
    lecture_id: int,
    concept_node: str,
    count: int,
    recommendation: str = "Consider re-explaining this concept",
) -> None:
    alert_msg = {
        "type": "confusion_alert",
        "lecture_id": lecture_id,
        "concept_node": concept_node,
        "count": count,
        "recommendation": recommendation,
        "ts": datetime.now().isoformat(),
    }
    await manager.send_teacher_alert(lecture_id, alert_msg)


async def _write_event(event: ConfusionEvent) -> None:
    try:
        from services.vector_client import VectorAnalyticsClient
        client = VectorAnalyticsClient()
        client.insert_confusion_event(event)
    except Exception:
        logger.exception("Failed to write confusion event to Actian Vector")


async def _trigger_accio(
    lecture_id: int,
    concept_node: str,
    chunk_text: str,
    avatar: InterestAvatar = InterestAvatar.CRICKETER,
) -> None:
    """Execute retrieval pipeline and broadcast both analogy_ready and latency_badge.

    Two separate messages are sent on completion:
      1. analogy_ready — full payload (text + audio_url)
      2. latency_badge — flat numeric-only message for the frontend overlay badge
         Keys: retrieval_ms, gemini_ms, elevenlabs_ms, total_ms
         The frontend reads ONLY this message type to render the headline
         latency metric. Separating it avoids parsing the full analogy payload
         in a tight animation loop.
    """
    try:
        from routers.retrieval import run_retrieval_pipeline
        analogy = await run_retrieval_pipeline(
            concept_node=concept_node,
            chunk_text=chunk_text,
            avatar=avatar,
        )
        analogy_dict = analogy.model_dump() if hasattr(analogy, "model_dump") else analogy.dict()
        latency_ms: dict = analogy_dict.get("latency_ms") or {}

        # ── 1. Full payload broadcast ─────────────────────────────
        broadcast_msg = {
            "type": "analogy_ready",
            "lecture_id": lecture_id,
            "concept_node": concept_node,
            "original_text": analogy_dict.get("original_text", ""),
            "analogy_text": analogy_dict.get("analogy_text", ""),
            "avatar": analogy_dict.get("avatar", avatar.value),
            "latency_ms": latency_ms,
            "audio_url": analogy_dict.get("audio_url"),
        }
        await manager.broadcast_to_lecture(lecture_id, broadcast_msg)

        # ── 2. Latency badge broadcast — flat numeric keys ─────────
        # fix #4: the frontend overlay badge needs a dedicated message type
        # with top-level numeric fields, not nested inside latency_ms.
        # useWebSocket.ts should handle 'latency_badge' independently so
        # the badge component can subscribe without re-rendering the full
        # analogy pane.
        retrieval_ms = round(latency_ms.get("retrieval", 0.0), 1)
        gemini_ms = round(latency_ms.get("gemini", 0.0), 1)
        elevenlabs_ms = round(latency_ms.get("elevenlabs", 0.0), 1)
        embedding_ms = round(latency_ms.get("embedding", 0.0), 1)
        total_ms = round(
            retrieval_ms + gemini_ms + elevenlabs_ms + embedding_ms, 1
        )

        latency_badge_msg = {
            "type": "latency_badge",
            "lecture_id": lecture_id,
            "concept_node": concept_node,
            "embedding_ms": embedding_ms,
            "retrieval_ms": retrieval_ms,
            "gemini_ms": gemini_ms,
            "elevenlabs_ms": elevenlabs_ms,
            "total_ms": total_ms,
            "ts": datetime.now().isoformat(),
        }
        await manager.broadcast_to_lecture(lecture_id, latency_badge_msg)

        logger.info(
            "Accio complete lecture=%d concept=%s total=%.0fms "
            "(embed=%.0f retrieve=%.0f gemini=%.0f tts=%.0f)",
            lecture_id, concept_node, total_ms,
            embedding_ms, retrieval_ms, gemini_ms, elevenlabs_ms,
        )

    except Exception:
        logger.exception("Accio trigger failed for lecture=%d concept=%s", lecture_id, concept_node)
