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
MULTIMODAL_COLLECTION_NAME = getattr(settings, "multimodal_collection", f"{COLLECTION_NAME}_multimodal")


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
        from qdrant_client import QdrantClient as _VectorAIClient

        logger.info("Connecting to Actian VectorAI DB at %s ...", self.address)
        self._client = _VectorAIClient(host=self.host, port=self.port)
        logger.info("VectorAI DB client connected")

    def close(self) -> None:
        """Close the client connection gracefully."""
        if self._client is not None:
            self._client.close()
            self._client = None
            logger.info("VectorAI DB client closed")

    def _get_client(self) -> Any:
        """Return the live client, reconnecting if necessary."""
        if self._client is None:
            self.connect()
        try:
            self._client.get_collections()
        except Exception:
            logger.warning("VectorAI DB connection lost, reconnecting...")
            self.connect()
        return self._client

    def create_lecture_chunks_collection(self) -> None:
        """Create the `lecture_chunks` collection (384-dim, Cosine). Idempotent."""
        from qdrant_client import VectorParams, Distance

        client = self._get_client()

        try:
            if client.collection_exists(COLLECTION_NAME):
                logger.info(
                    "Collection '%s' already exists — skipping creation",
                    COLLECTION_NAME,
                )
                return
        except Exception:
            pass

        try:
            client.create_collection(
                collection_name=COLLECTION_NAME,
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
        from qdrant_client import PointStruct

        client = self._get_client()

        import uuid
        actian_points = []
        for p in points:
            point_id = p["id"]
            if isinstance(point_id, str):
                point_id = int(uuid.uuid5(uuid.NAMESPACE_DNS, point_id).int & 0x7FFFFFFFFFFFFFFF)
            actian_points.append(
                PointStruct(
                    id=point_id,
                    vector=p["vector"],
                    payload=p.get("payload", {}),
                )
            )

        client.upsert(
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
                from qdrant_client.filters import Filter, FieldCondition, MatchValue
                conditions = [
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filter.items()
                ]
                search_kwargs["filter"] = Filter(must=conditions)
            except Exception:
                pass  # filter unsupported — search without it

        try:
            hits = client.search(**search_kwargs)
        except Exception:
            # Fallback: search without filter, filter in Python
            search_kwargs.pop("filter", None)
            search_kwargs["limit"] = limit * 5
            hits = client.search(**search_kwargs)
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

    def search_filtered(
        self,
        query_vector: list[float],
        limit: int = 3,
        topic_node: str | None = None,
        source: str | None = None,
        lecture_id: int | None = None,
        difficulty_min: int | None = None,
        difficulty_max: int | None = None,
        ts_min: float | None = None,
        ts_max: float | None = None,
    ) -> list[dict]:
        """Search with structured filters using VectorAI DB filters."""
        client = self._get_client()

        search_kwargs: dict = {
            "collection_name": COLLECTION_NAME,
            "vector": list(query_vector),
            "limit": limit,
            "with_payload": True,
        }

        try:
            from qdrant_client.filters import Filter, FieldCondition, MatchValue, Range
            must_conditions = []
            
            if topic_node is not None:
                must_conditions.append(FieldCondition(key="topic_node", match=MatchValue(value=topic_node)))
            if source is not None:
                must_conditions.append(FieldCondition(key="source", match=MatchValue(value=source)))
            if lecture_id is not None:
                must_conditions.append(FieldCondition(key="lecture_id", match=MatchValue(value=lecture_id)))
            
            if difficulty_min is not None or difficulty_max is not None:
                must_conditions.append(FieldCondition(
                    key="difficulty", 
                    range=Range(gte=difficulty_min, lte=difficulty_max)
                ))
            if ts_min is not None or ts_max is not None:
                must_conditions.append(FieldCondition(
                    key="ts", 
                    range=Range(gte=ts_min, lte=ts_max)
                ))
            
            if must_conditions:
                search_kwargs["query_filter"] = Filter(must=must_conditions)
                
            hits = client.search(**search_kwargs)
        except Exception:
            # Fallback to Python-side filtering
            search_kwargs.pop("query_filter", None)
            search_kwargs["limit"] = limit * 10
            hits = client.search(**search_kwargs)
            
            filtered_hits = []
            for hit in hits:
                payload = hit.payload or {}
                if topic_node is not None and payload.get("topic_node") != topic_node:
                    continue
                if source is not None and payload.get("source") != source:
                    continue
                if lecture_id is not None and payload.get("lecture_id") != lecture_id:
                    continue
                
                diff = payload.get("difficulty")
                if difficulty_min is not None and (diff is None or diff < difficulty_min):
                    continue
                if difficulty_max is not None and (diff is None or diff > difficulty_max):
                    continue
                    
                ts = payload.get("ts")
                if ts_min is not None and (ts is None or ts < ts_min):
                    continue
                if ts_max is not None and (ts is None or ts > ts_max):
                    continue
                    
                filtered_hits.append(hit)
                if len(filtered_hits) >= limit:
                    break
            hits = filtered_hits

        results = []
        for hit in hits:
            results.append({
                "id": hit.id,
                "payload": hit.payload or {},
                "score": hit.score,
            })
        return results

    def create_multimodal_collection(self) -> None:
        """Creates collection with named vectors: 'text' (384-dim, Cosine) + 'context' (384-dim, Cosine)"""
        from qdrant_client import VectorParams, Distance

        client = self._get_client()

        try:
            if client.collection_exists(MULTIMODAL_COLLECTION_NAME):
                logger.info(
                    "Collection '%s' already exists — skipping creation",
                    MULTIMODAL_COLLECTION_NAME,
                )
                return
        except Exception:
            pass

        try:
            client.create_collection(
                collection_name=MULTIMODAL_COLLECTION_NAME,
                vectors_config={
                    "text": VectorParams(size=384, distance=Distance.Cosine),
                    "context": VectorParams(size=384, distance=Distance.Cosine),
                },
            )
            logger.info("Created multimodal collection '%s'", MULTIMODAL_COLLECTION_NAME)
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("Collection '%s' already exists", MULTIMODAL_COLLECTION_NAME)
            else:
                raise

    def upsert_multimodal_chunks(self, points: list[dict]) -> None:
        """Upserts points with named vectors {"text": [...], "context": [...]}"""
        from qdrant_client import PointStruct

        client = self._get_client()
        import uuid
        actian_points = []
        for p in points:
            point_id = p["id"]
            if isinstance(point_id, str):
                point_id = int(uuid.uuid5(uuid.NAMESPACE_DNS, point_id).int & 0x7FFFFFFFFFFFFFFF)
            actian_points.append(
                PointStruct(
                    id=point_id,
                    vector=p["vector"],
                    payload=p.get("payload", {}),
                )
            )

        client.upsert(
            collection_name=MULTIMODAL_COLLECTION_NAME,
            points=actian_points,
        )
        logger.info("Upserted %d multimodal points into '%s'", len(actian_points), MULTIMODAL_COLLECTION_NAME)

    def search_multimodal(
        self, query_vector: list[float], vector_name: str, limit: int = 3, filter: dict | None = None
    ) -> list[dict]:
        """Searches a specific named vector."""
        client = self._get_client()

        search_kwargs: dict = {
            "collection_name": MULTIMODAL_COLLECTION_NAME,
            "vector": (vector_name, list(query_vector)),
            "limit": limit,
            "with_payload": True,
        }

        if filter:
            try:
                from qdrant_client.filters import Filter, FieldCondition, MatchValue
                conditions = [
                    FieldCondition(key=k, match=MatchValue(value=v))
                    for k, v in filter.items()
                ]
                search_kwargs["filter"] = Filter(must=conditions)
            except Exception:
                pass

        try:
            hits = client.search(**search_kwargs)
        except Exception:
            search_kwargs.pop("filter", None)
            search_kwargs["limit"] = limit * 5
            hits = client.search(**search_kwargs)
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

    def search_cross_modal(
        self, 
        text_vector: list[float], 
        context_vector: list[float], 
        limit: int = 3, 
        text_weight: float = 1.0, 
        context_weight: float = 1.0
    ) -> list[dict]:
        """Searches both vectors and combines scores."""
        text_results = self.search_multimodal(text_vector, "text", limit=limit * 5)
        context_results = self.search_multimodal(context_vector, "context", limit=limit * 5)
        
        combined_scores = {}
        payloads = {}
        
        for r in text_results:
            combined_scores[r["id"]] = r["score"] * text_weight
            payloads[r["id"]] = r["payload"]
            
        for r in context_results:
            if r["id"] in combined_scores:
                combined_scores[r["id"]] += r["score"] * context_weight
            else:
                combined_scores[r["id"]] = r["score"] * context_weight
                payloads[r["id"]] = r["payload"]
                
        sorted_ids = sorted(combined_scores.keys(), key=lambda k: combined_scores[k], reverse=True)[:limit]
        
        results = []
        for cid in sorted_ids:
            results.append({
                "id": cid,
                "payload": payloads[cid],
                "score": combined_scores[cid]
            })
        return results

    def health(self) -> bool:
        """Return True if the VectorAI DB is reachable."""
        try:
            client = self._get_client()
            info = client.get_collections()
            return bool(info)
        except Exception:
            return False

    def __enter__(self) -> "VectorAIClient":
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
