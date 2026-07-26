"""Legilimens — FastAPI orchestrator (the "school server" hub).

Production-grade app with:
  - Structured logging
  - CORS middleware (configurable origins)
  - Startup/shutdown lifecycle (DB init, client warmup)
  - All routers mounted (websocket, asr, retrieval, analytics, recording, transcription)
  - Health check with dependency status
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.ratelimit import RateLimitMiddleware

from config import settings
from logging_config import setup_logging
from models.database import init_confusion_events_table
from services.embedder import Embedder
from services.vectorai_client import VectorAIClient
from services.vector_client import VectorAnalyticsClient
from dependencies import set_embedder, set_vectorai, set_analytics
from routers import websocket, asr, retrieval, analytics, recording, transcription, vision
from routers.auth import router as auth_router

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

    # 0. MongoDB (user auth) — non-fatal if unreachable (network/TLS issues degrade auth only)
    from services.mongodb_client import connect_mongodb
    try:
        await connect_mongodb()
        logger.info("MongoDB Atlas connected — auth endpoints active")
    except Exception as e:
        logger.warning(
            "MongoDB Atlas unreachable (%s) — auth endpoints will return 503. "
            "All other routes (radar, retrieval, WebSocket) work normally.", e
        )

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
        set_embedder(embedder)
    except Exception:
        logger.exception("Failed to load embedder — retrieval pipeline will be degraded")
        set_embedder(None)

    # 3. Actian VectorAI DB
    logger.info("Connecting to Actian VectorAI DB at %s:%d...", settings.vectorai_host, settings.vectorai_port)
    try:
        vectorai_client = VectorAIClient()
        vectorai_client.connect()
        vectorai_client.create_lecture_chunks_collection()
        logger.info("VectorAI DB connected — lecture_chunks collection ready")
        set_vectorai(vectorai_client)
    except Exception:
        logger.exception("Failed to connect to VectorAI DB — retrieval will be degraded")
        set_vectorai(None)

    # 4. Actian Vector (analytics)
    logger.info("Connecting to Actian Vector at %s:%d...", settings.vector_host, settings.vector_port)
    try:
        vector_analytics = VectorAnalyticsClient()
        init_confusion_events_table()
        logger.info("Actian Vector connected — confusion_events table ready")
        set_analytics(vector_analytics)
    except Exception as e:
        logger.exception("Failed to connect to Actian Vector — analytics will be degraded: %s", e)
        set_analytics(None)

    # Log service health summary
    logger.info("Startup complete — embedder=%s, vectorai=%s, analytics=%s",
                bool(embedder), bool(vectorai_client), bool(vector_analytics))

    yield  # Application runs here

    # Shutdown
    logger.info("Legilimens shutting down...")
    from services.mongodb_client import close_mongodb
    await close_mongodb()
    try:
        from dependencies import get_vectorai, get_analytics
        vdb = get_vectorai()
        if vdb:
            vdb.close()
        analytics = get_analytics()
        if analytics:
            analytics.close()
    except RuntimeError:
        pass  # Service not initialized, that's fine
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

    # Rate limiting — 60 requests/min/IP, burst 10
    app.add_middleware(RateLimitMiddleware, requests_per_minute=60, burst=10)

    # ─── Health check ──────────────────────────────────────────────
    @app.get("/health")
    async def health() -> dict:
        """Liveness + dependency health probe."""
        from dependencies import get_embedder, get_vectorai
        analytics_ok = False
        try:
            from dependencies import get_analytics
            analytics_ok = get_analytics() is not None
        except RuntimeError:
            pass
        vectorai_ok = False
        try:
            vectorai_ok = get_vectorai() is not None
        except RuntimeError:
            pass
        embedder_ok = False
        try:
            embedder_ok = get_embedder() is not None
        except RuntimeError:
            pass
        return {
            "status": "ok",
            "service": "legilimens",
            "version": app.version,
            "services": {
                "embedder": embedder_ok,
                "vectorai_db": vectorai_ok,
                "actian_vector": analytics_ok,
            },
        }

    # ─── Metrics ───────────────────────────────────────────────────
    @app.get("/metrics")
    async def metrics() -> dict:
        """Basic operational metrics for monitoring."""
        from dependencies import get_embedder, get_vectorai, get_analytics
        metrics_data = {
            "uptime_seconds": 0,
            "embedder_loaded": embedder is not None,
            "vectorai_connected": vectorai_client is not None,
            "analytics_connected": vector_analytics is not None,
        }
        try:
            from routers.websocket import manager
            total_connections = sum(
                len(students) for students in manager._connections.values()
            )
            metrics_data["active_websocket_connections"] = total_connections
            metrics_data["active_lectures"] = len(manager._connections)
        except Exception:
            pass
        return metrics_data

    # ─── Mount routers ────────────────────────────────────────────
    app.include_router(auth_router)
    app.include_router(websocket.router)
    app.include_router(asr.router)
    app.include_router(retrieval.router)
    app.include_router(analytics.router)
    app.include_router(recording.router)
    app.include_router(transcription.router)
    app.include_router(vision.router)

    return app


app = create_app()