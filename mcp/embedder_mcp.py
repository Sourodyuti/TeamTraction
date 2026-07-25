#!/usr/bin/env python3
"""
MCP Server for bge-small-en Embedder.

Provides tools for:
- Encoding text to 384-dim embeddings
- Encoding with latency measurement
- Model info

Run: python mcp/embedder_mcp.py
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

# Model config
MODEL_NAME = os.getenv("EMBEDDER_MODEL", "BAAI/bge-small-en-v1.5")

# Lazy-loaded model
_model = None


def get_model():
    """Get or load the sentence transformer model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading embedding model: %s ...", MODEL_NAME)
            _model = SentenceTransformer(MODEL_NAME)
            logger.info("Embedding model loaded (dim=%d)", _model.get_sentence_embedding_dimension())
        except Exception as e:
            logger.error("Failed to load embedding model: %s", e)
            raise
    return _model


# Pydantic models for tool arguments
class EncodeArgs(BaseModel):
    """Arguments for encoding text."""
    text: str | list[str]


class EncodeWithLatencyArgs(BaseModel):
    """Arguments for encoding with latency measurement."""
    text: str


class ModelInfoArgs(BaseModel):
    """Arguments for model info (empty)."""
    pass


# MCP Server
server = Server("legilimens-embedder")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available Embedder tools."""
    return [
        Tool(
            name="embedder_encode",
            description="Encode text(s) into 384-dim embeddings.",
            inputSchema=EncodeArgs.model_json_schema(),
        ),
        Tool(
            name="embedder_encode_with_latency",
            description="Encode single text and return (vector, latency_ms).",
            inputSchema=EncodeWithLatencyArgs.model_json_schema(),
        ),
        Tool(
            name="embedder_model_info",
            description="Get model information (name, dimension).",
            inputSchema=ModelInfoArgs.model_json_schema(),
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute an Embedder tool."""
    try:
        if name == "embedder_encode":
            args = EncodeArgs(**arguments)
            return await _encode(args)

        elif name == "embedder_encode_with_latency":
            args = EncodeWithLatencyArgs(**arguments)
            return await _encode_with_latency(args)

        elif name == "embedder_model_info":
            return await _model_info()

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.exception("Tool %s failed: %s", name, e)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _encode(args: EncodeArgs) -> list[TextContent]:
    """Encode text to embeddings."""
    model = get_model()

    texts = args.text if isinstance(args.text, list) else [args.text]
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    # Convert to list of lists
    vectors = [emb.tolist() for emb in embeddings]

    return [TextContent(type="text", text=json.dumps(vectors))]


async def _encode_with_latency(args: EncodeWithLatencyArgs) -> list[TextContent]:
    """Encode single text with latency measurement."""
    model = get_model()

    start = time.perf_counter()
    embeddings = model.encode([args.text], normalize_embeddings=True, show_progress_bar=False)
    elapsed_ms = (time.perf_counter() - start) * 1000

    vector = embeddings[0].tolist()

    result = {
        "vector": vector,
        "latency_ms": round(elapsed_ms, 2),
        "dim": len(vector),
    }

    return [TextContent(type="text", text=json.dumps(result))]


async def _model_info() -> list[TextContent]:
    """Get model information."""
    model = get_model()
    dim = model.get_sentence_embedding_dimension()

    result = {
        "model_name": MODEL_NAME,
        "dimension": dim,
        "max_seq_length": model.max_seq_length,
    }

    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())