"""Gemini client — analogy rewrite (Phase 5 / Gemino).

Takes a retrieved explanation + student interest avatar and asks Gemini
to rewrite it as a 2-sentence analogy in the student's language.

Uses `google-genai` SDK. Falls back to raw retrieved text if Gemini is slow/down.
"""
from __future__ import annotations

from models.schemas import InterestAvatar

GEMINI_PROMPT_TEMPLATE = """You are a patient tutor explaining a confusing concept
to a student. The student loves {avatar}. Rewrite the following explanation as a
2-sentence analogy that connects the concept to {avatar} topics. Keep it simple,
conversational, and genuinely helpful.

Concept: {concept_node}
Original explanation: {original_text}

Analogy:"""


class GeminiClient:
    """Wrapper for Gemini API analogy rewrite."""

    def __init__(self, api_key: str | None = None) -> None:
        # TODO Phase 5: from google import genai
        #   self.client = genai.Client(api_key=api_key or settings.gemini_api_key)
        pass

    def rewrite_analogy(
        self,
        concept_node: str,
        original_text: str,
        avatar: InterestAvatar,
    ) -> tuple[str, float]:
        """Rewrite an explanation as an avatar-tailored analogy.

        Returns (analogy_text, latency_ms).

        TODO Phase 5: Implement.
          1. Format the prompt with concept_node, original_text, avatar.
          2. Call Gemini (gemini-2.5-flash for speed).
          3. Parse the response.
          4. Measure and return latency.
          5. Fallback: if API fails, return original_text unchanged.
        """
        return (
            f"TODO Phase 5: analogy for '{concept_node}' as a {avatar.value}",
            0.0,
        )
