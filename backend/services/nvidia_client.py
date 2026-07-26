"""NVIDIA NIM client — fallback LLM for analogy rewrite when Gemini is unavailable.

Calls the OpenAI-compatible endpoint at https://integrate.api.nvidia.com/v1/chat/completions.
Used as a chain-fallback from GeminiClient when Gemini returns 429 or errors out.

Requires NVIDIA_API_KEY env var (get one free at https://build.nvidia.com/).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Literal

import httpx

from config import settings
from models.schemas import InterestAvatar

logger = logging.getLogger(__name__)

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
NVIDIA_MODEL = "meta/llama-3.3-70b-instruct"
NVIDIA_TIMEOUT_S = 15.0

NVIDIA_SYSTEM_PROMPT = (
    "You are a patient tutor explaining a confusing concept to a student. "
    "Respond with ONLY a 2-sentence analogy — no preamble, no labels."
)

NVIDIA_USER_TEMPLATE = (
    "The student loves {avatar}. Rewrite the following explanation as a "
    "2-sentence analogy that connects the concept to {avatar} topics. "
    "Keep it simple, conversational, and genuinely helpful.\n\n"
    "Concept: {concept_node}\n"
    "Original explanation: {original_text}\n\n"
    "Analogy:"
)


class NvidiaClient:
    """Wrapper for NVIDIA NIM chat completions API."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or settings.nvidia_api_key
        self._client: httpx.AsyncClient | None = None

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def rewrite_analogy(
        self,
        concept_node: str,
        original_text: str,
        avatar: InterestAvatar,
    ) -> tuple[str, float]:
        if not self.available:
            return original_text, 0.0

        messages = [
            {"role": "system", "content": NVIDIA_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": NVIDIA_USER_TEMPLATE.format(
                    concept_node=concept_node,
                    original_text=original_text,
                    avatar=avatar.value,
                ),
            },
        ]

        payload = {
            "model": NVIDIA_MODEL,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 256,
            "top_p": 0.95,
        }

        try:
            start = time.perf_counter()
            async with httpx.AsyncClient(timeout=NVIDIA_TIMEOUT_S) as client:
                resp = await client.post(
                    f"{NVIDIA_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            elapsed_ms = (time.perf_counter() - start) * 1000

            if resp.status_code == 429:
                logger.warning("NVIDIA API rate-limited (429) — returning raw text")
                return original_text, elapsed_ms

            resp.raise_for_status()
            data = resp.json()
            choice = data.get("choices", [{}])[0]
            text = (choice.get("message") or {}).get("content", "").strip()

            if not text:
                logger.warning("NVIDIA returned empty response — using fallback")
                return original_text, elapsed_ms

            logger.info(
                "NVIDIA analogy generated (%.0fms, model=%s, avatar=%s)",
                elapsed_ms,
                NVIDIA_MODEL,
                avatar.value,
            )
            return text, elapsed_ms

        except httpx.TimeoutException:
            logger.warning("NVIDIA request timed out after %ss", NVIDIA_TIMEOUT_S)
            return original_text, 0.0
        except Exception as e:
            logger.warning("NVIDIA rewrite failed: %s — returning raw text", e)
            return original_text, 0.0
