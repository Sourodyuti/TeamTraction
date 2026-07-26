"""Recording router for buffer and review."""
import json
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import asyncio

from services.recording_service import get_recording_service
from models.schemas import RecordingChunk

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recording", tags=["recording"])

RECORDINGS_DIR = Path("recordings")

# For websocket streaming
active_connections: dict[int, list[WebSocket]] = {}

@router.post("/{lecture_id}/chunk")
async def add_chunk(
    lecture_id: int,
    audio_file: UploadFile = File(...),
    transcript: str = Form(...),
    start_ts: float = Form(...),
    end_ts: float = Form(...)
) -> RecordingChunk:
    audio_bytes = await audio_file.read()
    svc = get_recording_service()
    chunk = svc.add_chunk(lecture_id, audio_bytes, start_ts, end_ts, transcript)
    
    # Broadcast to websockets
    if lecture_id in active_connections:
        dead_conns = []
        for ws in active_connections[lecture_id]:
            try:
                await ws.send_json(chunk.model_dump(mode="json"))
            except Exception:
                dead_conns.append(ws)
        for dead in dead_conns:
            active_connections[lecture_id].remove(dead)
            
    return chunk

@router.get("/{lecture_id}/manifest")
async def get_manifest(lecture_id: int):
    manifest_path = RECORDINGS_DIR / str(lecture_id) / "manifest.json"
    if not manifest_path.exists():
        return []
    with open(manifest_path, "r") as f:
        return json.load(f)

@router.get("/{lecture_id}/chunk/{chunk_id}")
async def get_chunk_audio(lecture_id: int, chunk_id: str):
    svc = get_recording_service()
    if lecture_id not in svc.buffers_list:
        raise HTTPException(status_code=404, detail="Lecture not found")
    for c in svc.buffers_list[lecture_id]:
        if c.chunk_id == chunk_id:
            if not Path(c.file_path).exists():
                raise HTTPException(status_code=404, detail="File missing")
            return FileResponse(c.file_path, media_type="audio/webm")
    raise HTTPException(status_code=404, detail="Chunk not found")

@router.get("/{lecture_id}/chunks")
async def list_chunks(lecture_id: int, from_ts: float, to_ts: float):
    svc = get_recording_service()
    return svc.get_chunks_for_review(lecture_id, from_ts, to_ts)

@router.websocket("/{lecture_id}/stream")
async def stream_recording(websocket: WebSocket, lecture_id: int):
    await websocket.accept()
    if lecture_id not in active_connections:
        active_connections[lecture_id] = []
    active_connections[lecture_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_connections.get(lecture_id, []):
            active_connections[lecture_id].remove(websocket)

@router.post("/{lecture_id}/start")
async def start_session(lecture_id: int):
    """Start a recording session for a lecture."""
    svc = get_recording_service()
    session = svc.start_session(lecture_id)
    return session

@router.post("/{lecture_id}/stop")
async def stop_session(lecture_id: int):
    """Stop a recording session."""
    svc = get_recording_service()
    svc.end_session(lecture_id)
    return {"status": "stopped", "lecture_id": lecture_id}

@router.get("/{lecture_id}/status")
async def session_status(lecture_id: int):
    """Get recording session status."""
    svc = get_recording_service()
    return svc.get_session_status(lecture_id)

@router.get("/{lecture_id}/full-manifest")
async def full_manifest(lecture_id: int):
    """Get the full manifest from disk (survives restarts)."""
    svc = get_recording_service()
    return svc.get_full_manifest(lecture_id)

@router.get("/{lecture_id}/kb-chunks")
async def get_kb_chunks(lecture_id: int):
    """Get all knowledge base indexed chunks for a lecture."""
    from services.knowledge_base import get_knowledge_base
    kb = get_knowledge_base()
    return kb.get_all_chunks(lecture_id)
