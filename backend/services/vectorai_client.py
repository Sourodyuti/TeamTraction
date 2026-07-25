"""Actian VectorAI DB client — the retrieval brain (Phase 1+).

Under the hood, Actian VectorAI DB is Qdrant. We use the `qdrant-client`
Python SDK (gRPC on :6574). The class name and interface match the blueprint's
contract so the BE lead's routers don't need to change.

Manages the `lecture_chunks` collection: create, upsert, search, health.
"""
from __future__ import annotations

import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

# Collection constants
COLLECTION_NAME = "lecture_chunks"
VECTOR_DIM = 384  # bge-small-en output


class VectorAIClient:
    """Thin wrapper around Qdrant (Actian VectorAI DB) for Legilimens retrieval.

    Interface contract (from TODO-ai-ml.md):
        connect() -> None
        create_lecture_chunks_collection() -> None
        upsert_chunks(points: list[dict]) -> None
        search_similar(query_vector, limit=3) -> list[dict]
        close() -> None
        health() -> bool
    """

    def __init__(self) -> None:
        self.host = settings.vectorai_host
        self.port = settings.vectorai_port
        self._client = None

    @property
    def address(self) -> str:
        return f"{self.host}:{self.port}"

    # ─── Lifecycle ─────────────────────────────────────────────────

    def connect(self) -> None:
        """Initialize the Qdrant (VectorAI DB) client connection."""
        from qdrant_client import QdrantClient

        logger.info("Connecting to VectorAI DB (Qdrant) at %s ...", self.address)
        self._client = QdrantClient(
            host=self.host,
            port=self.port,
            # prefer_grpc=True for gRPC on 6574; set False if using REST on 6573
            prefer_grpc=True,
            timeout=10,
        )
        logger.info("VectorAI DB client connected")

    def close(self) -> None:
        """Close the client connection gracefully."""
        if self._client is not None:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
            logger.info("VectorAI DB client closed")

    def _get_client(self) -> Any:
        """Return the live client, raising if not connected."""
        if self._client is None:
            raise RuntimeError(
                "VectorAI client not connected — call connect() first"
            )
        return self._client

    # ─── Collection lifecycle ─────────────────────────────────────

    def create_lecture_chunks_collection(self) -> None:
        """Create the `lecture_chunks` collection (384-dim, Cosine). Idempotent."""
        from qdrant_client.models import Distance, VectorParams

        client = self._get_client()

        # Check if collection already exists
        collections = client.get_collections().collections
        existing = [c.name for c in collections]
        if COLLECTION_NAME in existing:
            logger.info(
                "Collection '%s' already exists — skipping creation",
                COLLECTION_NAME,
            )
            return

        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_DIM,
                distance=Distance.COSINE,
            ),
        )
        logger.info(
            "Created collection '%s' (dim=%d, cosine)", COLLECTION_NAME, VECTOR_DIM
        )

    # ─── Write ────────────────────────────────────────────────────

    def upsert_chunks(self, points: list[dict]) -> None:
        """Upsert lecture chunks (vectors + payload) into the collection.

        Each point: {"id": str|int, "vector": list[float], "payload": dict}

        String IDs are hashed to int (Qdrant uses int or UUID point IDs).
        """
        from qdrant_client.models import PointStruct

        client = self._get_client()

        qdrant_points = []
        for p in points:
            point_id = p["id"]
            # Qdrant accepts int or UUID ids; hash strings to int
            if isinstance(point_id, str):
                point_id = abs(hash(point_id)) % (2**63)
            qdrant_points.append(
                PointStruct(
                    id=point_id,
                    vector=p["vector"],
                    payload=p.get("payload", {}),
                )
            )

        client.upsert(
            collection_name=COLLECTION_NAME,
            points=qdrant_points,
        )
        logger.info("Upserted %d points into '%s'", len(qdrant_points), COLLECTION_NAME)

    # ─── Search ───────────────────────────────────────────────────

    def search_similar(
        self, query_vector: list[float], limit: int = 3
    ) -> list[dict]:
        """Semantic similarity search for the best past explanation.

        Returns list of {"id": ..., "payload": {...}, "score": float}.
        """
        client = self._get_client()

        hits = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=limit,
            with_payload=True,
        )

        results = []
        for hit in hits.points:
            results.append(
                {
                    "id": hit.id,
                    "payload": hit.payload or {},
                    "score": hit.score,
                }
            )
        return results

    # ─── Health check ─────────────────────────────────────────────

    def health(self) -> bool:
        """Return True if the VectorAI DB is reachable."""
        try:
            client = self._get_client()
            # Simple heartbeat — list collections
            client.get_collections()
            return True
        except Exception:
            return False
