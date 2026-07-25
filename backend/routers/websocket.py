"""WebSocket hub for Muffliato pings — Phase 2/4/6 (production).

Endpoint: /ws/lecture/{lecture_id}

Protocol:
  Client → Server:  {"type": "ping", "student_id": "...", "signal_type": "lost|gotit|slower",
                      "avatar": "cricketer|gamer|cook"}  (optional)
  Server → Client:  {"type": "radar_update", "lecture_id": ..., "student_id": ...,
                      "signal_type": ..., "concept_node": ..., "ts": ...}          (broadcast)
  Server → Client:  {"type": "analogy_audio", "student_id": ..., "audio_url": ...}  (targeted)
  Server → Client:  {"type": "latency_update", "retrieval_ms": ..., "embedding_ms": ...,
                      "gemini_ms": ..., "total_ms": ...}                            (broadcast)
  Server → Client:  {"type": "analogy_text", "student_id": ..., "concept_node": ...,
                      "analogy_text": ..., "original_text": ...}                    (targeted)

Connection management:
  - Per-lecture connection pools
  - Dead connection cleanup on broadcast failure
  - Targeted delivery to specific students (for analogy audio/text)
  - Thread-safe via asyncio (single event loop)

Threshold logic (Phase 4):
  - Tracks recent 'lost' pings per concept_node with a sliding 20s window
  - When ≥2 unique students go 'lost' on the same node in 20s → fires Accio Analogy
  - Delegates to the retrieval service (owned by AI/ML lead)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Deque, Dict, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from models.schemas import InterestAvatar, SignalType, StudentPing

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["websocket"])


# ─── Connection state ────────────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections per lecture.

    Thread-safe in the asyncio sense — all mutations happen on the event loop.
    """

    def __init__(self) -> None:
        # lecture_id → {student_id → WebSocket}
        self._connections: Dict[int, Dict[str, WebSocket]] = defaultdict(dict)

    def connect(self, lecture_id: int, student_id: str, ws: WebSocket) -> None:
        self._connections[lecture_id][student_id] = ws
        logger.info("Student %s connected to lecture %d (%d online)",
                     student_id, lecture_id, len(self._connections[lecture_id]))

    def disconnect(self, lecture_id: int, student_id: str) -> None:
        conns = self._connections.get(lecture_id, {})
        conns.pop(student_id, None)
        if not conns:
            self._connections.pop(lecture_id, None)

    def get_online_students(self, lecture_id: int) -> Set[str]:
        return set(self._connections.get(lecture_id, {}).keys())

    async def broadcast_to_lecture(self, lecture_id: int, message: dict) -> None:
        """Send a message to ALL connections in a lecture. Cleans up dead sockets."""
        conns = self._connections.get(lecture_id, {})
        if not conns:
            return

        dead: list[tuple[str, Exception]] = []
        text = json.dumps(message, default=str)

        # Send concurrently for low latency
        async def _send(sid: str, ws: WebSocket) -> Optional[tuple[str, Exception]]:
            try:
                await ws.send_text(text)
                return None
            except Exception as e:
                return (sid, e)

        results = await asyncio.gather(
            *[_send(sid, ws) for sid, ws in conns.items()],
            return_exceptions=True,
        )

        # Clean up dead connections
        for r in results:
            if isinstance(r, tuple):
                sid, err = r
                dead.append((sid, err))

        for sid, err in dead:
            logger.warning("Dropping dead connection for student %s: %s", sid, err)
            self.disconnect(lecture_id, sid)

    async def send_to_student(self, lecture_id: int, student_id: str, message: dict) -> bool:
        """Send a message to a SPECIFIC student. Returns True if delivered."""
        ws = self._connections.get(lecture_id, {}).get(student_id)
        if ws is None:
            logger.warning("Student %s not connected to lecture %d — cannot deliver",
                           student_id, lecture_id)
            return False
        try:
            await ws.send_text(json.dumps(message, default=str))
            return True
        except Exception as e:
            logger.warning("Failed to deliver to student %s: %s — dropping", student_id, e)
            self.disconnect(lecture_id, student_id)
            return False


manager = ConnectionManager()


# ─── Threshold tracker (Phase 4) ─────────────────────────────────

