from __future__ import annotations

import logging
import math
import time
from collections import defaultdict
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from services.embedder import Embedder
    from services.vectorai_client import VectorAIClient

logger = logging.getLogger(__name__)

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't",
    "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have",
    "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
    "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
    "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should",
    "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
    "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where",
    "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
}

def tokenize(text: str) -> list[str]:
    """Tokenize text using basic whitespace splitting, lowercase, and stopword filtering."""
    # A simple tokenization logic suitable for basic BM25 keyword search
    clean_text = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in text.lower())
    tokens = clean_text.split()
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]

class BM25Index:
    """An in-memory BM25 index for keyword search."""
    
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_lengths: dict[str, int] = {}
        self.doc_payloads: dict[str, dict[str, Any]] = {}
        # Mapping from term -> doc_id -> count
        self.term_freqs: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.doc_freqs: dict[str, int] = defaultdict(int)
        self.avgdl = 0.0
        self.N = 0

    def add_document(self, doc_id: str, text: str, payload: dict[str, Any]) -> None:
        """Add a document to the index."""
        if doc_id in self.doc_lengths:
            return  # Basic idempotency check

        tokens = tokenize(text)
        length = len(tokens)
        self.doc_lengths[doc_id] = length
        self.doc_payloads[doc_id] = payload
        
        term_counts = defaultdict(int)
        for token in tokens:
            term_counts[token] += 1
            
        for term, count in term_counts.items():
            self.term_freqs[term][doc_id] = count
            self.doc_freqs[term] += 1
            
        # Update running average length and document count
        total_len = (self.avgdl * self.N) + length
        self.N += 1
        self.avgdl = total_len / self.N

    def _idf(self, q: str) -> float:
        """Calculate the Inverse Document Frequency of a term."""
        n_q = self.doc_freqs.get(q, 0)
        # BM25 IDF formula
        idf_val = math.log((self.N - n_q + 0.5) / (n_q + 0.5) + 1.0)
        return idf_val if idf_val > 0 else 0.0

    def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """Search the BM25 index for the query."""
        if self.N == 0:
            return []
            
        tokens = tokenize(query)
        if not tokens:
            return []

        scores: dict[str, float] = defaultdict(float)
        
        for token in set(tokens):
            if token not in self.term_freqs:
                continue
                
            idf = self._idf(token)
            for doc_id, tf in self.term_freqs[token].items():
                dl = self.doc_lengths[doc_id]
                # BM25 term frequency normalization
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * (dl / self.avgdl))
                scores[doc_id] += idf * (numerator / denominator)

        # Sort descending by score
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        results = []
        for doc_id, score in sorted_docs[:limit]:
            results.append({
                "id": doc_id,
                "payload": self.doc_payloads.get(doc_id, {}),
                "score": score
            })
            
        return results


def reciprocal_rank_fusion(
    semantic_results: list[dict[str, Any]], 
    keyword_results: list[dict[str, Any]], 
    alpha: float, 
    k: int, 
    limit: int
) -> list[dict[str, Any]]:
    """
    Combine semantic and keyword search results using Reciprocal Rank Fusion.
    alpha: weight of semantic vs keyword (0.0 = pure keyword, 1.0 = pure semantic)
    k: scaling factor for RRF (default typically 60)
    """
    merged_docs = {}

    # Rank semantic results
    for rank, res in enumerate(semantic_results, start=1):
        doc_id = res["id"]
        if doc_id not in merged_docs:
            merged_docs[doc_id] = {
                "id": doc_id,
                "payload": res.get("payload", {}),
                "semantic_score": res["score"],
                "keyword_score": 0.0,
                "semantic_rank": rank,
                "keyword_rank": float('inf'),
            }
        else:
            merged_docs[doc_id]["semantic_score"] = res["score"]
            merged_docs[doc_id]["semantic_rank"] = rank

    # Rank keyword results
    for rank, res in enumerate(keyword_results, start=1):
        doc_id = res["id"]
        if doc_id not in merged_docs:
            merged_docs[doc_id] = {
                "id": doc_id,
                "payload": res.get("payload", {}),
                "semantic_score": 0.0,
                "keyword_score": res["score"],
                "semantic_rank": float('inf'),
                "keyword_rank": rank,
            }
        else:
            merged_docs[doc_id]["keyword_score"] = res["score"]
            merged_docs[doc_id]["keyword_rank"] = rank

    # Calculate final RRF scores
    final_results = []
    for doc in merged_docs.values():
        semantic_rrf = 1.0 / (k + doc["semantic_rank"]) if doc["semantic_rank"] != float('inf') else 0.0
        keyword_rrf = 1.0 / (k + doc["keyword_rank"]) if doc["keyword_rank"] != float('inf') else 0.0
        
        final_score = alpha * semantic_rrf + (1 - alpha) * keyword_rrf
        
        final_results.append({
            "id": doc["id"],
            "payload": doc["payload"],
            "score": final_score,
            "semantic_score": doc["semantic_score"],
            "keyword_score": doc["keyword_score"],
            "fusion_method": "rrf"
        })

    # Sort descending by final fused score
    final_results.sort(key=lambda x: x["score"], reverse=True)
    return final_results[:limit]


