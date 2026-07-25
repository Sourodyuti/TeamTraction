"""Actian VectorAI DB client — the retrieval brain (Phase 1+).

Wraps the `actian_vectorai` Python SDK (gRPC on :6574).
Manages the `lecture_chunks` collection: create, upsert, search.

Usage pattern (from the blueprint):
    with VectorAIClient("localhost:6574") as client:
        client.collections.create("lecture_chunks",
            vectors_config=VectorParams(size=384, distance=Distance.Cosine))
        client.points.upsert("lecture_chunks", points=[...])
        hits = client.search("lecture_chunks", query_vector=q, limit=3, with_payload=True)
"""
from __future__ import annotations

from typing import Any

from config import settings


class VectorAIClient:
    """Thin wrapper around Actian VectorAI DB for Legilimens retrieval.

    TODO Phase 0: Verify that the SDK import and API match the documented pattern.
        The blueprint references `from actian_vectorai import VectorAIClient, VectorParams, Distance`.
        Confirm against the installed SDK's actual API surface.
    """

    def __init__(self) -> None:
        self.host = settings.vectorai_host
        self.port = settings.vectorai_port
        self._client = None

    @property
    def address(self) -> str:
        return f"{self.host}:{self.port}"

    def _get_client(self) -> Any:
        """Lazy-initialize the VectorAI DB client connection."""
        if self._client is None:
            # TODO Phase 0: from actian_vectorai import VectorAIClient
            #   self._client = VectorAIClient(self.address)
            raise NotImplementedError("TODO Phase 0: connect actian_vectorai SDK")
        return self._client

    # ─── Collection lifecycle ─────────────────────────────────────

    def create_lecture_chunks_collection(self) -> None:
        """Create the `lecture_chunks` collection (384-dim, Cosine). Idempotent."""
        # TODO Phase 0: implement
        #   client.collections.create("lecture_chunks",
        #       vectors_config=VectorParams(size=384, distance=Distance.Cosine))
        raise NotImplementedError("TODO Phase 0")

    # ─── Write ────────────────────────────────────────────────────

    def upsert_chunks(self, points: list[dict]) -> None:
        """Upsert lecture chunks (vectors + payload) into the collection.

        Each point: {"id": str, "vector": list[float], "payload": dict}
        """
        # TODO Phase 1: implement
        #   client.points.upsert("lecture_chunks", points=points)
        raise NotImplementedError("TODO Phase 1")

    # ─── Search ───────────────────────────────────────────────────

    def search_similar(self, query_vector: list[float], limit: int = 3) -> list[dict]:
        """Semantic similarity search for the best past explanation.

        Returns list of {"id": str, "vector": ..., "payload": {...}, "score": float}.
        """
        # TODO Phase 4: implement
        #   hits = client.search("lecture_chunks",
        #       query_vector=query_vector, limit=limit, with_payload=True)
        raise NotImplementedError("TODO Phase 4")

    # ─── Health check ─────────────────────────────────────────────

    def health(self) -> bool:
        """Return True if the VectorAI DB is reachable."""
        try:
            self._get_client()
            return True
        except Exception:
            return False
