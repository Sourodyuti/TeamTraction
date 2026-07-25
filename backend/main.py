"""Legilimens — FastAPI orchestrator (the "school server" hub).

Phase 0: app factory + /health. Subsequent phases mount the routers:
  - routers.websocket   (Phase 2)  Muffliato ping hub
  - routers.asr         (Phase 1)  Whisper transcript ingestion
  - routers.retrieval   (Phase 4)  Accio Analogy
  - routers.analytics   (Phase 7)  Pensieve SQL
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Legilimens",
        description=(
            "Real-time classroom confusion radar + auto-analogy engine. "
            "On-prem retrieval on Actian VectorAI DB; columnar analytics on Actian Vector."
        ),
        version="0.1.0",
    )

    # Permissive CORS for the Next.js dev server + the PWA on phones.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict:
        """Liveness probe. Phase 0 exit gate checks this returns 200."""
        return {"status": "ok", "service": "legilimens", "version": app.version}

    # Routers are mounted here as their phases land, e.g.:
    # from routers import websocket, asr, retrieval, analytics
    # app.include_router(websocket.router)
    # app.include_router(asr.router)
    # app.include_router(retrieval.router)
    # app.include_router(analytics.router)

    return app


app = create_app()
