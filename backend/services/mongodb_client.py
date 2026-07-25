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
    _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)

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
    """Return the live database instance. Raises if not connected."""
    if _db is None:
        raise RuntimeError("MongoDB not connected — call connect_mongodb() first")
    return _db
