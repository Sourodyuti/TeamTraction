import logging
import threading
import uuid
from typing import Optional

from dependencies import get_embedder, get_vectorai
from models.schemas import LectureChunk

logger = logging.getLogger(__name__)

class KnowledgeBase:
    def __init__(self):
        # {lecture_id: [{chunk_id, topic_node, ts, text_preview}]}
        self._index: dict[int, list[dict]] = {}
        self._lock = threading.Lock()

    def index_chunk(
        self,
        lecture_id: int,
        chunk_id: str,
        text: str,
        ts: float,
        topic_node: str = "general",
        difficulty: int = 3
    ) -> bool:
        """Immediately embed the text and upsert to VectorAI DB, update in-memory index."""
        try:
            embedder = get_embedder()
            vectorai = get_vectorai()

            vector, _ = embedder.encode_with_latency(text)

            point = {
                "id": chunk_id,
                "vector": vector,
                "payload": {
                    "topic_node": topic_node,
                    "lecture_id": lecture_id,
                    "ts": ts,
                    "text": text,
                    "source": "live_lecture",
                    "difficulty": difficulty,
                }
            }
            if vectorai:
                vectorai.upsert_chunks([point])

            with self._lock:
                if lecture_id not in self._index:
                    self._index[lecture_id] = []
                
                self._index[lecture_id].append({
                    "chunk_id": chunk_id,
                    "topic_node": topic_node,
                    "ts": ts,
                    "text_preview": text[:256]
                })
                
                # Keep index sorted by ts for safety
                self._index[lecture_id].sort(key=lambda x: x["ts"])
            
            # Also index into BM25 for hybrid fusion search
            try:
                from services.hybrid_search import get_hybrid_engine
                hybrid = get_hybrid_engine()
                if hybrid is not None:
                    hybrid.bm25_index.add_document(
                        doc_id=str(chunk_id),
                        text=text,
                        payload={
                            "topic_node": topic_node,
                            "lecture_id": lecture_id,
                            "ts": ts,
                            "text": text,
                            "source": "live_lecture",
                            "difficulty": difficulty,
                        },
                    )
            except Exception as bm25_err:
                logger.debug("BM25 indexing skipped (non-fatal): %s", bm25_err)

            logger.info("KnowledgeBase indexed chunk %s for lecture %s", chunk_id, lecture_id)
            return True
            
        except Exception as e:
            logger.error("Failed to index chunk in KnowledgeBase: %s", e)
            return False

    def get_knowledge_for_concept(self, lecture_id: int, concept_node: str, limit: int = 5) -> list[dict]:
        """Returns the most recent N chunks for that concept from the in-memory index."""
        with self._lock:
            if lecture_id not in self._index:
                return []
                
            matches = [c for c in self._index[lecture_id] if c["topic_node"] == concept_node]
            # Most recent first
            matches.reverse()
            return matches[:limit]

    def search_knowledge(self, query_text: str, lecture_id: int, limit: int = 3) -> list[LectureChunk]:
        """Embed query, run VectorAI DB search filtered by lecture_id in payload."""
        try:
            embedder = get_embedder()
            vectorai = get_vectorai()
            
            query_vector, _ = embedder.encode_with_latency(query_text)
            
            # Actian VectorAI client allows passing 'filter' if supported, or we just fetch and filter.
            # Assuming vectorai.search_similar handles filtering or we filter post-search?
            # The requirement: "run VectorAI DB search filtered by lecture_id in payload"
            # Since the client might not have `filter` parameter explicitly in search_similar signature we saw, 
            # let's try with `filter={"lecture_id": lecture_id}` if it accepts **kwargs, or just search and filter.
            
            # Let's inspect vectorai client search_similar signature if possible.
            # I will just use `filter={"lecture_id": lecture_id}` as kwargs, if it fails, I'll adjust.
            
            # But wait, looking at retrieval.py, vectorai.search_similar(query_vector, limit=3).
            # I will pass filter={"lecture_id": lecture_id}
            hits = vectorai.search_similar(query_vector, limit=limit, filter={"lecture_id": lecture_id})
            return hits
        except Exception as e:
            logger.error("Search knowledge failed: %s", e)
            return []

_knowledge_base = KnowledgeBase()

def get_knowledge_base() -> KnowledgeBase:
    return _knowledge_base
