#!/usr/bin/env python3
"""
MCP Server for Actian VectorAI DB (Qdrant).

Provides tools for:
- Collection management
- Vector upsert and search
- Health checks

Run: python mcp/vectorai_db_mcp.py
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
VECTORAI_PORT = int(os.getenv("VECTORAI_PORT", "6574"))  # gRPC port
COLLECTION_NAME = os.getenv("VECTORAI_COLLECTION", "lecture_chunks")
VECTOR_DIM = int(os.getenv("VECTORAI_DIM", "384"))

# Lazy-loaded client
_qdrant_client = None


def get_qdrant_client():
    """Get or create Qdrant client."""
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
            logger.info("Connected to VectorAI DB (Qdrant) at %s:%d", VECTORAI_HOST, VECTORAI_PORT)
        except Exception as e:
            logger.error("Failed to connect to VectorAI DB: %s", e)
            raise
    return _qdrant_client


# Pydantic models for tool arguments
class CreateCollectionArgs(BaseModel):
    """Arguments for creating a collection."""
    collection_name: str = Field(default=COLLECTION_NAME)
    vector_dim: int = Field(default=VECTOR_DIM)
    distance: str = Field(default="Cosine")  # Cosine, Dot, Euclid


class UpsertPointsArgs(BaseModel):
    """Arguments for upserting points."""
    points: list[dict]  # Each: {"id": str|int, "vector": list[float], "payload": dict}
    collection_name: str = Field(default=COLLECTION_NAME)


class SearchSimilarArgs(BaseModel):
    """Arguments for similarity search."""
    query_vector: list[float]
    limit: int = 3
    collection_name: str = Field(default=COLLECTION_NAME)
    score_threshold: float | None = None


class GetCollectionsArgs(BaseModel):
    """Arguments for listing collections (empty)."""
    pass


class GetCollectionInfoArgs(BaseModel):
    """Arguments for getting collection info."""
    collection_name: str = Field(default=COLLECTION_NAME)


class DeletePointsArgs(BaseModel):
    """Arguments for deleting points by IDs."""
    ids: list[str | int]
    collection_name: str = Field(default=COLLECTION_NAME)


class HealthCheckArgs(BaseModel):
    """Arguments for health check (empty)."""
    pass


# MCP Server
server = Server("legilimens-vectorai-db")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available VectorAI DB tools."""
    return [
        Tool(
            name="vectorai_create_collection",
            description="Create a vector collection (idempotent).",
            inputSchema=CreateCollectionArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_upsert_points",
            description="Upsert vectors with payload into the collection.",
            inputSchema=UpsertPointsArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_search_similar",
            description="Semantic similarity search (cosine) for retrieval.",
            inputSchema=SearchSimilarArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_get_collections",
            description="List all collections in VectorAI DB.",
            inputSchema=GetCollectionsArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_get_collection_info",
            description="Get collection info (vectors count, config).",
            inputSchema=GetCollectionInfoArgs.model_json_schema(),
        ),
        Tool(
            name="vectorai_delete_points",
            description="Delete points by IDs.",
            inputSchema=DeletePointsArgs.model_json_schema(),
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
        if name == "vectorai_create_collection":
            args = CreateCollectionArgs(**arguments)
            return await _create_collection(args)

        elif name == "vectorai_upsert_points":
            args = UpsertPointsArgs(**arguments)
            return await _upsert_points(args)

        elif name == "vectorai_search_similar":
            args = SearchSimilarArgs(**arguments)
            return await _search_similar(args)

        elif name == "vectorai_get_collections":
            return await _get_collections()

        elif name == "vectorai_get_collection_info":
            args = GetCollectionInfoArgs(**arguments)
            return await _get_collection_info(args)

        elif name == "vectorai_delete_points":
            args = DeletePointsArgs(**arguments)
            return await _delete_points(args)

        elif name == "vectorai_health":
            return await _health_check()

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.exception("Tool %s failed: %s", name, e)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _create_collection(args: CreateCollectionArgs) -> list[TextContent]:
    """Create a vector collection."""
    from qdrant_client.models import Distance, VectorParams

    client = get_qdrant_client()

    # Check if exists
    collections = client.get_collections().collections
    existing = [c.name for c in collections]

    if args.collection_name in existing:
        return [TextContent(type="text", text=f"Collection '{args.collection_name}' already exists")]

    # Map distance string to enum
    distance_map = {"Cosine": Distance.COSINE, "Dot": Distance.DOT, "Euclid": Distance.EUCLID}
    distance = distance_map.get(args.distance, Distance.COSINE)

    client.create_collection(
        collection_name=args.collection_name,
        vectors_config=VectorParams(size=args.vector_dim, distance=distance),
    )

    return [TextContent(type="text", text=f"Created collection '{args.collection_name}' (dim={args.vector_dim}, {args.distance})")]


async def _upsert_points(args: UpsertPointsArgs) -> list[TextContent]:
    """Upsert points into the collection."""
    from qdrant_client.models import PointStruct

    client = get_qdrant_client()

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

    client.upsert(collection_name=args.collection_name, points=qdrant_points)

    return [TextContent(type="text", text=f"Upserted {len(qdrant_points)} points into '{args.collection_name}'")]


async def _search_similar(args: SearchSimilarArgs) -> list[TextContent]:
    """Semantic similarity search."""
    client = get_qdrant_client()

    hits = client.query_points(
        collection_name=args.collection_name,
        query=args.query_vector,
        limit=args.limit,
        with_payload=True,
        score_threshold=args.score_threshold,
    )

    results = []
    for hit in hits.points:
        results.append({
            "id": hit.id,
            "payload": hit.payload or {},
            "score": hit.score,
        })

    return [TextContent(type="text", text=json.dumps(results, indent=2))]


async def _get_collections() -> list[TextContent]:
    """List all collections."""
    client = get_qdrant_client()
    collections = client.get_collections().collections
    result = [{"name": c.name, "vectors_count": c.vectors_count, "points_count": c.points_count} for c in collections]
    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def _get_collection_info(args: GetCollectionInfoArgs) -> list[TextContent]:
    """Get detailed collection info."""
    client = get_qdrant_client()
    info = client.get_collection(args.collection_name)
    result = {
        "name": info.config.params.vectors.size if info.config.params.vectors else "unknown",
        "dim": info.config.params.vectors.size if info.config.params.vectors else 0,
        "distance": str(info.config.params.vectors.distance) if info.config.params.vectors else "unknown",
        "vectors_count": info.vectors_count,
        "points_count": info.points_count,
        "segments_count": info.segments_count,
        "status": str(info.status),
    }
    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def _delete_points(args: DeletePointsArgs) -> list[TextContent]:
    """Delete points by IDs."""
    from qdrant_client.models import PointIdsList

    client = get_qdrant_client()

    point_ids = []
    for pid in args.ids:
        if isinstance(pid, str):
            pid = abs(hash(pid)) % (2**63)
        point_ids.append(pid)

    client.delete(collection_name=args.collection_name, points_selector=PointIdsList(points=point_ids))

    return [TextContent(type="text", text=f"Deleted {len(point_ids)} points from '{args.collection_name}'")]


async def _health_check() -> list[TextContent]:
    """Health check for VectorAI DB."""
    try:
        client = get_qdrant_client()
        client.get_collections()
        return [TextContent(type="text", text="VectorAI DB (Qdrant): HEALTHY")]
    except Exception as e:
        return [TextContent(type="text", text=f"VectorAI DB (Qdrant): UNHEALTHY - {e}")]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())