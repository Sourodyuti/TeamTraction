#!/usr/bin/env python3
"""
MCP Server for ElevenLabs API (Sonorus - Voice Re-delivery).

Provides tools for:
- Text-to-speech conversion with calm tutor voice
- Listing available voices
- Health checks

Run: python mcp/elevenlabs_mcp.py
"""

import base64
import json
import logging
import os
import time
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment config
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
DEFAULT_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel
DEFAULT_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_monolingual_v1")

# Lazy-loaded client
_elevenlabs_client = None


def get_elevenlabs_client():
    """Get or create the ElevenLabs client."""
    global _elevenlabs_client
    if _elevenlabs_client is None:
        if not ELEVENLABS_API_KEY:
            raise RuntimeError("ELEVENLABS_API_KEY not set")
        try:
            from elevenlabs import ElevenLabs
            _elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
            logger.info("ElevenLabs client initialized (voice=%s)", DEFAULT_VOICE_ID)
        except Exception as e:
            logger.error("Failed to initialize ElevenLabs client: %s", e)
            raise
    return _elevenlabs_client


# Pydantic models for tool arguments
class TextToSpeechArgs(BaseModel):
    """Arguments for text-to-speech conversion."""
    text: str = Field(..., description="Text to convert to speech")
    voice_id: str = Field(default=DEFAULT_VOICE_ID, description="Voice ID to use")
    model_id: str = Field(default=DEFAULT_MODEL_ID, description="Model ID to use")


class ListVoicesArgs(BaseModel):
    """Arguments for listing voices (empty)."""
    pass


class HealthCheckArgs(BaseModel):
    """Arguments for health check (empty)."""
    pass


# MCP Server
server = Server("legilimens-elevenlabs")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available ElevenLabs tools."""
    return [
        Tool(
            name="elevenlabs_text_to_speech",
            description="Convert text to speech audio (MP3). Returns base64-encoded audio.",
            inputSchema=TextToSpeechArgs.model_json_schema(),
        ),
        Tool(
            name="elevenlabs_list_voices",
            description="List available ElevenLabs voices.",
            inputSchema=ListVoicesArgs.model_json_schema(),
        ),
        Tool(
            name="elevenlabs_health",
            description="Check if ElevenLabs API is configured and reachable.",
            inputSchema=HealthCheckArgs.model_json_schema(),
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute an ElevenLabs tool."""
    try:
        if name == "elevenlabs_text_to_speech":
            args = TextToSpeechArgs(**arguments)
            return await _text_to_speech(args)

        elif name == "elevenlabs_list_voices":
            return await _list_voices()

        elif name == "elevenlabs_health":
            return await _health_check()

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.exception("Tool %s failed: %s", name, e)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _text_to_speech(args: TextToSpeechArgs) -> list[TextContent]:
    """Convert text to speech."""
    if not args.text or not args.text.strip():
        return [TextContent(type="text", text=json.dumps({
            "audio_base64": "",
            "latency_ms": 0.0,
            "error": "Empty text",
        }))]

    if not ELEVENLABS_API_KEY:
        logger.warning("ElevenLabs API key not set — returning empty audio")
        return [TextContent(type="text", text=json.dumps({
            "audio_base64": "",
            "latency_ms": 0.0,
            "fallback": True,
        }))]

    client = get_elevenlabs_client()

    try:
        start = time.perf_counter()

        # generate() returns an iterator of audio chunks
        audio_iterator = client.text_to_speech.convert(
            voice_id=args.voice_id,
            text=args.text,
            model_id=args.model_id,
        )

        # Collect all chunks
        audio_bytes = b"".join(chunk for chunk in audio_iterator)

        elapsed_ms = (time.perf_counter() - start) * 1000

        # Encode as base64
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        logger.info("Sonorus TTS generated (%d bytes, %.0fms)", len(audio_bytes), elapsed_ms)

        return [TextContent(type="text", text=json.dumps({
            "audio_base64": audio_base64,
            "latency_ms": round(elapsed_ms, 1),
            "format": "mp3",
            "voice_id": args.voice_id,
            "fallback": False,
        }))]

    except Exception as e:
        logger.error("ElevenLabs TTS failed: %s", e)
        return [TextContent(type="text", text=json.dumps({
            "audio_base64": "",
            "latency_ms": 0.0,
            "fallback": True,
            "error": str(e),
        }))]


async def _list_voices() -> list[TextContent]:
    """List available ElevenLabs voices."""
    if not ELEVENLABS_API_KEY:
        return [TextContent(type="text", text=json.dumps({
            "voices": [],
            "error": "ELEVENLABS_API_KEY not set",
        }))]

    try:
        client = get_elevenlabs_client()
        voices_response = client.voices.get_all()

        voices = []
        for voice in voices_response.voices:
            voices.append({
                "voice_id": voice.voice_id,
                "name": voice.name,
                "category": voice.category,
                "description": voice.description,
            })

        return [TextContent(type="text", text=json.dumps({"voices": voices}, indent=2))]

    except Exception as e:
        logger.error("Failed to list voices: %s", e)
        return [TextContent(type="text", text=json.dumps({
            "voices": [],
            "error": str(e),
        }))]


async def _health_check() -> list[TextContent]:
    """Health check for ElevenLabs API."""
    if not ELEVENLABS_API_KEY:
        return [TextContent(type="text", text="ElevenLabs: NOT CONFIGURED (ELEVENLABS_API_KEY not set)")]

    try:
        client = get_elevenlabs_client()
        # Quick test - list voices
        client.voices.get_all()
        return [TextContent(type="text", text="ElevenLabs: HEALTHY")]
    except Exception as e:
        return [TextContent(type="text", text=f"ElevenLabs: UNHEALTHY - {e}")]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())