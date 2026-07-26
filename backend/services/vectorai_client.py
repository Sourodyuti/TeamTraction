"""Actian VectorAI DB client — the retrieval brain.

Uses the official `actian-vectorai-client` SDK.
Manages the `lecture_chunks` collection: create, upsert, search, health.
"""
from __future__ import annotations

import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = settings.vectorai_collection
VECTOR_DIM = settings.vectorai_dim


class VectorAIClient:
    """Actian VectorAI DB client for Legilimens retrieval.

    Uses context manager for connection handling.
    """

    def __init__(self) -> None:
        self.host = settings.vectorai_host
        self.port = settings.vectorai_port
        self._client = None
        self._context = None

    @property
    def address(self) -> str:
        return f"{self.host}:{self.port}"

    def connect(self) -> None:
        """Initialize the VectorAI DB client connection."""
        from actian_vectorai import VectorAIClient as _VectorAIClient

        logger.info("Connecting to Actian VectorAI DB at %s ...", self.address)
        self._context = _VectorAIClient(self.address)
        self._client = self._context.__enter__()
        logger.info("VectorAI DB client connected")

    def close(self) -> None:
        """Close the client connection gracefully."""
        if self._context is not None:
            try:
                self._context.__exit__(None, None, None)
            except Exception:
                pass
            self._context = None
            self._client = None
            logger.info("VectorAI DB client closed")

    def _get_client(self) -> Any:
        """Return the live client, raising if not connected."""
        if self._client is None:
            raise RuntimeError(
                "VectorAI client not connected — call connect() first"
            )
        return self._client

    def create_lecture_chunks_collection(self) -> None:
        """Create the `lecture_chunks` collection (384-dim, Cosine). Idempotent."""
        from actian_vectorai import VectorParams, Distance

        client = self._get_client()

        try:
            if client.collections.exists(COLLECTION_NAME):
                logger.info(
                    "Collection '%s' already exists — skipping creation",
                    COLLECTION_NAME,
                )
                return
        except Exception:
            pass

        try:
            client.collections.create(
                COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=VECTOR_DIM,
                    distance=Distance.Cosine,
                ),
            )
            logger.info(
                "Created collection '%s' (dim=%d, cosine)", COLLECTION_NAME, VECTOR_DIM
            )
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("Collection '%s' already exists", COLLECTION_NAME)
            else:
                raise

    def upsert_chunks(self, points: list[dict]) -> None:
        """Upsert lecture chunks (vectors + payload) into the collection.

        Each point: {"id": str|int, "vector": list[float], "payload": dict}
        """
        from actian_vectorai import PointStruct

        client = self._get_client()

        actian_points = []
        for p in points:
            point_id = p["id"]
            if isinstance(point_id, str):
                point_id = abs(hash(point_id)) % (2**63)
            actian_points.append(
                PointStruct(
                    id=point_id,
                    vector=p["vector"],
                    payload=p.get("payload", {}),
                )
            )

        client.points.upsert(
            collection_name=COLLECTION_NAME,
            points=actian_points,
        )
        logger.info("Upserted %d points into '%s'", len(actian_points), COLLECTION_NAME)

    def search_similar(
        self, query_vector: list[float], limit: int = 3, filter: dict | None = None
    ) -> list[dict]:
        """Semantic similarity search for the best past explanation.

        Returns list of {"id": ..., "payload": {...}, "score": float}.
        """
        client = self._get_client()

        search_kwargs: dict = {
            "collection_name": COLLECTION_NAME,
            "vector": list(query_vector),
            "limit": limit,
            "with_payload": True,
        }

        if filter:
            try:
                from actian_vectorai.filters import Filter, FieldCondition, MatchValue
                conditions = [
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filter.items()
                ]
                search_kwargs["filter"] = Filter(must=conditions)
            except Exception:
                pass  # filter unsupported — search without it

        try:
            hits = client.points.search(**search_kwargs)
        except Exception:
            # Fallback: search without filter, filter in Python
            search_kwargs.pop("filter", None)
            search_kwargs["limit"] = limit * 5
            hits = client.points.search(**search_kwargs)
            if filter:
                hits = [
                    p for p in hits
                    if p.payload and all(p.payload.get(k) == v for k, v in filter.items())
                ][:limit]

        results = []
        for hit in hits:
            results.append({
                "id": hit.id,
                "payload": hit.payload or {},
                "score": hit.score,
            })
        return results

    def health(self) -> bool:
        """Return True if the VectorAI DB is reachable."""
        try:
            client = self._get_client()
            info = client.health_check()
            return bool(info)
        except Exception:
            return False

    def __enter__(self) -> "VectorAIClient":
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
