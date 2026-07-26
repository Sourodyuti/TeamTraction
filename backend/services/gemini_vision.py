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
        _UNKNOWN = {"topic_node": "unknown", "full_text_transcription": "", "diagram_descriptions": "", "comprehensive_summary": "Could not determine context.", "brief_summary": "", "difficulty": 5, "key_terms": []}

        if not self.available:
            logger.warning("Gemini Vision unavailable — attempting Nvidia fallback")
            return self._nvidia_fallback(image_bytes, mime_type)

        wait_remaining = self._rate_limited_until - time.time()
        if wait_remaining > 0:
            logger.warning(
                "Gemini Vision rate-limited — skipping call, %.0fs remaining in backoff window.",
                wait_remaining,
            )
            return self._nvidia_fallback(image_bytes, mime_type)

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
            return self._nvidia_fallback(image_bytes, mime_type)

    def _nvidia_fallback(
        self,
        image_bytes: bytes,
        mime_type: str
    ) -> tuple[dict[str, Any], float]:
        """Fallback to Nvidia NIM Vision model with EXIF rotation and OCR."""
        start = time.perf_counter()
        api_key = settings.nvidia_api_key
        _UNKNOWN = {"topic_node": "unknown", "full_text_transcription": "", "diagram_descriptions": "", "comprehensive_summary": "Could not determine context.", "brief_summary": "", "difficulty": 5, "key_terms": []}

        if not api_key:
            logger.warning("NVIDIA_API_KEY not set for fallback")
            return _UNKNOWN, 0.0

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
        
        system_instruction = "CRITICAL INSTRUCTION: You are a strict JSON data extraction API. You must output EXACTLY AND ONLY a raw JSON object. Do NOT output markdown headers like **Topic Node:**. Do NOT output conversational text. Output MUST start with { and end with }."
        if ocr_text:
            prompt = f"{system_instruction}\n\nI have run local OCR on this image. OCR Text:\n{ocr_text}\n\nBased on the image and this exact OCR text, {_CONTEXT_PROMPT}"
        else:
            prompt = f"{system_instruction}\n\n{_CONTEXT_PROMPT}"

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
                try:
                    # Clean control chars that Llama sometimes leaves unescaped
                    clean_json = re.sub(r'[\x00-\x1F\x7F]', '', response_text[start_idx:end_idx + 1])
                    context = json.loads(clean_json)
                except json.JSONDecodeError:
                    context = json.loads(response_text[start_idx:end_idx + 1].replace('\n', '\\n'))
            else:
                # Robust fallback for conversational markdown headers (Llama NIM quirk)
                import re
                context = {}
                
                topic_match = re.search(r'\*\*\s*Topic(?: Node)?\s*\*\*\s*:?\s*(.+)', response_text, re.IGNORECASE)
                if topic_match:
                    context["topic_node"] = topic_match.group(1).strip()
                
                summary_match = re.search(r'\*\*\s*Comprehensive Summary\s*\*\*\s*:?\s*([\s\S]*?)(?=\*\*|$)', response_text, re.IGNORECASE)
                if summary_match:
                    context["comprehensive_summary"] = summary_match.group(1).strip()
                    
                brief_match = re.search(r'\*\*\s*Brief Summary\s*\*\*\s*:?\s*([\s\S]*?)(?=\*\*|$)', response_text, re.IGNORECASE)
                if brief_match:
                    context["brief_summary"] = brief_match.group(1).strip()
                    
                full_text_match = re.search(r'\*\*\s*Full Text Transcription\s*\*\*\s*:?\s*([\s\S]*?)(?=\*\*|$)', response_text, re.IGNORECASE)
                if full_text_match:
                    context["full_text_transcription"] = full_text_match.group(1).strip()
                    
                diagrams_match = re.search(r'\*\*\s*Diagram Descriptions\s*\*\*\s*:?\s*([\s\S]*?)(?=\*\*|$)', response_text, re.IGNORECASE)
                if diagrams_match:
                    context["diagram_descriptions"] = diagrams_match.group(1).strip()
                    
                diff_match = re.search(r'\*\*\s*Difficulty\s*\*\*\s*:?\s*(\d+)', response_text, re.IGNORECASE)
                if diff_match:
                    context["difficulty"] = int(diff_match.group(1).strip())
                    
                terms_match = re.search(r'\*\*\s*Key Terms\s*\*\*\s*:?\s*([\s\S]*?)(?=\*\*|$)', response_text, re.IGNORECASE)
                if terms_match:
                    terms_str = terms_match.group(1).strip()
                    if "[" in terms_str and "]" in terms_str:
                        try:
                            context["key_terms"] = json.loads(terms_str[terms_str.find("["):terms_str.rfind("]") + 1])
                        except:
                            context["key_terms"] = [t.strip().strip('"').strip("'") for t in terms_str.replace("[", "").replace("]", "").split(",")]
                    else:
                        context["key_terms"] = [t.strip().lstrip('-').lstrip('*').strip() for t in terms_str.split('\n') if t.strip()]

                if not context:
                    raise ValueError(f"No JSON block or markdown headers found in response: {response_text}")

                # Merge with defaults
                context = {**_UNKNOWN, **context}

            elapsed_ms = (time.perf_counter() - start) * 1000
            
            logger.info("Nvidia Vision fallback succeeded: topic=%s latency=%.0fms", context.get("topic_node", "unknown"), elapsed_ms)
            return context, elapsed_ms
        except Exception as e:
            logger.error("Nvidia Vision fallback failed: %s", e)
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