class HybridSearchEngine:
    """Orchestrator for hybrid search using VectorAI and BM25 with RRF."""
    
    def __init__(self, vectorai_client: VectorAIClient, embedder: Embedder, bm25_index: BM25Index):
        self.vectorai_client = vectorai_client
        self.embedder = embedder
        self.bm25_index = bm25_index

    def index_document(self, doc_id: str, text: str, vector: list[float], payload: dict[str, Any]) -> None:
        """Index a document into both BM25 and VectorAI (Note: VectorAI indexing might be handled externally)."""
        self.bm25_index.add_document(doc_id, text, payload)
        # Assumes vectorai_client is either already updated or handles its own upsert logic elsewhere,
        # but if we wanted, we could call self.vectorai_client.upsert(...) here.

    def search(self, query_text: str, limit: int = 10, alpha: float = 0.6, filter: dict | None = None) -> list[dict[str, Any]]:
        """Run both searches and fuse with RRF."""
        results, _ = self.search_with_latency(query_text, limit=limit, alpha=alpha, filter=filter)
        return results

    def search_with_latency(self, query_text: str, limit: int = 10, alpha: float = 0.6, filter: dict | None = None) -> tuple[list[dict[str, Any]], dict[str, float]]:
        """Run hybrid search and return results along with detailed latency metrics."""
        t_start = time.perf_counter()
        
        # 1. Embedding
        t_embed_start = time.perf_counter()
        # Fallback handling if encode_with_latency doesn't exist or isn't used
        if hasattr(self.embedder, "encode_with_latency"):
            query_vector, embed_ms = self.embedder.encode_with_latency(query_text)
        else:
            query_vectors = self.embedder.encode([query_text])
            query_vector = query_vectors[0]
            embed_ms = (time.perf_counter() - t_embed_start) * 1000.0

        # 2. Semantic Search
        t_sem_start = time.perf_counter()
        semantic_results = self.vectorai_client.search_similar(query_vector=query_vector, limit=limit * 2, filter=filter)
        semantic_ms = (time.perf_counter() - t_sem_start) * 1000.0

        # 3. Keyword Search (Degrades gracefully if empty or alpha = 1.0)
        t_kw_start = time.perf_counter()
        keyword_results = []
        if alpha < 1.0 and self.bm25_index.N > 0:
            keyword_results = self.bm25_index.search(query_text, limit=limit * 2)
            # Currently BM25 does not support complex dict filtering here without additional logic, 
            # assuming it matches standard behavior.
        keyword_ms = (time.perf_counter() - t_kw_start) * 1000.0

        # 4. Fusion
        t_fuse_start = time.perf_counter()
        # If BM25 is empty, fallback to pure semantic (or vice versa if vector fails)
        if not keyword_results and semantic_results:
            # Fallback to pure semantic results, structured similarly to RRF output
            results = []
            for rank, r in enumerate(semantic_results, start=1):
                results.append({
                    "id": r["id"],
                    "payload": r.get("payload", {}),
                    "score": r["score"],
                    "semantic_score": r["score"],
                    "keyword_score": 0.0,
                    "fusion_method": "semantic_only"
                })
            results = results[:limit]
        else:
            results = reciprocal_rank_fusion(
                semantic_results=semantic_results,
                keyword_results=keyword_results,
                alpha=alpha,
                k=60,
                limit=limit
            )
        fusion_ms = (time.perf_counter() - t_fuse_start) * 1000.0
        
        total_ms = (time.perf_counter() - t_start) * 1000.0
        
        latency = {
            "embedding_ms": embed_ms,
            "semantic_ms": semantic_ms,
            "keyword_ms": keyword_ms,
            "fusion_ms": fusion_ms,
            "total_ms": total_ms
        }
        
        return results, latency


_hybrid_engine: HybridSearchEngine | None = None

def get_hybrid_engine() -> HybridSearchEngine | None:
    return _hybrid_engine

def set_hybrid_engine(engine: HybridSearchEngine | None) -> None:
    global _hybrid_engine
    _hybrid_engine = engine
