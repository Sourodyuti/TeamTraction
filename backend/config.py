"""Application settings, loaded from environment via pydantic-settings.

Mirrors the env vars in the root `.env.example`. Values fall back to sane
local-dev defaults so `uvicorn main:app` boots before any Actian/cloud keys exist.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ─── Actian VectorAI DB (retrieval brain) ─────────────────────
    vectorai_host: str = "localhost"
    vectorai_port: int = 6574  # gRPC; REST is 6573
    vectorai_collection: str = "lecture_chunks"
    vectorai_dim: int = 384  # bge-small-en output

    # ─── Actian Vector (columnar analytics) ───────────────────────
    vector_host: str = "localhost"
    vector_port: int = 5432  # TODO VERIFY: confirm Actian Vector default SQL port
    vector_database: str = "actian"
    vector_user: str = "admin"
    vector_password: str = "password"

    # ─── Cloud generative step ────────────────────────────────────
    gemini_api_key: str = ""
    elevenlabs_api_key: str = ""

    # ─── Whisper.cpp (ASR — stretch goal) ─────────────────────────
    whisper_model_path: str = "./models/ggml-base.en.bin"

    # ─── CORS ─────────────────────────────────────────────────────
    # Next.js dev (3000) + LAN phone access. Extend via CORS_ORIGINS env.
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # ─── MongoDB (user auth) ──────────────────────────────────────
    mongodb_uri: str = ""
    mongodb_db_name: str = "legilimens"

    # ─── JWT ──────────────────────────────────────────────────────
    jwt_secret: str = "legilimens-default-dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60 * 24 * 7  # 7 days


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
