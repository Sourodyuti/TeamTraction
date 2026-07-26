"""Knowledge base service — live lecture indexing with JSONL persistence.

Embeds text chunks into VectorAI DB and maintains an in-memory index
that is also persisted to JSONL files for restart recovery.
"""
import json
import logging
import threading
from pathlib import Path
from typing import Optional

from dependencies import get_embedder, get_vectorai
from models.schemas import LectureChunk

logger = logging.getLogger(__name__)

RECORDINGS_DIR = Path("recordings")


class KnowledgeBase:
    def __init__(self):
        # {lecture_id: [{chunk_id, topic_node, ts, text_preview}]}
        self._index: dict[int, list[dict]] = {}
        self._lock = threading.Lock()
        self._reload_from_disk()

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

            if embedder:
                vector, _ = embedder.encode_with_latency(text)
            else:
                vector = [0.0] * 384

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

            entry = {
                "chunk_id": chunk_id,
                "topic_node": topic_node,
                "ts": ts,
                "text_preview": text[:256],
                "lecture_id": lecture_id,
            }

            with self._lock:
                if lecture_id not in self._index:
                    self._index[lecture_id] = []

                self._index[lecture_id].append(entry)

                # Keep index sorted by ts for safety
                self._index[lecture_id].sort(key=lambda x: x["ts"])

            # Persist to JSONL
            self._append_to_jsonl(lecture_id, entry)

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

            if not embedder:
                return []

            query_vector, _ = embedder.encode_with_latency(query_text)

            hits = vectorai.search_similar(query_vector, limit=limit, filter={"lecture_id": lecture_id})
            return hits
        except Exception as e:
            logger.error("Search knowledge failed: %s", e)
            return []

    def get_all_chunks(self, lecture_id: int) -> list[dict]:
        """Returns all indexed chunks for a lecture, sorted by timestamp."""
        with self._lock:
            return list(self._index.get(lecture_id, []))

    # ─── JSONL persistence ────────────────────────────────────────

    def _append_to_jsonl(self, lecture_id: int, entry: dict) -> None:
        """Append a chunk entry to the JSONL file for persistence."""
        try:
            lecture_dir = RECORDINGS_DIR / str(lecture_id)
            lecture_dir.mkdir(parents=True, exist_ok=True)
            jsonl_path = lecture_dir / "kb_index.jsonl"
            with open(jsonl_path, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            logger.warning("JSONL append failed (non-fatal): %s", e)

    def _reload_from_disk(self) -> None:
        """Scan recordings/*/kb_index.jsonl and rebuild the in-memory index.

        Called on startup so the knowledge base survives server restarts.
        """
        if not RECORDINGS_DIR.exists():
            return

        loaded_total = 0
        for lecture_dir in RECORDINGS_DIR.iterdir():
            if not lecture_dir.is_dir():
                continue
            try:
                lecture_id = int(lecture_dir.name)
            except ValueError:
                continue

            jsonl_path = lecture_dir / "kb_index.jsonl"
            if not jsonl_path.exists():
                continue

            try:
                entries = []
                seen_ids = set()
                with open(jsonl_path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entry = json.loads(line)
                            # Deduplicate by chunk_id
                            cid = entry.get("chunk_id", "")
                            if cid and cid not in seen_ids:
                                seen_ids.add(cid)
                                entries.append(entry)
                        except json.JSONDecodeError:
                            continue

                if entries:
                    entries.sort(key=lambda x: x.get("ts", 0))
                    with self._lock:
                        self._index[lecture_id] = entries
                    loaded_total += len(entries)

            except Exception as e:
                logger.warning("Failed to load KB JSONL for lecture %d: %s", lecture_id, e)

        if loaded_total:
            logger.info("KnowledgeBase reloaded %d chunks from disk", loaded_total)


_knowledge_base = KnowledgeBase()

def get_knowledge_base() -> KnowledgeBase:
    return _knowledge_base
