"""Gemini Vision service for screen context detection.

Uses Gemini's multimodal capabilities to analyze screen frames
and detect the current lecture topic/concept.
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

_gemini_vision_client: "GeminiVisionClient | None" = None

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
        # 429 circuit breaker: don't fire again until this timestamp (epoch seconds)
        self._rate_limited_until: float = 0.0
        self._init_client()

    def _init_client(self) -> None:
        if self._api_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=self._api_key)
                logger.info("Gemini Vision client initialized (model=gemini-2.5-flash)")
            except Exception:
                logger.exception("Failed to initialize Gemini Vision")

    @property
    def available(self) -> bool:
        return self._client is not None

    @property
    def rate_limited_until(self) -> float:
        """Epoch seconds until rate limit clears. 0 means not rate-limited."""
        return self._rate_limited_until if time.time() < self._rate_limited_until else 0.0

    def analyze_frame(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
    ) -> tuple[dict[str, Any], float]:
        _UNKNOWN = {"topic_node": "unknown", "slide_text_summary": "", "difficulty": 5, "key_terms": []}

        if not self.available:
            logger.warning("Gemini Vision unavailable — returning empty context")
            return _UNKNOWN, 0.0

        # 429 circuit breaker — refuse calls until backoff window clears
        wait_remaining = self._rate_limited_until - time.time()
        if wait_remaining > 0:
            logger.warning(
                "Gemini Vision rate-limited — skipping call, %.0fs remaining in backoff window.",
                wait_remaining,
            )
            return _UNKNOWN, 0.0

        try:
            start = time.perf_counter()

            from google.genai import types

            response = self._client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Content(
                        parts=[
                            types.Part(
                                inline_data=types.Blob(
                                    data=image_bytes,
                                    mime_type=mime_type,
                                )
                            ),
                            types.Part(text=_CONTEXT_PROMPT),
                        ]
                    )
                ],
            )

            elapsed_ms = (time.perf_counter() - start) * 1000

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
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                # Parse retry delay from error message, default 60s
                retry_match = re.search(r"retry[\s\w]*?(\d+(?:\.\d+)?)s", err_str)
                retry_delay = float(retry_match.group(1)) if retry_match else 60.0
                self._rate_limited_until = time.time() + retry_delay
                logger.warning(
                    "Gemini Vision 429 — rate limit hit. Circuit breaker active for %.0fs. "
                    "Free tier: 20 req/day. Consider upgrading or reducing capture interval.",
                    retry_delay,
                )
            else:
                logger.error("Gemini Vision analysis failed: %s", e)
            return _UNKNOWN, 0.0

    def health_check(self) -> bool:
        if not self.available:
            return False
        try:
            response = self._client.models.generate_content(
                model="gemini-2.5-flash",
                contents="Say 'ok'",
            )
            return "ok" in response.text.lower()
        except Exception:
            return False


def get_gemini_vision() -> GeminiVisionClient | None:
    global _gemini_vision_client
    if _gemini_vision_client is None:
        _gemini_vision_client = GeminiVisionClient()
    if _gemini_vision_client and _gemini_vision_client.available:
        return _gemini_vision_client
    return None
