"""Tests for the ElevenLabs TTS client."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


class TestElevenLabsClient:
    """Test the ElevenLabsClient wrapper."""

    def test_init_without_api_key(self):
        """Client should initialize gracefully without an API key."""
        with patch("services.elevenlabs_client.settings") as mock_settings:
            mock_settings.elevenlabs_api_key = ""
            from services.elevenlabs_client import ElevenLabsClient

            client = ElevenLabsClient(api_key="")
            assert not client.available

    def test_text_to_speech_when_unavailable(self):
        """text_to_speech should return empty bytes when client is unavailable."""
        with patch("services.elevenlabs_client.settings") as mock_settings:
            mock_settings.elevenlabs_api_key = ""
            from services.elevenlabs_client import ElevenLabsClient

            client = ElevenLabsClient(api_key="")
            audio, ms = client.text_to_speech("Hello world")
            assert audio == b""
            assert ms == 0.0

    def test_text_to_speech_empty_input(self):
        """Empty text should return empty bytes without calling API."""
        from services.elevenlabs_client import ElevenLabsClient

        client = ElevenLabsClient.__new__(ElevenLabsClient)
        client._client = MagicMock()
        client._api_key = "fake-key"
        client._voice_id = "test"

        audio, ms = client.text_to_speech("")
        assert audio == b""
        # Should NOT call the API
        client._client.text_to_speech.convert.assert_not_called()

    def test_text_to_speech_success(self):
        """text_to_speech should collect audio chunks and return bytes + latency."""
        from services.elevenlabs_client import ElevenLabsClient

        client = ElevenLabsClient.__new__(ElevenLabsClient)
        client._api_key = "fake-key"
        client._voice_id = "21m00Tcm4TlvDq8ikWAM"

        # Mock: generate returns an iterator of audio chunks
        mock_client = MagicMock()
        fake_audio_chunks = [b"chunk1", b"chunk2", b"chunk3"]
        mock_client.text_to_speech.convert.return_value = iter(fake_audio_chunks)
        client._client = mock_client

        audio, ms = client.text_to_speech("Test analogy for cricket fans.")
        assert audio == b"chunk1chunk2chunk3"
        assert ms > 0

    def test_text_to_speech_api_error(self):
        """text_to_speech should return empty bytes on API errors — never crash."""
        from services.elevenlabs_client import ElevenLabsClient

        client = ElevenLabsClient.__new__(ElevenLabsClient)
        client._api_key = "fake-key"
        client._voice_id = "test"

        mock_client = MagicMock()
        mock_client.text_to_speech.convert.side_effect = Exception("quota exceeded")
        client._client = mock_client

        audio, ms = client.text_to_speech("This should fail gracefully.")
        assert audio == b""
        assert ms == 0.0

    def test_available_property(self):
        """available should reflect whether _client is initialized."""
        from services.elevenlabs_client import ElevenLabsClient

        client = ElevenLabsClient.__new__(ElevenLabsClient)
        client._client = None
        assert not client.available

        client._client = MagicMock()
        assert client.available
