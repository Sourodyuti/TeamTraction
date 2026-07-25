"""Legilimens — FastAPI orchestrator (the "school server" hub).

Production-grade app with:
  - Structured logging
  - CORS middleware (configurable origins)
  - Startup/shutdown lifecycle (DB init, client warmup)
  - All routers mounted (websocket, asr, retrieval, analytics)
  - Health check with dependency status
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from logging_config import setup_logging
from models.database import init_confusion_events_table
from services.embedder import Embedder
from services.vectorai_client import VectorAIClient
from services.vector_client import VectorAnalyticsClient
from routers import websocket, asr, retrieval, analytics

logger = logging.getLogger(__name__)

# ─── Module-level singletons (initialized at startup) ────────────

embedder: Embedder | None = None
vectorai_client: VectorAIClient | None = None
vector_analytics: VectorAnalyticsClient | None = None


def get_embedder() -> Embedder:
    """FastAPI dependency — returns the warmed-up embedder singleton."""
    if embedder is None:
        raise RuntimeError("Embedder not initialized — server not started")
    return embedder


def get_vectorai() -> VectorAIClient:
    """FastAPI dependency — returns the VectorAI DB client singleton."""
    if vectorai_client is None:
        raise RuntimeError("VectorAI client not initialized — server not started")
    return vectorai_client


def get_analytics() -> VectorAnalyticsClient:
    """FastAPI dependency — returns the Actian Vector analytics client singleton."""
    if vector_analytics is None:
        raise RuntimeError("Analytics client not initialized — server not started")
    return vector_analytics


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown lifecycle.

    Startup:
      1. Configure logging
      2. Warm up embedder (download model if needed)
      3. Connect to Actian VectorAI DB, create collection
      4. Connect to Actian Vector, create confusion_events table
    Shutdown:
      1. Close DB connections gracefully
    """
    global embedder, vectorai_client, vector_analytics

    logger.info("🔮 Legilimens starting up...")

    # 1. Logging
    setup_logging(level="INFO")
    logger.info("Logging configured")

    # 2. Embedder (download + load bge-small — ~100MB first time)
    logger.info("Loading bge-small-en embedder (384-dim)...")
    try:
        embedder = Embedder()
        # Pre-warm with a test encoding to trigger any download errors
        _ = embedder.encode("warmup")
        logger.info("Embedder ready (dim=%d)", embedder.dim)
    except Exception:
        logger.exception("Failed to load embedder — retrieval pipeline will be degraded")
        embedder = None

    # 3. Actian VectorAI DB
    logger.info("Connecting to Actian VectorAI DB at %s:%d...", settings.vectorai_host, settings.vectorai_port)
    try:
        vectorai_client = VectorAIClient()
        vectorai_client.connect()
        vectorai_client.create_lecture_chunks_collection()
        logger.info("VectorAI DB connected — lecture_chunks collection ready")
    except Exception:
        logger.exception("Failed to connect to VectorAI DB — retrieval will be degraded")
        vectorai_client = None

    # 4. Actian Vector (analytics)
    logger.info("Connecting to Actian Vector at %s:%d...", settings.vector_host, settings.vector_port)
    try:
        vector_analytics = VectorAnalyticsClient()
        init_confusion_events_table()
        logger.info("Actian Vector connected — confusion_events table ready")
    except Exception:
        logger.exception("Failed to connect to Actian Vector — analytics will be degraded")
        vector_analytics = None

    # Log service health summary
    logger.info("Startup complete — embedder=%s, vectorai=%s, analytics=%s",
                bool(embedder), bool(vectorai_client), bool(vector_analytics))

    yield  # Application runs here

    # Shutdown
    logger.info("Legilimens shutting down...")
    if vectorai_client:
        vectorai_client.close()
    if vector_analytics:
        vector_analytics.close()
    logger.info("Connections closed. Goodbye.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Legilimens",
        description=(
            "Real-time classroom confusion radar + auto-analogy engine. "
            "On-prem retrieval on Actian VectorAI DB; columnar analytics on Actian Vector."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS — permissive for dev, tighten for production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ─── Health check ──────────────────────────────────────────────
    @app.get("/health")
    async def health() -> dict:
        """Liveness + dependency health probe."""
        return {
            "status": "ok",
            "service": "legilimens",
            "version": app.version,
            "services": {
                "embedder": embedder is not None,
                "vectorai_db": vectorai_client is not None if vectorai_client else False,
                "actian_vector": vector_analytics is not None if vector_analytics else False,
            },
        }

    # ─── Mount routers ────────────────────────────────────────────
    app.include_router(websocket.router)
    app.include_router(asr.router)
    app.include_router(retrieval.router)
    app.include_router(analytics.router)

    return app


app = create_app()
