"""Gemini client — analogy rewrite (Phase 5 / Gemino).

Takes a retrieved explanation + student interest avatar and asks Gemini
to rewrite it as a 2-sentence analogy in the student's language.

Uses `google-genai` SDK. Falls back to raw retrieved text if Gemini is slow/down
or if the API key is not configured.
"""
from __future__ import annotations

import logging
import time

from config import settings
from models.schemas import InterestAvatar

logger = logging.getLogger(__name__)

GEMINI_PROMPT_TEMPLATE = """You are a patient tutor explaining a confusing concept
to a student. The student loves {avatar}. Rewrite the following explanation as a
2-sentence analogy that connects the concept to {avatar} topics. Keep it simple,
conversational, and genuinely helpful.

Concept: {concept_node}
Original explanation: {original_text}

Analogy:"""

# Model to use — flash is cheap + fast, ideal for hackathon latency targets
_MODEL = "gemini-2.0-flash-lite"

# Retry config
_MAX_RETRIES = 2
_RETRY_DELAY_S = 0.5


class GeminiClient:
    """Wrapper for Gemini API analogy rewrite."""

    def __init__(self, api_key: str | None = None) -> None:
        self._client = None
        self._api_key = api_key or settings.gemini_api_key

        if self._api_key:
            try:
                from google import genai

                self._client = genai.Client(api_key=self._api_key)
                logger.info("Gemini client initialized (model=%s)", _MODEL)
            except Exception:
                logger.exception("Failed to initialize Gemini client")
                self._client = None
        else:
            logger.warning(
                "GEMINI_API_KEY not set — Gemino will return raw explanations"
            )

    @property
    def available(self) -> bool:
        """True if the Gemini client is initialized and ready."""
        return self._client is not None

    def rewrite_analogy(
        self,
        concept_node: str,
        original_text: str,
        avatar: InterestAvatar,
    ) -> tuple[str, float]:
        """Rewrite an explanation as an avatar-tailored analogy.

        Returns (analogy_text, latency_ms).

        Fallback: if API fails or key is missing, returns original_text unchanged.
        """
        if not self.available:
            logger.warning("Gemini unavailable — returning raw explanation")
            return original_text, 0.0

        prompt = GEMINI_PROMPT_TEMPLATE.format(
            concept_node=concept_node,
            original_text=original_text,
            avatar=avatar.value,
        )

        last_error = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                start = time.perf_counter()
                response = self._client.models.generate_content(
                    model=_MODEL,
                    contents=prompt,
                )
                elapsed_ms = (time.perf_counter() - start) * 1000

                analogy_text = response.text.strip() if response.text else ""
                if not analogy_text:
                    logger.warning("Gemini returned empty response — using fallback")
                    return original_text, elapsed_ms

                logger.info(
                    "Gemino analogy generated (%.0fms, avatar=%s)",
                    elapsed_ms,
                    avatar.value,
                )
                return analogy_text, elapsed_ms

            except Exception as e:
                last_error = e
                logger.warning(
                    "Gemini attempt %d/%d failed: %s",
                    attempt,
                    _MAX_RETRIES,
                    e,
                )
                if attempt < _MAX_RETRIES:
                    time.sleep(_RETRY_DELAY_S * attempt)

        # All retries exhausted — fallback
        logger.error(
            "Gemini failed after %d attempts: %s — returning raw explanation",
            _MAX_RETRIES,
            last_error,
        )
        return original_text, 0.0