class ThresholdTracker:
    """Tracks 'lost' pings per concept_node with a sliding time window.

    Fires when ≥ `threshold` unique students go 'lost' on the same concept_node
    within `window_seconds`.

    Cooldown prevents re-firing the same node too rapidly.
    """

    def __init__(self, threshold: int = 2, window_seconds: float = 20.0,
                 cooldown_seconds: float = 45.0) -> None:
        self.threshold = threshold
        self.window_seconds = window_seconds
        self.cooldown_seconds = cooldown_seconds
        # (lecture_id, concept_node) → deque of (student_id, timestamp)
        self._lost_pings: Dict[tuple, Deque[tuple]] = defaultdict(deque)
        # (lecture_id, concept_node) → last fire timestamp
        self._last_fired: Dict[tuple, float] = {}

    def record_lost(self, lecture_id: int, concept_node: str, student_id: str) -> bool:
        """Record a 'lost' ping. Returns True if threshold is crossed (should fire)."""
        key = (lecture_id, concept_node)
        now = time.monotonic()

        # Prune old entries outside the window
        dq = self._lost_pings[key]
        cutoff = now - self.window_seconds
        while dq and dq[0][1] < cutoff:
            dq.popleft()

        # Add this ping
        dq.append((student_id, now))

        # Count unique students in window
        unique_students = {sid for sid, _ in dq}

        if len(unique_students) < self.threshold:
            return False

        # Check cooldown — don't re-fire too rapidly
        last_fire = self._last_fired.get(key, 0.0)
        if (now - last_fire) < self.cooldown_seconds:
            logger.debug("Threshold hit for %s but in cooldown (%.1fs remaining)",
                         concept_node, self.cooldown_seconds - (now - last_fire))
            return False

        # Fire!
        self._last_fired[key] = now
        self._lost_pings[key].clear()  # Reset to avoid immediate re-fire
        logger.info("🔥 Threshold crossed: %d students lost on '%s' in lecture %d — firing Accio Analogy",
                     len(unique_students), concept_node, lecture_id)
        return True

    def reset_lecture(self, lecture_id: int) -> None:
        """Clear all tracking state for a lecture (on lecture end)."""
        keys_to_remove = [k for k in self._lost_pings if k[0] == lecture_id]
        for k in keys_to_remove:
            del self._lost_pings[k]
            self._last_fired.pop(k, None)


threshold_tracker = ThresholdTracker(threshold=2, window_seconds=20.0, cooldown_seconds=45.0)


# ─── Offline ping queue (Phase 8 — simulates Actian Zen edge buffer) ──

class OfflineQueue:
    """In-memory queue for pings that couldn't reach the analytics DB.

    When the DB is unreachable (offline demo), pings are buffered here and
    flushed on reconnect. This simulates the Actian Zen edge-buffer behavior.
    """

    def __init__(self) -> None:
        self._queue: list[dict] = []
        self._lock = asyncio.Lock()

    async def enqueue(self, ping_data: dict) -> None:
        async with self._lock:
            self._queue.append(ping_data)
            if len(self._queue) % 10 == 0:
                logger.warning("Offline queue: %d pings buffered (DB unreachable)", len(self._queue))

    async def flush(self) -> list[dict]:
        """Return all queued pings and clear the queue."""
        async with self._lock:
            items = self._queue[:]
            self._queue.clear()
            if items:
                logger.info("Offline queue flushed: %d pings synced to DB", len(items))
            return items

    @property
    def pending(self) -> int:
        return len(self._queue)


offline_queue = OfflineQueue()


# ─── WebSocket endpoint ──────────────────────────────────────────

