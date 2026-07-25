"""Tests for the retrieval router — pipeline orchestration."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from models.schemas import AnalogyResponse, InterestAvatar
from routers.retrieval import run_retrieval_pipeline


class TestRunRetrievalPipeline:
    @pytest.mark.asyncio
    async def test_full_pipeline_success(self):
        """All services available → full analogy with audio URL."""
        # Mock embedder
        mock_embedder = MagicMock()
        mock_embedder.encode_with_latency.return_value = ([0.1] * 384, 12.0)

        # Mock vectorai
        mock_vdb = MagicMock()
        mock_vdb.search_similar.return_value = [
            {"text": "The chain rule is like passing a baton in a relay race.",
             "topic_node": "chain_rule", "source": "textbook", "score": 0.92}
        ]
        mock_vdb.health.return_value = True

        # Mock gemini
        mock_gemini_response = ("Like cricket: each layer is a batsman passing the strike to the next.", 450.0)

        # Mock elevenlabs
        mock_audio_url = "https://api.elevenlabs.io/v1/audio/abc123.mp3"

        with patch("routers.retrieval.get_embedder", return_value=mock_embedder):
            with patch("routers.retrieval.get_vectorai", return_value=mock_vdb):
                with patch("services.gemini_client.GeminiClient") as MockGemini:
                    with patch("services.elevenlabs_client.ElevenLabsClient") as MockEleven:
                        MockGemini.return_value.rewrite_analogy.return_value = mock_gemini_response
                        MockEleven.return_value.get_audio_url.return_value = mock_audio_url

                        result = await run_retrieval_pipeline(
                            concept_node="chain_rule",
                            chunk_text="The chain rule multiplies gradients layer by layer",
                            avatar=InterestAvatar.CRICKETER,
                        )

        assert isinstance(result, AnalogyResponse)
        assert result.concept_node == "chain_rule"
        assert result.original_text == "The chain rule is like passing a baton in a relay race."
        assert "cricket" in result.analogy_text.lower()
        assert result.audio_url == mock_audio_url
        assert result.latency_ms["embedding"] == 12.0
        assert result.latency_ms["gemini"] == 450.0

    @pytest.mark.asyncio
    async def test_gemini_fallback_to_raw_text(self):
        """Gemini down → returns raw retrieved text, no crash."""
        mock_embedder = MagicMock()
        mock_embedder.encode_with_latency.return_value = ([0.1] * 384, 10.0)

        mock_vdb = MagicMock()
        mock_vdb.search_similar.return_value = [
            {"text": "Raw explanation text", "topic_node": "loss", "source": "lecture", "score": 0.85}
        ]

        with patch("routers.retrieval.get_embedder", return_value=mock_embedder):
            with patch("routers.retrieval.get_vectorai", return_value=mock_vdb):
                with patch("services.gemini_client.GeminiClient") as MockGemini:
                    MockGemini.return_value.rewrite_analogy.side_effect = Exception("Gemini timeout")

                    with patch("services.elevenlabs_client.ElevenLabsClient") as MockEleven:
                        MockEleven.return_value.get_audio_url.side_effect = Exception("ElevenLabs down")

                        result = await run_retrieval_pipeline(
                            concept_node="loss",
                            chunk_text="Loss function measures error",
                            avatar=InterestAvatar.GAMER,
                        )

        # Should return the raw retrieved text as analogy
        assert result.analogy_text == "Raw explanation text"
        assert result.audio_url is None
        assert result.latency_ms["gemini"] == 0.0

    @pytest.mark.asyncio
    async def test_empty_retrieval_uses_chunk_text(self):
        """No hits from VectorAI → uses the chunk text itself."""
        mock_embedder = MagicMock()
        mock_embedder.encode_with_latency.return_value = ([0.1] * 384, 8.0)

        mock_vdb = MagicMock()
        mock_vdb.search_similar.return_value = []  # Empty results

        with patch("routers.retrieval.get_embedder", return_value=mock_embedder):
            with patch("routers.retrieval.get_vectorai", return_value=mock_vdb):
                with patch("services.gemini_client.GeminiClient") as MockGemini:
                    MockGemini.return_value.rewrite_analogy.return_value = ("Analogy", 100.0)

                    with patch("services.elevenlabs_client.ElevenLabsClient") as MockEleven:
                        MockEleven.return_value.get_audio_url.return_value = None

                        result = await run_retrieval_pipeline(
                            concept_node="unknown",
                            chunk_text="The chunk text itself",
                            avatar=InterestAvatar.COOK,
                        )

        assert result.original_text == "The chunk text itself"

    @pytest.mark.asyncio
    async def test_embedder_failure_raises(self):
        """Embedder down is a hard failure — pipeline can't proceed."""
        mock_embedder = MagicMock()
        mock_embedder.encode_with_latency.side_effect = Exception("Model not loaded")

        with patch("routers.retrieval.get_embedder", return_value=mock_embedder):
            with pytest.raises(Exception) as exc_info:
                await run_retrieval_pipeline(
                    concept_node="test",
                    chunk_text="test",
                    avatar=InterestAvatar.CRICKETER,
                )

        assert "Embedding" in str(exc_info.value) or "503" in str(exc_info.value)
