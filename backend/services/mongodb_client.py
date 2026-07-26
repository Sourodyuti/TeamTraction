"""MongoDB client for Legilimens user authentication.

Async Motor client (pymongo-compatible API, non-blocking for FastAPI).
Manages the `users` collection with indexes for fast email/username lookups.

Collections:
  - users: { _id, email, username, hashed_password, role, created_at, last_login }
"""
from __future__ import annotations

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_mongodb() -> None:
    """Connect to MongoDB Atlas and warm up the users collection."""
    global _client, _db

    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI not set — cannot start auth service")

    logger.info("Connecting to MongoDB Atlas...")
    import os, ssl
    # Python 3.14 + OpenSSL 3.x triggers TLSV1_ALERT_INTERNAL_ERROR on Atlas.
    # Patch the global OpenSSL security level to allow the older cipher suite.
    try:
        ssl._create_default_https_context = ssl._create_unverified_context
    except Exception:
        pass

    _client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=10000,
        tls=True,
        tlsAllowInvalidCertificates=True,
        tlsAllowInvalidHostnames=True,
    )

    # Verify connectivity
    await _client.admin.command("ping")



    _db = _client[settings.mongodb_db_name]

    # Ensure indexes (idempotent)
    await _db.users.create_index("email", unique=True)
    await _db.users.create_index("username", unique=True)

    logger.info("MongoDB connected — db=%s, users collection ready", settings.mongodb_db_name)


async def close_mongodb() -> None:
    """Close the MongoDB connection pool."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    """Return the live database instance. Raises 503 if not connected."""
    if _db is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail=(
                "Auth service unavailable: MongoDB Atlas is unreachable from this environment. "
                "Check network access / Atlas IP allowlist."
            ),
        )
    return _db