@router.websocket("/lecture/{lecture_id}")
async def lecture_websocket(websocket: WebSocket, lecture_id: int) -> None:
    """Main WebSocket endpoint for live lecture interaction."""
    await websocket.accept()

    # Student ID is assigned on connect (frontend generates it, or we assign)
    student_id = websocket.query_params.get("student_id", f"anon_{id(websocket)}")
    manager.connect(lecture_id, student_id, websocket)

    # Send connection confirmation
    await websocket.send_text(json.dumps({
        "type": "connected",
        "student_id": student_id,
        "lecture_id": lecture_id,
        "online_count": len(manager.get_online_students(lecture_id)),
    }))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from student %s: %s", student_id, raw[:100])
                continue

            msg_type = data.get("type")

            if msg_type == "ping":
                await _handle_ping(websocket, lecture_id, student_id, data)
            elif msg_type == "sync_request":
                # Frontend requests offline queue flush status
                await websocket.send_text(json.dumps({
                    "type": "queue_status",
                    "pending": offline_queue.pending,
                }))
            else:
                logger.debug("Unknown message type '%s' from student %s", msg_type, student_id)

    except WebSocketDisconnect:
        logger.info("Student %s disconnected from lecture %d", student_id, lecture_id)
    except Exception as e:
        logger.exception("Unexpected error for student %s in lecture %d: %s",
                         student_id, lecture_id, e)
    finally:
        manager.disconnect(lecture_id, student_id)
        await manager.broadcast_to_lecture(lecture_id, {
            "type": "student_left",
            "student_id": student_id,
            "online_count": len(manager.get_online_students(lecture_id)),
        })


async def _handle_ping(
    websocket: WebSocket,
    lecture_id: int,
    student_id: str,
    data: dict,
) -> None:
    """Process a student confusion ping end-to-end."""
    # 1. Validate the ping
    try:
        ping = StudentPing(
            student_id=student_id,
            ts=datetime.now(timezone.utc),
            signal_type=SignalType(data.get("signal_type", "lost")),
            lecture_id=lecture_id,
        )
    except (ValidationError, ValueError) as e:
        logger.warning("Invalid ping from %s: %s", student_id, e)
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Invalid ping: {e}",
        }))
        return

    # 2. Resolve current concept_node (from current_chunk table or default)
    concept_node = _get_current_concept_node(lecture_id)

    # 3. Write to Actian Vector (with offline fallback)
    await _write_confusion_event(ping, concept_node)

    # 4. Broadcast radar update to all connections
    radar_update = {
        "type": "radar_update",
        "lecture_id": lecture_id,
        "student_id": student_id,
        "signal_type": ping.signal_type.value,
        "concept_node": concept_node,
        "ts": ping.ts.isoformat(),
        "online_count": len(manager.get_online_students(lecture_id)),
    }
    await manager.broadcast_to_lecture(lecture_id, radar_update)

    # 5. Check threshold — if crossed, fire Accio Analogy
    if ping.signal_type == SignalType.LOST:
        if threshold_tracker.record_lost(lecture_id, concept_node, student_id):
            avatar_str = data.get("avatar", "cricketer")
            try:
                avatar = InterestAvatar(avatar_str)
            except ValueError:
                avatar = InterestAvatar.CRICKETER

            # Fire retrieval asynchronously (don't block the ping handler)
            asyncio.create_task(
                _fire_accio_analogy(lecture_id, concept_node, avatar, student_id)
            )


def _get_current_concept_node(lecture_id: int) -> str:
    """Get the current concept node for a lecture from the current_chunk table."""
    try:
        from models.database import get_vector_connection
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT topic_node FROM current_chunk WHERE lecture_id = ? ORDER BY ts DESC LIMIT 1",
                (lecture_id,)
            )
            row = cursor.fetchone()
            if row:
                return row[0]
    except Exception as e:
        logger.warning("Could not fetch current concept_node for lecture %d: %s — using default",
                       lecture_id, e)
    return "general"


async def _write_confusion_event(ping: StudentPing, concept_node: str) -> None:
    """Write a confusion event to Actian Vector. Buffers to offline queue on failure."""
    try:
        from models.database import get_vector_connection
        import time as _time
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO confusion_events
                   (event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    int(_time.time() * 1000),  # event_id from timestamp
                    ping.lecture_id,
                    ping.student_id,
                    concept_node,
                    ping.ts,
                    ping.signal_type.value,
                    "default",
                )
            )
    except Exception as e:
        logger.warning("DB write failed for ping — buffering offline: %s", e)
        await offline_queue.enqueue({
            "student_id": ping.student_id,
            "lecture_id": ping.lecture_id,
            "concept_node": concept_node,
            "ts": ping.ts.isoformat(),
            "signal_type": ping.signal_type.value,
        })


