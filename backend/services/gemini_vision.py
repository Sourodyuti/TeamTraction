"""Gemini Vision service for screen context detection.

Uses Gemini's multimodal capabilities to analyze screen frames
and detect the current lecture topic/concept.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

_gemini_vision_client: "GeminiVisionClient | None" = None

_CONTEXT_PROMPT = """You are analyzing a screen capture or image.
Identify the main concept, topic, or activity being shown.

Respond STRICTLY with a valid JSON object matching this exact format and nothing else. Do not use markdown wrappers:
{
  "topic_node": "snake_case_topic_name",
  "full_text_transcription": "Exact transcription of all text, numbers, code, and values visible on the screen",
  "diagram_descriptions": "Detailed explanation of any diagrams, charts, UI elements, or visual structures (or 'None')",
  "comprehensive_summary": "Full comprehensive and detailed summary of the visual and text content",
  "brief_summary": "A small 2-line summary of the content",
  "difficulty": 1-10,
  "key_terms": ["term1", "term2"]
}

If you cannot determine the topic, respond with:
{"topic_node": "unknown", "full_text_transcription": "", "diagram_descriptions": "", "comprehensive_summary": "Could not determine context.", "brief_summary": "", "difficulty": 5, "key_terms": []}
"""

_ASK_PROMPT = """You are an AI assistant analyzing a screen capture or image.
A user has asked a question: "{question}"

Context from previous frames: {context}

Provide a helpful and detailed answer. Include exactly 2 relevant YouTube video URLs at the end of your answer.

Respond STRICTLY with a valid JSON object matching this exact format and nothing else. Do not use markdown wrappers:
{{
  "topic_node": "snake_case_topic_name",
  "full_text_transcription": "Exact transcription of all text, numbers, code, and values visible on the screen",
  "diagram_descriptions": "Detailed explanation of any diagrams, charts, UI elements, or visual structures (or 'None')",
  "comprehensive_summary": "Full comprehensive and detailed summary of the visual and text content",
  "brief_summary": "A small 2-line summary of the content",
  "difficulty": 5,
  "key_terms": ["term1", "term2"],
  "answer": "Your detailed answer to the user's question, including 2 YouTube links."
}}
"""


class GeminiVisionClient:
    """Client for analyzing screen frames with Gemini Vision."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or settings.gemini_api_key
        self._client = None
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

    def analyze_frame(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        question: str | None = None
    ) -> tuple[dict[str, Any], float]:
        if not self.available:
            logger.warning("Gemini Vision unavailable - attempting Nvidia fallback")
            return self._nvidia_fallback(image_bytes, mime_type, question)

        try:
            start = time.perf_counter()

            if question:
                from services.knowledge_base import get_knowledge_base
                hits = get_knowledge_base().search_knowledge(question, lecture_id=1, limit=3)
                context_str = "\n".join([str(h) for h in hits]) if hits else "None"
                prompt = _ASK_PROMPT.format(question=question, context=context_str)
            else:
                prompt = _CONTEXT_PROMPT

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
                            types.Part(text=prompt),
                        ]
                    )
                ],
            )
            response_text = response.text

            elapsed_ms = (time.perf_counter() - start) * 1000

            logger.debug("Raw Gemini response: %s", response_text)
            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}")
            if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
                try:
                    context = json.loads(response_text[start_idx:end_idx + 1])
                except Exception as e:
                    logger.error("JSON decode error: %s. Extracted string: %s", e, response_text[start_idx:end_idx + 1])
                    raise
            else:
                raise ValueError(f"No JSON block found in response: {response_text}")

            logger.info(
                "Screen context detected: topic=%s latency=%.0fms",
                context.get("topic_node", "unknown"),
                elapsed_ms,
            )

            return context, elapsed_ms

        except Exception as e:
            logger.error("Gemini Vision analysis failed: %s - attempting Nvidia fallback", e)
            return self._nvidia_fallback(image_bytes, mime_type, question)

    def _nvidia_fallback(
        self,
        image_bytes: bytes,
        mime_type: str,
        question: str | None
    ) -> tuple[dict[str, Any], float]:
        """Fallback to Nvidia NIM Vision model with EXIF rotation and OCR."""
        start = time.perf_counter()
        api_key = settings.nvidia_api_key
        if not api_key:
            logger.warning("NVIDIA_API_KEY not set for fallback")
            return {"topic_node": "unknown", "slide_text_summary": "", "difficulty": 5, "key_terms": []}, 0.0

        import base64
        import httpx
        import json
        import io
        from PIL import Image, ImageOps
        import pytesseract

        try:
            # 1. Open image and fix EXIF rotation
            img = Image.open(io.BytesIO(image_bytes))
            img = ImageOps.exif_transpose(img)
            
            # 2. Extract perfectly oriented text via local OCR
            ocr_text = pytesseract.image_to_string(img)
            
            # 3. Downscale for the API to prevent massive payloads
            img.thumbnail((1024, 1024))
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85)
            optimized_bytes = buffer.getvalue()
            b64_image = base64.b64encode(optimized_bytes).decode("utf-8")
        except Exception as e:
            logger.error("Failed to process image with PIL/OCR: %s", e)
            b64_image = base64.b64encode(image_bytes).decode("utf-8")
            ocr_text = ""
        
        if question:
            from services.knowledge_base import get_knowledge_base
            hits = get_knowledge_base().search_knowledge(question, lecture_id=1, limit=3)
            context_str = "\n".join([str(h) for h in hits]) if hits else "None"
            base_prompt = _ASK_PROMPT.format(question=question, context=context_str)
        else:
            base_prompt = _CONTEXT_PROMPT

        if ocr_text:
            prompt = f"I have run local OCR on this image. OCR Text:\n{ocr_text}\n\nBased on the image and this exact OCR text, {base_prompt}"
        else:
            prompt = base_prompt

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "meta/llama-3.2-90b-vision-instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}}
                    ]
                }
            ],
            "max_tokens": 1024,
            "temperature": 0.1
        }
        
        try:
            with httpx.Client(timeout=180.0) as client:
                resp = client.post(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
            
            resp.raise_for_status()
            response_text = resp.json()["choices"][0]["message"]["content"].strip()
            
            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}")
            if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
                context = json.loads(response_text[start_idx:end_idx + 1])
            else:
                raise ValueError(f"No JSON block found in response: {response_text}")
            elapsed_ms = (time.perf_counter() - start) * 1000
            
            logger.info("Nvidia Vision fallback succeeded: topic=%s latency=%.0fms", context.get("topic_node", "unknown"), elapsed_ms)
            return context, elapsed_ms
        except Exception as e:
            logger.error("Nvidia Vision fallback failed: %s", e)
            return {"topic_node": "unknown", "slide_text_summary": "", "difficulty": 5, "key_terms": []}, 0.0

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
