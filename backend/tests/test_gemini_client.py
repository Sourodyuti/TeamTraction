"""Tests for the Gemini analogy rewrite client."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.schemas import InterestAvatar


class TestGeminiClient:
    """Test the GeminiClient wrapper."""

    def test_init_without_api_key(self):
        """Client should initialize gracefully without an API key."""
        with patch("services.gemini_client.settings") as mock_settings:
            mock_settings.gemini_api_key = ""
            from services.gemini_client import GeminiClient

            client = GeminiClient(api_key="")
            assert not client.available

    @pytest.mark.asyncio
    async def test_fallback_when_unavailable(self):
        """rewrite_analogy should return original_text when client is unavailable."""
        with patch("services.gemini_client.settings") as mock_settings:
            mock_settings.gemini_api_key = ""
            from services.gemini_client import GeminiClient

            client = GeminiClient(api_key="")
            text, ms = await client.rewrite_analogy(
                "chain_rule", "The chain rule multiplies derivatives.", InterestAvatar.CRICKETER
            )
            assert text == "The chain rule multiplies derivatives."
            assert ms == 0.0

    @pytest.mark.asyncio
    async def test_rewrite_analogy_success(self):
        """rewrite_analogy should return Gemini's response text and latency."""
        from services.gemini_client import GeminiClient

        client = GeminiClient.__new__(GeminiClient)
        client._api_key = "fake-key"

        # Mock the genai client
        mock_genai = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Think of the chain rule like passing a cricket ball through fielders."
        mock_genai.models.generate_content.return_value = mock_response
        client._client = mock_genai

        text, ms = await client.rewrite_analogy(
            "chain_rule", "The chain rule multiplies derivatives.", InterestAvatar.CRICKETER
        )
        assert "cricket" in text.lower()
        assert ms >= 0

    @pytest.mark.asyncio
    async def test_rewrite_analogy_api_failure_fallback(self):
        """rewrite_analogy should fall back to original_text on API errors."""
        from services.gemini_client import GeminiClient

        client = GeminiClient.__new__(GeminiClient)
        client._api_key = "fake-key"

        # Mock the genai client to raise
        mock_genai = MagicMock()
        mock_genai.models.generate_content.side_effect = Exception("API error")
        client._client = mock_genai

        text, ms = await client.rewrite_analogy(
            "chain_rule", "Original explanation.", InterestAvatar.GAMER
        )
        assert text == "Original explanation."
        assert ms == 0.0

    def test_prompt_contains_avatar(self):
        """The prompt should include the avatar value."""
        from services.gemini_client import GEMINI_PROMPT_TEMPLATE

        prompt = GEMINI_PROMPT_TEMPLATE.format(
            concept_node="loss",
            original_text="The loss function measures error.",
            avatar="cook",
        )
        assert "cook" in prompt
        assert "loss" in prompt

    def test_all_avatars_produce_valid_prompt(self):
        """Every InterestAvatar should produce a valid prompt string."""
        from services.gemini_client import GEMINI_PROMPT_TEMPLATE

        for avatar in InterestAvatar:
            prompt = GEMINI_PROMPT_TEMPLATE.format(
                concept_node="backprop",
                original_text="Backprop computes gradients.",
                avatar=avatar.value,
            )
            assert avatar.value in prompt
            assert len(prompt) > 50

    @pytest.mark.asyncio
    async def test_empty_response_fallback(self):
        """Empty Gemini response should trigger fallback."""
        from services.gemini_client import GeminiClient

        client = GeminiClient.__new__(GeminiClient)
        client._api_key = "fake-key"

        mock_genai = MagicMock()
        mock_response = MagicMock()
        mock_response.text = ""
        mock_genai.models.generate_content.return_value = mock_response
        client._client = mock_genai

        text, ms = await client.rewrite_analogy(
            "chain_rule", "Original text.", InterestAvatar.COOK
        )
        assert text == "Original text."
