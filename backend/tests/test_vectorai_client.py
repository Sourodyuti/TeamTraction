"""Tests for the Actian VectorAI DB client service."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


class TestVectorAIClient:
    """Test the Actian VectorAI DB client wrapper."""

    def _make_client(self):
        """Create a VectorAIClient with a mocked Actian VectorAI backend."""
        from services.vectorai_client import VectorAIClient

        client = VectorAIClient()
        client._client = MagicMock()
        return client

    def test_address_property(self):
        """Address should combine host:port."""
        from services.vectorai_client import VectorAIClient

        c = VectorAIClient()
        assert ":" in c.address

    def test_connect_creates_client(self):
        """connect() should initialize the Actian VectorAI client."""
        with patch("actian_vectorai.VectorAIClient") as MockVectorAI:
            from services.vectorai_client import VectorAIClient

            mock_ctx = MagicMock()
            mock_ctx.__enter__.return_value = MagicMock()
            MockVectorAI.return_value = mock_ctx

            c = VectorAIClient()
            c.connect()
            assert c._client is not None
            MockVectorAI.assert_called_once_with(c.address)

    def test_close_nullifies_client(self):
        """close() should set _client to None."""
        client = self._make_client()
        mock_ctx = MagicMock()
        client._context = mock_ctx
        assert client._client is not None
        client.close()
        assert client._client is None
        assert client._context is None

    def test_get_client_raises_if_not_connected(self):
        """_get_client() should raise RuntimeError if not connected."""
        from services.vectorai_client import VectorAIClient

        c = VectorAIClient()
        with pytest.raises(RuntimeError, match="not connected"):
            c._get_client()

    def test_create_collection_idempotent(self):
        """create_lecture_chunks_collection should skip if collection exists."""
        client = self._make_client()

        # Mock: collection already exists
        client._client.collections.exists.return_value = True

        client.create_lecture_chunks_collection()
        client._client.collections.create.assert_not_called()

    def test_create_collection_when_new(self):
        """create_lecture_chunks_collection should create when not present."""
        client = self._make_client()

        # Mock: no existing collections
        client._client.collections.exists.return_value = False

        client.create_lecture_chunks_collection()
        client._client.collections.create.assert_called_once()

    def test_upsert_chunks(self):
        """upsert_chunks should call points.upsert with PointStruct objects."""
        client = self._make_client()

        points = [
            {"id": "test_1", "vector": [0.1] * 384, "payload": {"topic": "test"}},
            {"id": 42, "vector": [0.2] * 384, "payload": {"topic": "test2"}},
        ]

        client.upsert_chunks(points)
        client._client.points.upsert.assert_called_once()

    def test_search_similar(self):
        """search_similar should return structured results."""
        client = self._make_client()

        # Mock search response
        mock_hit = MagicMock()
        mock_hit.id = 1
        mock_hit.payload = {"topic_node": "chain_rule", "text": "explanation"}
        mock_hit.score = 0.95

        client._client.points.search.return_value = [mock_hit]

        results = client.search_similar([0.1] * 384, limit=3)
        assert len(results) == 1
        assert results[0]["id"] == 1
        assert results[0]["score"] == 0.95
        assert results[0]["payload"]["topic_node"] == "chain_rule"

    def test_health_returns_true_when_connected(self):
        """health() should return True when VectorAI responds."""
        client = self._make_client()
        client._client.health_check.return_value = {"status": "ok"}
        assert client.health() is True

    def test_health_returns_false_on_error(self):
        """health() should return False when VectorAI is unreachable."""
        client = self._make_client()
        client._client.health_check.side_effect = Exception("connection refused")
        assert client.health() is False

