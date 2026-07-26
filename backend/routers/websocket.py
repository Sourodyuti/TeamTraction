"""WebSocket hub for Muffliato pings — Phase 2.

Endpoint: /ws/lecture/{lecture_id}

Protocol:
  Client → Server:  {"type": "ping", "student_id": "...", "signal_type": "lost|gotit|slower"}
  Server → Client:  {"type": "radar_update", ...}  (broadcast to all connections in the lecture)
  Server → Client:  {"type": "analogy_audio", "student_id": "...", ...}  (targeted)

Full Phase 2 implementation:
  - StudentPing validation
  - Confusion event written to Actian Vector
  - concept_node tagged from in-memory current_chunk tracker
  - Confusion threshold check (≥2 lost in 20s) → triggers Accio Analogy
  - Analogy response sent back to all students in the lecture
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Dict, Set

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.schemas import ConfusionEvent, InterestAvatar, SignalType, StudentPing

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# ─── State ────────────────────────────────────────────────────────

# lecture_id → set of connected WebSockets
_active_connections: Dict[int, Set[WebSocket]] = defaultdict(set)

# lecture_id → deque of (timestamp, concept_node) for 'lost' signals in last 20s
_lost_window: Dict[int, deque] = defaultdict(lambda: deque())

# Confusion threshold config
_LOST_THRESHOLD = 2       # signals
_LOST_WINDOW_SEC = 20.0   # seconds
_ACCIO_COOLDOWN_SEC = 30.0  # don't trigger again within this window
_last_accio: Dict[str, float] = {}  # concept_node → last trigger time

# Role tracking: lecture_id → set of teacher WebSocket connections
_teacher_connections: Dict[int, Set[WebSocket]] = defaultdict(set)


# ─── WebSocket endpoint ───────────────────────────────────────────

@router.websocket("/lecture/{lecture_id}")
async def lecture_websocket(websocket: WebSocket, lecture_id: int) -> None:
    """WebSocket endpoint for both teachers and students.
    
    Role is determined by 'role' query param: 'teacher' or 'student' (default).
    """
    role = websocket.query_params.get("role", "student")
    await websocket.accept()
    
    _active_connections[lecture_id].add(websocket)
    if role == "teacher":
        _teacher_connections[lecture_id].add(websocket)
    
    logger.info(
        "WS connect lecture=%d role=%s (total=%d, teachers=%d)",
        lecture_id, role,
        len(_active_connections[lecture_id]),
        len(_teacher_connections[lecture_id]),
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await handle_ping(websocket, lecture_id, data)
            elif msg_type == "teacher_alert_dismiss":
                pass
            else:
                logger.debug("Unknown WS message type: %s", msg_type)

    except WebSocketDisconnect:
        _active_connections[lecture_id].discard(websocket)
        _teacher_connections[lecture_id].discard(websocket)
        logger.info(
            "WS disconnect lecture=%d (remaining=%d)",
            lecture_id, len(_active_connections[lecture_id]),
        )
    except Exception:
        logger.exception("WS error lecture=%d", lecture_id)
        _active_connections[lecture_id].discard(websocket)
        _teacher_connections[lecture_id].discard(websocket)


# ─── Ping handler ─────────────────────────────────────────────────

async def handle_ping(
    websocket: WebSocket,
    lecture_id: int,
    data: dict,
) -> None:
    """Full Phase 2 ping handler.

    1. Parse and validate StudentPing
    2. Tag to current concept_node
    3. Write ConfusionEvent to Actian Vector
    4. Broadcast radar_update to all connections in the lecture
    5. Check threshold → trigger Accio Analogy if met
    """
    # 1. Parse
    try:
        ping = StudentPing(
            student_id=data.get("student_id", "anonymous"),
            signal_type=SignalType(data.get("signal_type", "lost")),
            lecture_id=lecture_id,
        )
    except Exception:
        logger.warning("Invalid ping payload: %s", data)
        await websocket.send_json({"type": "error", "message": "Invalid ping payload"})
        return

    # 2. Tag to current concept_node
    from routers.asr import get_current_chunk_sync
    current = get_current_chunk_sync(lecture_id) or {"topic_node": "unknown", "chunk_id": "unknown", "text_preview": ""}
    concept_node = current["topic_node"]

    # 3. Write confusion event (non-blocking — failure must not kill the WS)
    event = ConfusionEvent(
        event_id=int(time.time() * 1000),  # ms timestamp as synthetic PK
        lecture_id=lecture_id,
        student_id=ping.student_id,
        concept_node=concept_node,
        ts=ping.ts,
        signal_type=ping.signal_type,
    )
    asyncio.create_task(_write_event(event))

    # 4. Broadcast radar_update
    radar_update = {
        "type": "radar_update",
        "lecture_id": lecture_id,
        "student_id": ping.student_id,
        "signal_type": ping.signal_type.value,
        "concept_node": concept_node,
        "ts": ping.ts.isoformat(),
    }
    await broadcast_to_lecture(lecture_id, radar_update)

    # 5. Threshold check (only for 'lost' signals)
    if ping.signal_type == SignalType.LOST:
        _record_lost(lecture_id, concept_node)
        count = _get_lost_count(lecture_id, concept_node)
        
        # Send alert to teachers when approaching threshold
        if count >= 1:
            await send_teacher_alert(
                lecture_id=lecture_id,
                concept_node=concept_node,
                count=count,
                recommendation=f"{count} student(s) confused. Consider preparing an analogy.",
            )
        
        if _should_trigger_accio(lecture_id, concept_node):
            logger.info(
                "Threshold met: lecture=%d concept=%s — triggering Accio",
                lecture_id, concept_node,
            )
            asyncio.create_task(
                _trigger_accio(
                    lecture_id=lecture_id,
                    concept_node=concept_node,
                    chunk_text=current.get("text_preview", concept_node),
                )
            )


# ─── Threshold helpers ────────────────────────────────────────────

def _record_lost(lecture_id: int, concept_node: str) -> None:
    """Record a 'lost' signal in the sliding 20s window."""
    now = time.monotonic()
    dq = _lost_window[lecture_id]
    dq.append((now, concept_node))
    # Evict entries older than the window
    while dq and (now - dq[0][0]) > _LOST_WINDOW_SEC:
        dq.popleft()


def _get_lost_count(lecture_id: int, concept_node: str) -> int:
    """Get the current count of 'lost' signals for a concept in the window."""
    dq = _lost_window.get(lecture_id, deque())
    return sum(1 for _, cn in dq if cn == concept_node)


def _should_trigger_accio(lecture_id: int, concept_node: str) -> bool:
    """Return True if ≥ threshold 'lost' pings for this concept in the window,
    and the cooldown has elapsed since the last Accio trigger.
    """
    key = f"{lecture_id}:{concept_node}"
    now = time.monotonic()

    # Cooldown check
    if now - _last_accio.get(key, 0.0) < _ACCIO_COOLDOWN_SEC:
        return False

    # Count recent 'lost' signals for this concept_node
    dq = _lost_window[lecture_id]
    count = sum(1 for _, cn in dq if cn == concept_node)
    if count >= _LOST_THRESHOLD:
        _last_accio[key] = now
        return True
    return False


# ─── Async helpers ────────────────────────────────────────────────

async def _write_event(event: ConfusionEvent) -> None:
    """Fire-and-forget: insert confusion event into Actian Vector."""
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
    """Call the /retrieval/accio endpoint and broadcast the analogy to all students."""
    try:
        from config import settings
        backend_port = getattr(settings, 'backend_port', 8001)
        backend_url = f"http://localhost:{backend_port}"
        async with httpx.AsyncClient(base_url=backend_url, timeout=30.0) as client:
            resp = await client.post(
                "/retrieval/accio",
                params={
                    "concept_node": concept_node,
                    "chunk_text": chunk_text,
                    "avatar": avatar.value,
                },
            )
            resp.raise_for_status()
            analogy = resp.json()

        broadcast_msg = {
            "type": "analogy_ready",
            "lecture_id": lecture_id,
            "concept_node": concept_node,
            "original_text": analogy.get("original_text", ""),
            "analogy_text": analogy.get("analogy_text", ""),
            "avatar": analogy.get("avatar", avatar.value),
            "latency_ms": analogy.get("latency_ms", {}),
        }
        await broadcast_to_lecture(lecture_id, broadcast_msg)
        logger.info("Accio analogy broadcast for lecture=%d concept=%s", lecture_id, concept_node)

    except Exception:
        logger.exception("Accio trigger failed for lecture=%d concept=%s", lecture_id, concept_node)


async def broadcast_to_lecture(lecture_id: int, message: dict) -> None:
    """Send a message to all connected WebSockets in a lecture."""
    dead: list[WebSocket] = []
    for ws in list(_active_connections.get(lecture_id, set())):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _active_connections[lecture_id].discard(ws)


async def send_teacher_alert(
    lecture_id: int,
    concept_node: str,
    count: int,
    recommendation: str = "Consider re-explaining this concept",
) -> None:
    """Send an alert overlay to all teachers in the lecture."""
    alert_msg = {
        "type": "confusion_alert",
        "lecture_id": lecture_id,
        "concept_node": concept_node,
        "count": count,
        "recommendation": recommendation,
        "ts": datetime.now().isoformat(),
    }
    
    dead: list[WebSocket] = []
    for ws in list(_teacher_connections.get(lecture_id, set())):
        try:
            await ws.send_json(alert_msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _teacher_connections[lecture_id].discard(ws)
    
    logger.info(
        "Teacher alert sent: lecture=%d concept=%s count=%d",
        lecture_id, concept_node, count,
    )


def update_threshold(new_threshold: int) -> None:
    """Update the confusion threshold (for demo configuration)."""
    global _LOST_THRESHOLD
    _LOST_THRESHOLD = new_threshold
