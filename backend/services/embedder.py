"""bge-small-en embedder — on-prem, 384-dim, CPU (Phase 1).

Wraps `sentence_transformers` for local embeddings. Runs on CPU — no GPU needed.
The model is small (~33M params) and fast enough for live chunking.

First run downloads the model (~100MB); after that it's cached locally.
Pre-download before the hackathon to avoid venue Wi-Fi issues.
"""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

# Model name — v1.5 is strictly better than v1.0, same 384-dim output.
_MODEL_NAME = "BAAI/bge-small-en-v1.5"


class Embedder:
    """Singleton wrapper for bge-small-en sentence embeddings."""

    _instance = None
    _model = None

    def __new__(cls) -> "Embedder":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model: %s ...", _MODEL_NAME)
            self._model = SentenceTransformer(_MODEL_NAME)
            logger.info("Embedding model loaded (dim=%d)", self.dim)
        return self._model

    @property
    def dim(self) -> int:
        """Embedding dimension — should always be 384 for bge-small-en."""
        return 384

    def encode(self, text: str | list[str]) -> list[list[float]]:
        """Encode one or more texts into 384-dim vectors.

        Returns a list of vectors (each a list of 384 floats).
        bge-small recommends prepending "Represent this sentence: " for
        retrieval, but for simplicity we skip it — performance is fine without.
        """
        if isinstance(text, str):
            text = [text]
        # normalize_embeddings=True gives unit vectors → cosine sim = dot product
        embeddings = self.model.encode(
            text, normalize_embeddings=True, show_progress_bar=False
        )
        return [emb.tolist() for emb in embeddings]

    def encode_with_latency(self, text: str) -> tuple[list[float], float]:
        """Encode a single text and return (vector, latency_ms).

        Used by the retrieval pipeline to measure embedding latency for the
        on-screen badge.
        """
        start = time.perf_counter()
        vec = self.encode(text)[0]
        elapsed_ms = (time.perf_counter() - start) * 1000
        return vec, elapsed_ms
