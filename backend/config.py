"""Application settings, loaded from environment via pydantic-settings.

Mirrors the env vars in the root `.env.example`. Values fall back to sane
local-dev defaults so `uvicorn main:app` boots before any Actian/cloud keys exist.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_DEFAULT_JWT_SECRET = "legilimens-default-dev-secret-change-in-prod"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ─── Actian VectorAI DB (retrieval brain) ─────────────────────
    vectorai_host: str = "localhost"
    vectorai_port: int = 6574
    vectorai_collection: str = "lecture_chunks"
    vectorai_dim: int = 384

    # ─── Actian Vector (columnar analytics) ───────────────────────
    vector_host: str = "localhost"
    vector_port: int = 5432
    vector_database: str = "actian"
    vector_user: str = "admin"
    vector_password: str = "password"

    # ─── Cloud generative step ────────────────────────────────────
    gemini_api_key: str = ""
    elevenlabs_api_key: str = ""

    # ─── Whisper (ASR) ────────────────────────────────────────────
    whisper_model_path: str = "./models/ggml-base.en.bin"

    # ─── CORS ─────────────────────────────────────────────────────
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # ─── MongoDB (user auth) ──────────────────────────────────────
    mongodb_uri: str = ""
    mongodb_db_name: str = "legilimens"

    # ─── JWT ──────────────────────────────────────────────────────
    jwt_secret: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60 * 24 * 7  # 7 days


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.jwt_secret == _DEFAULT_JWT_SECRET and os.environ.get("LEGILIMENS_ENV") == "production":
        logger.warning(
            "JWT secret is still the default development value! "
            "Set LEGILIMENS_SECRET to a random 32+ char value in production."
        )
    return s


settings = get_settings()
