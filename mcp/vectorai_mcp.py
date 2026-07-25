#!/usr/bin/env python3
"""
MCP Server for Actian VectorAI DB (Vector Retrieval).

Provides tools for:
- Creating/checking collections
- Upserting vectors with payloads
- Semantic similarity search
- Health checks

Run: python mcp/vectorai_mcp.py
"""

import json
import logging
import os
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment config
VECTORAI_HOST = os.getenv("VECTORAI_HOST", "localhost")
VECTORAI_PORT = int(os.getenv("VECTORAI_PORT", "6574"))
COLLECTION_NAME = "lecture_chunks"
VECTOR_DIM = 384

# Lazy-loaded Qdrant client
_qdrant_client = None


def get_qdrant_client():
    """Get or create the Qdrant (VectorAI DB) client."""
    global _qdrant_client
    if _qdrant_client is None:
        try:
            from qdrant_client import QdrantClient
            _qdrant_client = QdrantClient(
                host=VECTORAI_HOST,
                port=VECTORAI_PORT,
                prefer_grpc=True,
                timeout=10,
            )
            logger.info("Connected to VectorAI DB at %s:%d", VECTORAI_HOST, VECTORAI_PORT)
        except Exception as e:
            logger.error("Failed to connect to VectorAI DB: %s", e)
            raise
    return _qdrant_client


# Pydantic models for tool arguments
class CreateCollectionArgs(BaseModel):
    """Arguments for creating the lecture_chunks collection."""
    force_recreate: bool = Field(default=False, description="Drop and recreate if exists")


class UpsertChunksArgs(BaseModel):
    """Arguments for upserting lecture chunks."""
    points: list[dict] = Field(..., description="List of points with id, vector, payload")


class SearchSimilarArgs(BaseModel):
    """Arguments for semantic similarity search."""
    query_vector: list[float] = Field(..., description="384-dim query vector")
    limit: int = Field(default=3, description="Number of results to return")
    score_threshold: float = Field(default=0.0, description="Minimum similarity score")


class HealthCheckArgs(BaseModel):
    """Arguments for health check (empty)."""
    pass


# MCP Server
server = Server("legilimens-vectorai")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available VectorAI DB tools."""
    return [
        Tool(
            name="vectorai_create_collection",
            description="Create the lecture_chunks collection (384-dim, Cosine distance). Idempotent by default.",
            inputSchema=CreateCollectionArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_upsert_chunks",
            description="Upsert lecture chunks (vectors + payload) into the VectorAI DB collection.",
            inputSchema=UpsertChunksArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_search_similar",
            description="Semantic similarity search for the best past explanation of a concept.",
            inputSchema=SearchSimilarArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_health",
            description="Check if VectorAI DB is reachable.",
            inputSchema=HealthCheckArgs.model_json_schema(),
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute a VectorAI DB tool."""
    try:
        client = get_qdrant_client()

        if name == "vectorai_create_collection":
            args = CreateCollectionArgs(**arguments)
            return await _create_collection(client, args)

        elif name == "vectorai_upsert_chunks":
            args = UpsertChunksArgs(**arguments)
            return await _upsert_chunks(client, args)

        elif name == "vectorai_search_similar":
            args = SearchSimilarArgs(**arguments)
            return await _search_similar(client, args)

        elif name == "vectorai_health":
            return await _health_check(client)

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.exception("Tool %s failed: %s", name, e)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _create_collection(client, args: CreateCollectionArgs) -> list[TextContent]:
    """Create the lecture_chunks collection."""
    from qdrant_client.models import Distance, VectorParams

    if args.force_recreate:
        try:
            client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass

    collections = client.get_collections().collections
    existing = [c.name for c in collections]

    if COLLECTION_NAME in existing and not args.force_recreate:
        return [TextContent(type="text", text=f"Collection '{COLLECTION_NAME}' already exists")]

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
    )
    return [TextContent(type="text", text=f"Created collection '{COLLECTION_NAME}' (dim={VECTOR_DIM}, Cosine)")]


async def _upsert_chunks(client, args: UpsertChunksArgs) -> list[TextContent]:
    """Upsert lecture chunks into the collection."""
    from qdrant_client.models import PointStruct

    qdrant_points = []
    for p in args.points:
        point_id = p["id"]
        if isinstance(point_id, str):
            point_id = abs(hash(point_id)) % (2**63)
        qdrant_points.append(
            PointStruct(
                id=point_id,
                vector=p["vector"],
                payload=p.get("payload", {}),
            )
        )

    client.upsert(collection_name=COLLECTION_NAME, points=qdrant_points)
    return [TextContent(type="text", text=f"Upserted {len(qdrant_points)} points into '{COLLECTION_NAME}'")]


async def _search_similar(client, args: SearchSimilarArgs) -> list[TextContent]:
    """Search for similar vectors."""
    hits = client.query_points(
        collection_name=COLLECTION_NAME,
        query=args.query_vector,
        limit=args.limit,
        with_payload=True,
    )

    results = []
    for hit in hits.points:
        if hit.score >= args.score_threshold:
            results.append({
                "id": hit.id,
                "payload": hit.payload or {},
                "score": hit.score,
            })

    return [TextContent(type="text", text=json.dumps(results, indent=2))]


async def _health_check(client) -> list[TextContent]:
    """Health check for VectorAI DB."""
    try:
        client.get_collections()
        return [TextContent(type="text", text="VectorAI DB: HEALTHY")]
    except Exception as e:
        return [TextContent(type="text", text=f"VectorAI DB: UNHEALTHY - {e}")]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())