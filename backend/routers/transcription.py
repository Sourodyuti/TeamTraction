import logging
import time
from typing import Optional
from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from services.whisper_service import get_whisper_service
from services.recording_service import get_recording_service
from routers.asr import ChunkIngest, ingest_chunk
from routers.websocket import broadcast_to_lecture

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transcription", tags=["transcription"])

class TranscriptionResponse(BaseModel):
    text: str
    segments: list[dict]

@router.post("/upload", response_model=TranscriptionResponse)
async def upload_audio(audio_file: UploadFile = File(...)):
    audio_bytes = await audio_file.read()
    ws = get_whisper_service()
    if not ws.available:
        raise HTTPException(status_code=503, detail="Whisper not available")
    
    text, segments = ws.transcribe_bytes(audio_bytes)
    return TranscriptionResponse(text=text, segments=segments)

@router.get("/status")
async def get_status():
    ws = get_whisper_service()
    return {"available": ws.available, "model": "base.en"}

@router.websocket("/live/{lecture_id}")
async def live_transcription(websocket: WebSocket, lecture_id: int):
    await websocket.accept()
    ws_svc = get_whisper_service()
    rec_svc = get_recording_service()
    
    # Track timestamps for recording chunks
    session_start = time.time()
    chunk_start = session_start
    
    try:
        while True:
            audio_bytes = await websocket.receive_bytes()
            chunk_end = time.time()
            
            if not ws_svc.available:
                chunk_start = chunk_end
                continue
                
            text = ws_svc.transcribe_stream_chunk(audio_bytes)
            
            # Always persist audio to recording service (even if transcript is empty)
            # This ensures we have a complete recording
            try:
                rec_svc.add_chunk(
                    lecture_id=lecture_id,
                    audio_bytes=audio_bytes,
                    start_ts=chunk_start - session_start,
                    end_ts=chunk_end - session_start,
                    transcript_text=text.strip() if text else ""
                )
            except Exception as rec_err:
                logger.warning("Recording chunk failed (non-fatal): %s", rec_err)
            
            chunk_start = chunk_end
            
            if not text.strip():
                continue
                
            # Create chunk ingest payload
            ts_now = time.time()
            chunk = ChunkIngest(
                text=text,
                topic_node="live_speech",
                lecture_id=lecture_id,
                ts=ts_now,
                difficulty=3,
                source="live_lecture"
            )
            
            # Auto-inject into ASR pipeline (sync store, kb index, broadcast)
            from fastapi import BackgroundTasks
            bg = BackgroundTasks()
            await ingest_chunk(chunk, bg)
            
            # Execute background tasks (broadcasts) immediately in this context
            for task in bg.tasks:
                await task()
                
            # Broadcast transcript_update
            update_msg = {
                "type": "transcript_update",
                "lecture_id": lecture_id,
                "text": text
            }
            await broadcast_to_lecture(lecture_id, update_msg)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("Live transcription error: %s", e)
