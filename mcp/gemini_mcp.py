#!/usr/bin/env python3
"""
MCP Server for Google Gemini API (Gemino - Analogy Rewrite).

Provides tools for:
- Rewriting explanations as analogies for student interest avatars
- Health checks

Run: python mcp/gemini_mcp.py
"""

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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Retry config
MAX_RETRIES = 2
RETRY_DELAY_S = 0.5

# Prompt template
GEMINI_PROMPT_TEMPLATE = """You are a patient tutor explaining a confusing concept
to a student. The student loves {avatar}. Rewrite the following explanation as a
2-sentence analogy that connects the concept to {avatar} topics. Keep it simple,
conversational, and genuinely helpful.

Concept: {concept_node}
Original explanation: {original_text}

Analogy:"""

# Avatar options
AVATAR_OPTIONS = ["cricketer", "gamer", "cook", "musician", "artist", "reader"]

# Lazy-loaded client
_gemini_client = None


def get_gemini_client():
    """Get or create the Gemini client."""
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY not set")
        try:
            from google import genai
            _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
            logger.info("Gemini client initialized (model=%s)", MODEL_NAME)
        except Exception as e:
            logger.error("Failed to initialize Gemini client: %s", e)
            raise
    return _gemini_client


# Pydantic models for tool arguments
class RewriteAnalogyArgs(BaseModel):
    """Arguments for rewriting an analogy."""
    concept_node: str = Field(..., description="The concept being explained")
    original_text: str = Field(..., description="Original explanation text")
    avatar: str = Field(default="cricketer", description="Student interest avatar")


class HealthCheckArgs(BaseModel):
    """Arguments for health check (empty)."""
    pass


# MCP Server
server = Server("legilimens-gemini")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available Gemini tools."""
    return [
        Tool(
            name="gemini_rewrite_analogy",
            description="Rewrite an explanation as a 2-sentence analogy for a student avatar.",
            inputSchema=RewriteAnalogyArgs.model_json_schema(),
        ),
        Tool(
            name="gemini_health",
            description="Check if Gemini API is configured and reachable.",
            inputSchema=HealthCheckArgs.model_json_schema(),
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute a Gemini tool."""
    try:
        if name == "gemini_rewrite_analogy":
            args = RewriteAnalogyArgs(**arguments)
            return await _rewrite_analogy(args)

        elif name == "gemini_health":
            return await _health_check()

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.exception("Tool %s failed: %s", name, e)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _rewrite_analogy(args: RewriteAnalogyArgs) -> list[TextContent]:
    """Rewrite explanation as analogy for avatar."""
    if not GEMINI_API_KEY:
        logger.warning("Gemini API key not set — returning original text")
        return [TextContent(type="text", text=json.dumps({
            "analogy_text": args.original_text,
            "latency_ms": 0.0,
            "fallback": True,
        }))]

    client = get_gemini_client()

    prompt = GEMINI_PROMPT_TEMPLATE.format(
        concept_node=args.concept_node,
        original_text=args.original_text,
        avatar=args.avatar,
    )

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            start = time.perf_counter()
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000

            analogy_text = response.text.strip() if response.text else ""
            if not analogy_text:
                logger.warning("Gemini returned empty response")
                return [TextContent(type="text", text=json.dumps({
                    "analogy_text": args.original_text,
                    "latency_ms": elapsed_ms,
                    "fallback": True,
                }))]

            logger.info(
                "Gemino analogy generated (%.0fms, avatar=%s)",
                elapsed_ms,
                args.avatar,
            )
            return [TextContent(type="text", text=json.dumps({
                "analogy_text": analogy_text,
                "latency_ms": round(elapsed_ms, 1),
                "fallback": False,
            }))]

        except Exception as e:
            last_error = e
            logger.warning("Gemini attempt %d/%d failed: %s", attempt, MAX_RETRIES, e)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_S * attempt)

    # All retries exhausted
    logger.error("Gemini failed after %d attempts: %s", MAX_RETRIES, last_error)
    return [TextContent(type="text", text=json.dumps({
        "analogy_text": args.original_text,
        "latency_ms": 0.0,
        "fallback": True,
        "error": str(last_error),
    }))]


async def _health_check() -> list[TextContent]:
    """Health check for Gemini API."""
    if not GEMINI_API_KEY:
        return [TextContent(type="text", text="Gemini: NOT CONFIGURED (GEMINI_API_KEY not set)")]

    try:
        client = get_gemini_client()
        # Quick test - minimal prompt
        client.models.generate_content(model=MODEL_NAME, contents="test")
        return [TextContent(type="text", text="Gemini: HEALTHY")]
    except Exception as e:
        return [TextContent(type="text", text=f"Gemini: UNHEALTHY - {e}")]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())