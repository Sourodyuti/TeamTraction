"""Offline cache — pre-cached analogies for the cable-pull demo (Phase 8).

Stores a complete analogy pipeline result (retrieved text + Gemini rewrite +
ElevenLabs audio) to disk so the "unplug Ethernet" demo moment works without
any cloud connectivity.

Cache location: backend/cache/

The BE lead's retrieval router checks this cache first when cloud calls fail.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Cache directory — relative to the backend/ root
_CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"


def _ensure_cache_dir() -> Path:
    """Create the cache directory if it doesn't exist."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR


def _cache_path(concept_node: str) -> Path:
    """Return the base path for a cached concept (no extension)."""
    # Sanitize concept_node for filesystem
    safe_name = concept_node.replace("/", "_").replace(" ", "_").lower()
    return _ensure_cache_dir() / safe_name


def is_cached(concept_node: str) -> bool:
    """Check if a cached analogy exists for this concept node."""
    base = _cache_path(concept_node)
    return (base.with_suffix(".json")).exists()


def get_cached_analogy(concept_node: str) -> dict | None:
    """Return cached analogy data for the given concept node.

    Returns a dict with keys:
        - concept_node: str
        - original_text: str
        - analogy_text: str
        - avatar: str
        - audio_bytes: bytes (loaded from .mp3 file)
        - latency_ms: dict

    Returns None if no cache exists.
    """
    base = _cache_path(concept_node)
    meta_path = base.with_suffix(".json")
    audio_path = base.with_suffix(".mp3")

    if not meta_path.exists():
        return None

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        audio_bytes = b""
        if audio_path.exists():
            audio_bytes = audio_path.read_bytes()

        meta["audio_bytes"] = audio_bytes
        logger.info("Serving cached analogy for '%s'", concept_node)
        return meta
    except Exception as e:
        logger.error("Failed to load cached analogy for '%s': %s", concept_node, e)
        return None


def save_cached_analogy(
    concept_node: str,
    original_text: str,
    analogy_text: str,
    avatar: str,
    audio_bytes: bytes,
    latency_ms: dict,
) -> None:
    """Save a complete analogy result to the cache.

    Writes:
        - <concept>.json — metadata (text, avatar, latency)
        - <concept>.mp3 — audio bytes
    """
    base = _cache_path(concept_node)

    meta = {
        "concept_node": concept_node,
        "original_text": original_text,
        "analogy_text": analogy_text,
        "avatar": avatar,
        "latency_ms": latency_ms,
    }

    try:
        base.with_suffix(".json").write_text(
            json.dumps(meta, indent=2), encoding="utf-8"
        )
        if audio_bytes:
            base.with_suffix(".mp3").write_bytes(audio_bytes)

        logger.info(
            "Cached analogy for '%s' (%d bytes audio)",
            concept_node,
            len(audio_bytes),
        )
    except Exception as e:
        logger.error("Failed to cache analogy for '%s': %s", concept_node, e)


def pre_cache_analogy(
    concept_node: str,
    chunk_text: str,
    avatar_str: str = "cricketer",
) -> bool:
    """Run the full pipeline (embed → retrieve → Gemini → ElevenLabs) and cache.

    This is the "Phase 8" pre-cache step called by demo_setup.sh.
    Returns True if caching succeeded, False otherwise.
    """
    from models.schemas import InterestAvatar
    from services.embedder import Embedder
    from services.vectorai_client import VectorAIClient
    from services.gemini_client import GeminiClient
    from services.elevenlabs_client import ElevenLabsClient

    try:
        avatar = InterestAvatar(avatar_str)
    except ValueError:
        avatar = InterestAvatar.CRICKETER

    logger.info("Pre-caching analogy for '%s' (avatar=%s)...", concept_node, avatar.value)

    try:
        # 1. Embed the chunk
        embedder = Embedder()
        query_vec, embed_ms = embedder.encode_with_latency(chunk_text)

        # 2. Retrieve best past explanation from VectorAI DB
        vdb = VectorAIClient()
        vdb.connect()
        try:
            hits = vdb.search_similar(query_vec, limit=1)
        finally:
            vdb.close()

        if hits:
            original_text = hits[0].get("payload", {}).get("text", chunk_text)
            retrieval_ms = 0.0  # We don't time the retrieval here
        else:
            original_text = chunk_text
            retrieval_ms = 0.0

        # 3. Gemini rewrite
        gemini = GeminiClient()
        analogy_text, gemini_ms = gemini.rewrite_analogy(
            concept_node, original_text, avatar
        )

        # 4. ElevenLabs TTS
        tts = ElevenLabsClient()
        audio_bytes, tts_ms = tts.text_to_speech(analogy_text)

        # 5. Save to disk
        save_cached_analogy(
            concept_node=concept_node,
            original_text=original_text,
            analogy_text=analogy_text,
            avatar=avatar.value,
            audio_bytes=audio_bytes,
            latency_ms={
                "embedding": embed_ms,
                "retrieval": retrieval_ms,
                "gemini": gemini_ms,
                "elevenlabs": tts_ms,
            },
        )
        logger.info("Pre-cache complete for '%s'", concept_node)
        return True

    except Exception as e:
        logger.error("Pre-cache failed for '%s': %s", concept_node, e)
        return False
