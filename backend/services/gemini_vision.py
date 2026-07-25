"""Gemini Vision service for screen context detection.

Uses Gemini's multimodal capabilities to analyze screen frames
and detect the current lecture topic/concept.
"""
from __future__ import annotations

import base64
import logging
import time
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

_gemini_vision_client = None


def _get_client():
    """Lazy initialization of Gemini client."""
    global _gemini_vision_client
    if _gemini_vision_client is None and settings.gemini_api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            _gemini_vision_client = genai.GenerativeModel("gemini-2.5-flash")
            logger.info("Gemini Vision client initialized")
        except Exception:
            logger.exception("Failed to initialize Gemini Vision client")
    return _gemini_vision_client


_CONTEXT_PROMPT = """You are analyzing a lecture slide shown to students.
Identify the main concept or topic being discussed.

Respond in this JSON format only:
{
  "topic_node": "snake_case_topic_name",
  "slide_text_summary": "brief summary of slide content",
  "difficulty": 1-10,
  "key_terms": ["term1", "term2", ...]
}

If you cannot determine the topic, respond with:
{"topic_node": "unknown", "slide_text_summary": "", "difficulty": 5, "key_terms": []}
"""


class GeminiVisionClient:
    """Client for analyzing screen frames with Gemini Vision."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or settings.gemini_api_key
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        """Initialize Gemini client."""
        if self._api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self._api_key)
                self._client = genai.GenerativeModel("gemini-2.5-flash")
                logger.info("Gemini Vision client initialized (model=gemini-2.5-flash)")
            except Exception:
                logger.exception("Failed to initialize Gemini Vision")

    @property
    def available(self) -> bool:
        """Check if Gemini Vision is available."""
        return self._client is not None

    def analyze_frame(
        self, 
        image_bytes: bytes, 
        mime_type: str = "image/png"
    ) -> tuple[dict[str, Any], float]:
        """Analyze a screen frame and extract context.

        Returns (context_dict, latency_ms).
        """
        if not self.available:
            logger.warning("Gemini Vision unavailable - returning empty context")
            return {
                "topic_node": "unknown",
                "slide_text_summary": "",
                "difficulty": 5,
                "key_terms": [],
            }, 0.0

        try:
            start = time.perf_counter()

            image_b64 = base64.b64encode(image_bytes).decode()

            response = self._client.generate_content([
                {
                    "mime_type": mime_type,
                    "data": image_bytes,
                },
                _CONTEXT_PROMPT,
            ])

            elapsed_ms = (time.perf_counter() - start) * 1000

            import json
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            context = json.loads(response_text.strip())

            logger.info(
                "Screen context detected: topic=%s latency=%.0fms",
                context.get("topic_node", "unknown"),
                elapsed_ms,
            )

            return context, elapsed_ms

        except Exception as e:
            logger.error("Gemini Vision analysis failed: %s", e)
            return {
                "topic_node": "unknown",
                "slide_text_summary": "",
                "difficulty": 5,
                "key_terms": [],
            }, 0.0

    def health_check(self) -> bool:
        """Check if the Gemini Vision API is accessible."""
        if not self.available:
            return False
        try:
            response = self._client.generate_content("Say 'ok'")
            return "ok" in response.text.lower()
        except Exception:
            return False


def get_gemini_vision() -> GeminiVisionClient:
    """Get or create the singleton Gemini Vision client."""
    global _gemini_vision_client
    if _gemini_vision_client is None:
        _gemini_vision_client = GeminiVisionClient()
    return _gemini_vision_client
