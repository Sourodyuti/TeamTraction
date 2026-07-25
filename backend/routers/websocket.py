"""WebSocket hub for Muffliato pings — Phase 2.

Endpoint: /ws/lecture/{lecture_id}

Protocol:
  Client → Server:  {"type": "ping", "student_id": "...", "signal_type": "lost|gotit|slower"}
  Server → Client:  {"type": "radar_update", ...}  (broadcast to all connections in the lecture)
  Server → Client:  {"type": "analogy_audio", "student_id": "...", "audio_url": "..."}  (targeted)

Manages connection pools per lecture_id so broadcasts don't cross lectures.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.schemas import SignalType

router = APIRouter(prefix="/ws", tags=["websocket"])

# lecture_id → set of connected WebSockets
_active_connections: Dict[int, Set[WebSocket]] = defaultdict(set)


@router.websocket("/lecture/{lecture_id}")
async def lecture_websocket(websocket: WebSocket, lecture_id: int) -> None:
    await websocket.accept()
    _active_connections[lecture_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_json()

            msg_type = data.get("type")

            if msg_type == "ping":
                # TODO Phase 2: validate ping schema (StudentPing), tag to current
                #   concept_node, write to Actian Vector confusion_events, broadcast
                #   radar_update to all connections in this lecture.
                await handle_ping(websocket, lecture_id, data)

            # Future message types can be added here.

    except WebSocketDisconnect:
        _active_connections[lecture_id].discard(websocket)


async def handle_ping(
    websocket: WebSocket,
    lecture_id: int,
    data: dict,
) -> None:
    """Process a student confusion ping and broadcast to the radar.

    TODO Phase 2: Implement fully.
      1. Parse StudentPing from data.
      2. Tag to the current concept_node (latest transcript chunk).
      3. Insert a ConfusionEvent row into Actian Vector.
      4. Broadcast a radar_update to all connections in the lecture.
      5. Check threshold (≥2 lost in 20s) → fire Accio Analogy (Phase 4).
    """
    student_id = data.get("student_id", "unknown")
    signal_type = data.get("signal_type", "lost")

    # Broadcast to all connections in this lecture (radar update)
    radar_update = {
        "type": "radar_update",
        "lecture_id": lecture_id,
        "student_id": student_id,
        "signal_type": signal_type,
    }
    await broadcast_to_lecture(lecture_id, radar_update)


async def broadcast_to_lecture(lecture_id: int, message: dict) -> None:
    """Send a message to all connected WebSockets in a lecture."""
    dead: list[WebSocket] = []
    for ws in _active_connections.get(lecture_id, set()):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _active_connections[lecture_id].discard(ws)
