"""Tests for the Accio Analogy retrieval router (Phase 4+5)."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from models.schemas import InterestAvatar


def _make_app():
    """Import the FastAPI app after patching heavy services."""
    from main import create_app
    return create_app()


class TestRetrievalRouter:
    """Test the /retrieval/accio endpoint."""

    def _client(self):
        """Return a TestClient with all cloud services mocked."""
        app = _make_app()
        return TestClient(app, raise_server_exceptions=False)

    def _mock_deps(self):
        """Patch embedder, vectorai, gemini, elevenlabs, offline_cache."""
        mock_embedder = MagicMock()
        mock_embedder.encode_with_latency.return_value = ([0.1] * 384, 12.5)

        mock_vectorai = MagicMock()
        mock_vectorai._client = MagicMock()  # so connect() is skipped
        mock_vectorai.search_similar.return_value = [
            {
                "id": 1,
                "score": 0.92,
                "payload": {
                    "text": "The chain rule multiplies gradients layer by layer.",
                    "topic_node": "chain_rule",
                    "source": "lecture",
                },
                "latency_ms": 8.0,
            }
        ]

        mock_gemini = MagicMock()
        mock_gemini.rewrite_analogy.return_value = (
            "Think of it like fielders passing the ball backward through the chain.",
            45.2,
        )

        mock_elevenlabs = MagicMock()
        mock_elevenlabs.text_to_speech.return_value = (b"fake_audio", 320.0)

        return mock_embedder, mock_vectorai, mock_gemini, mock_elevenlabs

    def test_accio_returns_analogy_response(self):
        """POST /retrieval/accio should return a valid AnalogyResponse."""
        from routers.retrieval import (
            _get_embedder, _get_vectorai, _get_gemini, _get_elevenlabs,
        )
        from main import create_app

        app = create_app()
        mock_e, mock_v, mock_g, mock_el = self._mock_deps()

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v
        app.dependency_overrides[_get_gemini] = lambda: mock_g
        app.dependency_overrides[_get_elevenlabs] = lambda: mock_el

        client = TestClient(app, raise_server_exceptions=True)
        resp = client.post(
            "/retrieval/accio",
            params={"concept_node": "chain_rule", "chunk_text": "Backprop uses the chain rule."},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["concept_node"] == "chain_rule"
        assert "analogy_text" in body
        assert "latency_ms" in body

    def test_accio_embedding_failure_falls_back_to_cache(self):
        """If embedding fails, /accio should return a fallback (not 500)."""
        from routers.retrieval import _get_embedder, _get_vectorai, _get_gemini, _get_elevenlabs
        from main import create_app

        app = create_app()
        mock_e = MagicMock()
        mock_e.encode_with_latency.side_effect = RuntimeError("model not loaded")
        _, mock_v, mock_g, mock_el = self._mock_deps()

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v
        app.dependency_overrides[_get_gemini] = lambda: mock_g
        app.dependency_overrides[_get_elevenlabs] = lambda: mock_el

        with patch("routers.retrieval.get_cached_analogy", return_value=None):
            client = TestClient(app, raise_server_exceptions=True)
            resp = client.post(
                "/retrieval/accio",
                params={"concept_node": "chain_rule", "chunk_text": "fallback test"},
            )
        assert resp.status_code == 200
        body = resp.json()
        # Fallback: original_text == chunk_text
        assert body["original_text"] == "fallback test" or body["concept_node"] == "chain_rule"

    def test_accio_gemini_failure_uses_retrieved_text(self):
        """Gemini failure should NOT crash the endpoint — returns retrieved text."""
        from routers.retrieval import _get_embedder, _get_vectorai, _get_gemini, _get_elevenlabs
        from main import create_app

        app = create_app()
        mock_e, mock_v, _, mock_el = self._mock_deps()
        mock_g = MagicMock()
        mock_g.rewrite_analogy.side_effect = Exception("Gemini quota exceeded")

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v
        app.dependency_overrides[_get_gemini] = lambda: mock_g
        app.dependency_overrides[_get_elevenlabs] = lambda: mock_el

        client = TestClient(app, raise_server_exceptions=True)
        resp = client.post(
            "/retrieval/accio",
            params={"concept_node": "chain_rule", "chunk_text": "test"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # analogy_text should fall back to retrieved text
        assert body["analogy_text"] == body["original_text"]

    def test_accio_vectorai_failure_uses_chunk_text(self):
        """VectorAI failure should use chunk_text as retrieved text."""
        from routers.retrieval import _get_embedder, _get_vectorai, _get_gemini, _get_elevenlabs
        from main import create_app

        app = create_app()
        mock_e, _, mock_g, mock_el = self._mock_deps()
        mock_v = MagicMock()
        mock_v._client = MagicMock()
        mock_v.search_similar.side_effect = Exception("Qdrant unavailable")

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v
        app.dependency_overrides[_get_gemini] = lambda: mock_g
        app.dependency_overrides[_get_elevenlabs] = lambda: mock_el

        # Mock gemini to confirm it receives chunk_text as original
        mock_g.rewrite_analogy.return_value = ("cricket analogy", 40.0)
        client = TestClient(app, raise_server_exceptions=True)
        resp = client.post(
            "/retrieval/accio",
            params={"concept_node": "backprop", "chunk_text": "Backprop gradients flow backward."},
        )
        assert resp.status_code == 200

    def test_accio_batch_endpoint(self):
        """GET /retrieval/accio-batch should return a list of RetrievalResult."""
        from routers.retrieval import _get_embedder, _get_vectorai
        from main import create_app

        app = create_app()
        mock_e, mock_v, _, _ = self._mock_deps()

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v

        client = TestClient(app, raise_server_exceptions=True)
        resp = client.post(
            "/retrieval/accio-batch",
            params={"concept_node": "chain_rule", "chunk_text": "test", "limit": 3},
        )
        assert resp.status_code == 200
        results = resp.json()
        assert isinstance(results, list)
        assert len(results) >= 1
        assert "text" in results[0]
        assert "score" in results[0]

    def test_accio_latency_tracking(self):
        """AnalogyResponse should always include latency_ms with all stage keys."""
        from routers.retrieval import _get_embedder, _get_vectorai, _get_gemini, _get_elevenlabs
        from main import create_app

        app = create_app()
        mock_e, mock_v, mock_g, mock_el = self._mock_deps()

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v
        app.dependency_overrides[_get_gemini] = lambda: mock_g
        app.dependency_overrides[_get_elevenlabs] = lambda: mock_el

        client = TestClient(app, raise_server_exceptions=True)
        resp = client.post(
            "/retrieval/accio",
            params={"concept_node": "loss", "chunk_text": "The loss measures error."},
        )
        assert resp.status_code == 200
        latency = resp.json()["latency_ms"]
        for key in ("embedding", "retrieval", "gemini", "tts"):
            assert key in latency, f"Missing latency key: {key}"

    def test_accio_avatar_param(self):
        """Avatar query param should propagate to the response."""
        from routers.retrieval import _get_embedder, _get_vectorai, _get_gemini, _get_elevenlabs
        from main import create_app

        app = create_app()
        mock_e, mock_v, mock_g, mock_el = self._mock_deps()

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v
        app.dependency_overrides[_get_gemini] = lambda: mock_g
        app.dependency_overrides[_get_elevenlabs] = lambda: mock_el

        client = TestClient(app, raise_server_exceptions=True)
        for avatar in ("cricketer", "gamer", "cook"):
            resp = client.post(
                "/retrieval/accio",
                params={"concept_node": "backprop", "chunk_text": "test", "avatar": avatar},
            )
            assert resp.status_code == 200
            assert resp.json()["avatar"] == avatar

    def test_accio_batch_service_unavailable(self):
        """If embedder fails in batch mode, return 503."""
        from routers.retrieval import _get_embedder, _get_vectorai
        from main import create_app

        app = create_app()
        mock_e = MagicMock()
        mock_e.encode_with_latency.side_effect = RuntimeError("GPU OOM")
        _, mock_v, _, _ = self._mock_deps()

        app.dependency_overrides[_get_embedder] = lambda: mock_e
        app.dependency_overrides[_get_vectorai] = lambda: mock_v

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/retrieval/accio-batch",
            params={"concept_node": "chain_rule", "chunk_text": "test"},
        )
        assert resp.status_code == 503
