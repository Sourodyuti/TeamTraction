"""bge-small-en embedder — on-prem, 384-dim, CPU (Phase 1).

Wraps `sentence_transformers` for local embeddings. Runs on CPU — no GPU needed.
The model is small (~33M params) and fast enough for live chunking.

First run downloads the model (~100MB); after that it's cached locally.
Pre-download before the hackathon to avoid venue Wi-Fi issues.
"""
from __future__ import annotations

import time


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
            # TODO Phase 1: Uncomment and verify
            # from sentence_transformers import SentenceTransformer
            # self._model = SentenceTransformer("BAAI/bge-small-en")
            raise NotImplementedError("TODO Phase 1: load BAAI/bge-small-en")
        return self._model

    @property
    def dim(self) -> int:
        """Embedding dimension — should always be 384 for bge-small-en."""
        return 384

    def encode(self, text: str | list[str]) -> list[list[float]]:
        """Encode one or more texts into 384-dim vectors.

        Returns a list of vectors (each a list of 384 floats).

        TODO Phase 1: Implement using self.model.encode().
        """
        raise NotImplementedError("TODO Phase 1")

    def encode_with_latency(self, text: str) -> tuple[list[float], float]:
        """Encode a single text and return (vector, latency_ms).

        Used by the retrieval pipeline to measure embedding latency for the
        on-screen badge.
        """
        start = time.perf_counter()
        vec = self.encode(text)[0]
        elapsed_ms = (time.perf_counter() - start) * 1000
        return vec, elapsed_ms