async def _fire_accio_analogy(
    lecture_id: int,
    concept_node: str,
    avatar: InterestAvatar,
    triggering_student: str,
) -> None:
    """Fire the Accio Analogy retrieval pipeline when threshold is crossed.

    Calls the retrieval service (owned by AI/ML lead) and delivers the result
    to the triggering student + broadcasts latency metrics.
    """
    import time as _time
    pipeline_start = _time.perf_counter()

    logger.info("🎯 Accio Analogy fired: lecture=%d node='%s' avatar=%s",
                lecture_id, concept_node, avatar.value)

    try:
        # Get the confusing chunk text for embedding
        chunk_text = _get_chunk_text(lecture_id, concept_node)
        if not chunk_text:
            logger.warning("No chunk text found for concept '%s' — skipping analogy", concept_node)
            return

        # Call the retrieval router's pipeline (embed → retrieve → rewrite → TTS)
        # This delegates to services owned by the AI/ML lead.
        from routers.retrieval import run_retrieval_pipeline
        result = await run_retrieval_pipeline(
            concept_node=concept_node,
            chunk_text=chunk_text,
            avatar=avatar,
        )

        total_ms = (_time.perf_counter() - pipeline_start) * 1000

        # Deliver analogy text to the triggering student (targeted)
        delivered = await manager.send_to_student(lecture_id, triggering_student, {
            "type": "analogy_text",
            "student_id": triggering_student,
            "concept_node": concept_node,
            "analogy_text": result.analogy_text,
            "original_text": result.original_text,
            "avatar": avatar.value,
        })

        if delivered and result.audio_url:
            # Deliver audio to the triggering student
            await manager.send_to_student(lecture_id, triggering_student, {
                "type": "analogy_audio",
                "student_id": triggering_student,
                "audio_url": result.audio_url,
            })

        # Broadcast latency metrics to the dashboard
        await manager.broadcast_to_lecture(lecture_id, {
            "type": "latency_update",
            "retrieval_ms": int(result.latency_ms.get("retrieval", 0)),
            "embedding_ms": int(result.latency_ms.get("embedding", 0)),
            "gemini_ms": int(result.latency_ms.get("gemini", 0)),
            "total_ms": int(total_ms),
            "concept_node": concept_node,
            "delivered": delivered,
        })

        logger.info("✅ Accio Analogy delivered: total=%.0fms delivered=%s",
                    total_ms, delivered)

    except Exception as e:
        logger.exception("Accio Analogy pipeline failed for '%s': %s", concept_node, e)
        await manager.broadcast_to_lecture(lecture_id, {
            "type": "error",
            "message": f"Analogy generation failed: {concept_node}",
        })


def _get_chunk_text(lecture_id: int, concept_node: str) -> Optional[str]:
    """Get the text of the current chunk for a concept node."""
    try:
        from models.database import get_vector_connection
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT text_preview FROM current_chunk WHERE lecture_id = ? AND topic_node = ? "
                "ORDER BY ts DESC LIMIT 1",
                (lecture_id, concept_node)
            )
            row = cursor.fetchone()
            if row:
                return row[0]
    except Exception as e:
        logger.warning("Could not fetch chunk text for '%s': %s", concept_node, e)
    return None


# ─── Admin endpoints ─────────────────────────────────────────────

@router.get("/lectures/{lecture_id}/online")
async def get_online_count(lecture_id: int) -> dict:
    """Get the count of online students in a lecture."""
    students = manager.get_online_students(lecture_id)
    return {
        "lecture_id": lecture_id,
        "online_count": len(students),
        "student_ids": list(students),
    }


@router.post("/lectures/{lecture_id}/flush-offline")
async def flush_offline_queue(lecture_id: int) -> dict:
    """Manually flush the offline ping queue to the DB."""
    items = await offline_queue.flush()
    flushed = 0
    for item in items:
        if item.get("lecture_id") == lecture_id:
            try:
                from models.database import get_vector_connection
                import time as _time
                with get_vector_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """INSERT INTO confusion_events
                           (event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (int(_time.time() * 1000), item["lecture_id"], item["student_id"],
                         item["concept_node"], item["ts"], item["signal_type"], "default")
                    )
                    flushed += 1
            except Exception as e:
                logger.error("Failed to flush ping: %s", e)

    return {"lecture_id": lecture_id, "flushed": flushed, "remaining": offline_queue.pending}
