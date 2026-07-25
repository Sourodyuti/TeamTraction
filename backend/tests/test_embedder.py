"""Tests for the bge-small-en embedder service."""
from __future__ import annotations

import pytest


class TestEmbedder:
    """Test the Embedder singleton wrapper."""

    def test_singleton(self):
        """Embedder should return the same instance on multiple calls."""
        from services.embedder import Embedder

        e1 = Embedder()
        e2 = Embedder()
        assert e1 is e2

    def test_dim_property(self):
        """Dimension should always be 384."""
        from services.embedder import Embedder

        e = Embedder()
        assert e.dim == 384

    def test_encode_single(self):
        """Encoding a single string should return a list with one 384-dim vector."""
        from services.embedder import Embedder

        e = Embedder()
        result = e.encode("The chain rule in backpropagation")
        assert isinstance(result, list)
        assert len(result) == 1
        assert len(result[0]) == 384
        # Should be floats
        assert all(isinstance(x, float) for x in result[0])

    def test_encode_batch(self):
        """Encoding multiple strings should return one vector per input."""
        from services.embedder import Embedder

        e = Embedder()
        texts = ["hello world", "backpropagation explained"]
        result = e.encode(texts)
        assert len(result) == 2
        assert len(result[0]) == 384
        assert len(result[1]) == 384

    def test_encode_with_latency(self):
        """encode_with_latency should return (vector, ms) with ms > 0."""
        from services.embedder import Embedder

        e = Embedder()
        vec, ms = e.encode_with_latency("test sentence")
        assert len(vec) == 384
        assert isinstance(ms, float)
        assert ms > 0

    def test_normalized_vectors(self):
        """Vectors should be normalized (unit length) since we use cosine similarity."""
        import math
        from services.embedder import Embedder

        e = Embedder()
        vec = e.encode("test normalization")[0]
        magnitude = math.sqrt(sum(x ** 2 for x in vec))
        assert abs(magnitude - 1.0) < 0.01, f"Expected unit vector, got magnitude {magnitude}"

    def test_different_texts_different_vectors(self):
        """Different texts should produce different vectors."""
        from services.embedder import Embedder

        e = Embedder()
        v1 = e.encode("The chain rule is a calculus concept")[0]
        v2 = e.encode("I love playing cricket in the park")[0]
        # They shouldn't be identical
        assert v1 != v2
