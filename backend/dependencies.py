"""FastAPI dependencies for the Legilimens backend.

This module provides dependency injection functions that can be imported
by routers without creating circular imports with main.py.
"""
from __future__ import annotations

from services.embedder import Embedder
from services.vectorai_client import VectorAIClient
from services.vector_client import VectorAnalyticsClient


# These are set by main.py at startup
_embedder: Embedder | None = None
_vectorai_client: VectorAIClient | None = None
_vector_analytics: VectorAnalyticsClient | None = None


def set_embedder(emb: Embedder) -> None:
    global _embedder
    _embedder = emb


def set_vectorai(client: VectorAIClient) -> None:
    global _vectorai_client
    _vectorai_client = client


def set_analytics(client: VectorAnalyticsClient) -> None:
    global _vector_analytics
    _vector_analytics = client


def get_embedder() -> Embedder:
    """FastAPI dependency — returns the warmed-up embedder singleton."""
    if _embedder is None:
        raise RuntimeError("Embedder not initialized — server not started")
    return _embedder


def get_vectorai() -> VectorAIClient | None:
    """FastAPI dependency — returns the VectorAI DB client singleton (or None if unavailable)."""
    return _vectorai_client


def get_analytics() -> VectorAnalyticsClient:
    """FastAPI dependency — returns the Actian Vector analytics client singleton."""
    if _vector_analytics is None:
        raise RuntimeError("Analytics client not initialized — server not started")
    return _vector_analytics