"""Database backends for Actian Vector (columnar analytics).

Provides two implementations:
  1. ActianBackend  — production: Ingres ODBC via pyodbc (air-gapped school server)
  2. SqliteBackend  — dev/demo: SQLite with same schema (no ODBC driver needed)

Auto-detects which backend to use at startup. The `get_vector_connection()`
context manager and `with_retry` decorator remain the public API — callers
don't need to know which backend is active.
"""
from __future__ import annotations

import logging
import os
import sqlite3
import threading
import time
from abc import ABC, abstractmethod
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Generator, Optional

from config import settings

logger = logging.getLogger(__name__)

# ─── Abstract backend ───────────────────────────────────────────

class DatabaseBackend(ABC):
    """Abstract database backend with Actian-Vector-compatible schema."""

    @abstractmethod
    def get_conn(self) -> Any:
        ...

    @abstractmethod
    def close(self) -> None:
        ...

    @abstractmethod
    def health(self) -> bool:
        ...

    @abstractmethod
    def table_exists(self, cursor, table_name: str) -> bool:
        ...

    @abstractmethod
    def index_exists(self, cursor, index_name: str) -> bool:
        ...

    @abstractmethod
    def init_confusion_events_table(self) -> None:
        ...

    @abstractmethod
    def init_lectures_table(self) -> None:
        ...

    @abstractmethod
    def init_current_chunk_table(self) -> None:
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        ...


# ─── Actian Vector (Ingres ODBC) backend ────────────────────────

class ActianBackend(DatabaseBackend):
    """Production backend — connects to Actian Vector via Ingres ODBC driver."""

    def __init__(self) -> None:
        import pyodbc
        self._module = pyodbc
        self._conn: Any = None
        self._lock = threading.Lock()

    def _connect(self):
        conn_str = (
            f"DRIVER={{Ingres}};"
            f"SERVER={settings.vector_host};"
            f"PORT={settings.vector_port};"
            f"DATABASE={settings.vector_database};"
            f"UID={settings.vector_user};"
            f"PWD={settings.vector_password};"
        )
        conn = self._module.connect(conn_str, autocommit=False)
        conn.timeout = 10
        return conn

    def get_conn(self):
        if self._conn is None:
            self._conn = self._connect()
        return self._conn

    def close(self):
        with self._lock:
            if self._conn:
                try:
                    self._conn.close()
                except Exception:
                    pass
                self._conn = None

    def health(self) -> bool:
        try:
            conn = self.get_conn()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            return True
        except Exception:
            return False

    def table_exists(self, cursor, table_name: str) -> bool:
        cursor.execute(
            "SELECT COUNT(*) FROM iirelation WHERE relid = ?",
            (table_name.lower(),),
        )
        row = cursor.fetchone()
        return bool(row and row[0] > 0)

    def index_exists(self, cursor, index_name: str) -> bool:
        cursor.execute(
            "SELECT COUNT(*) FROM iiindex WHERE index_name = ?",
            (index_name.lower(),),
        )
        row = cursor.fetchone()
        return bool(row and row[0] > 0)

    def init_confusion_events_table(self) -> None:
        conn = self.get_conn()
        cursor = conn.cursor()
        if not self.table_exists(cursor, "confusion_events"):
            cursor.execute("""
                CREATE TABLE confusion_events (
                    event_id     BIGINT        NOT NULL,
                    lecture_id   INT           NOT NULL,
                    student_id   VARCHAR(64)   NOT NULL,
                    concept_node VARCHAR(64)   NOT NULL,
                    ts           TIMESTAMP     NOT NULL,
                    signal_type  VARCHAR(16)   NOT NULL
                        CHECK (signal_type IN ('lost', 'gotit', 'slower')),
                    cohort       VARCHAR(32)   NOT NULL WITH DEFAULT 'default'
                )
            """)
            logger.info("confusion_events table created (Actian)")
        else:
            logger.debug("confusion_events already exists")
        if not self.index_exists(cursor, "idx_ce_lecture_ts"):
            cursor.execute("CREATE INDEX idx_ce_lecture_ts ON confusion_events (lecture_id, ts)")
            logger.info("idx_ce_lecture_ts index created")
        if not self.index_exists(cursor, "idx_ce_concept"):
            cursor.execute("CREATE INDEX idx_ce_concept ON confusion_events (lecture_id, concept_node, signal_type)")
            logger.info("idx_ce_concept index created")
        conn.commit()

    def init_lectures_table(self) -> None:
        conn = self.get_conn()
        cursor = conn.cursor()
        if not self.table_exists(cursor, "lectures"):
            cursor.execute("""
                CREATE TABLE lectures (
                    lecture_id   INT           NOT NULL PRIMARY KEY,
                    title        VARCHAR(256)  NOT NULL,
                    topic        VARCHAR(128)  NOT NULL,
                    started_at   TIMESTAMP     NOT NULL,
                    ended_at     TIMESTAMP,
                    status       VARCHAR(16)   NOT NULL WITH DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'ended'))
                )
            """)
            logger.info("lectures table created (Actian)")
        conn.commit()

    def init_current_chunk_table(self) -> None:
        conn = self.get_conn()
        cursor = conn.cursor()
        if not self.table_exists(cursor, "current_chunk"):
            cursor.execute("""
                CREATE TABLE current_chunk (
                    lecture_id   INT           NOT NULL PRIMARY KEY,
                    chunk_id     VARCHAR(64)   NOT NULL,
                    topic_node   VARCHAR(64)   NOT NULL,
                    text_preview VARCHAR(256)  NOT NULL,
                    ts           TIMESTAMP     NOT NULL
                )
            """)
            logger.info("current_chunk table created (Actian)")
        conn.commit()

    @property
    def name(self) -> str:
        return "actian_vector"


# ─── SQLite backend (dev / demo fallback) ───────────────────────

_SQLITE_DIR = Path(__file__).resolve().parent.parent / "data"
_SQLITE_PATH = _SQLITE_DIR / "legilimens.db"


class SqliteBackend(DatabaseBackend):
    """Dev/demo backend — SQLite with the same schema as Actian Vector.

    The Ingres-specific SQL dialect (FETCH FIRST, date_add, CAST … AS FLOAT)
    is translated to SQLite equivalents so all Pensieve queries work identically.
    """

    def __init__(self, db_path: str | Path = _SQLITE_PATH) -> None:
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        logger.info("SQLite backend path: %s", self._db_path)

    def _get_conn(self):
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(str(self._db_path))
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA foreign_keys=ON")
        return self._local.conn

    def get_conn(self):
        return self._get_conn()

    def close(self):
        if hasattr(self._local, "conn") and self._local.conn:
            try:
                self._local.conn.close()
            except Exception:
                pass
            self._local.conn = None

    def health(self) -> bool:
        try:
            conn = self.get_conn()
            conn.execute("SELECT 1")
            return True
        except Exception:
            return False

    def table_exists(self, cursor, table_name: str) -> bool:
        cursor.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND LOWER(name)=?",
            (table_name.lower(),),
        )
        row = cursor.fetchone()
        return bool(row and row[0] > 0)

    def index_exists(self, cursor, index_name: str) -> bool:
        cursor.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND LOWER(name)=?",
            (index_name.lower(),),
        )
        row = cursor.fetchone()
        return bool(row and row[0] > 0)

    def init_confusion_events_table(self) -> None:
        conn = self.get_conn()
        cursor = conn.cursor()
        if not self.table_exists(cursor, "confusion_events"):
            cursor.execute("""
                CREATE TABLE confusion_events (
                    event_id     INTEGER NOT NULL,
                    lecture_id   INTEGER NOT NULL,
                    student_id   TEXT    NOT NULL,
                    concept_node TEXT    NOT NULL,
                    ts           TEXT    NOT NULL,
                    signal_type  TEXT    NOT NULL CHECK (signal_type IN ('lost', 'gotit', 'slower')),
                    cohort       TEXT    NOT NULL DEFAULT 'default'
                )
            """)
            logger.info("confusion_events table created (SQLite)")
        else:
            logger.debug("confusion_events already exists")
        if not self.index_exists(cursor, "idx_ce_lecture_ts"):
            cursor.execute("CREATE INDEX idx_ce_lecture_ts ON confusion_events (lecture_id, ts)")
        if not self.index_exists(cursor, "idx_ce_concept"):
            cursor.execute("CREATE INDEX idx_ce_concept ON confusion_events (lecture_id, concept_node, signal_type)")
        conn.commit()

    def init_lectures_table(self) -> None:
        conn = self.get_conn()
        cursor = conn.cursor()
        if not self.table_exists(cursor, "lectures"):
            cursor.execute("""
                CREATE TABLE lectures (
                    lecture_id INTEGER NOT NULL PRIMARY KEY,
                    title      TEXT    NOT NULL,
                    topic      TEXT    NOT NULL,
                    started_at TEXT    NOT NULL,
                    ended_at   TEXT,
                    status     TEXT    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'ended'))
                )
            """)
            logger.info("lectures table created (SQLite)")
        conn.commit()

    def init_current_chunk_table(self) -> None:
        conn = self.get_conn()
        cursor = conn.cursor()
        if not self.table_exists(cursor, "current_chunk"):
            cursor.execute("""
                CREATE TABLE current_chunk (
                    lecture_id   INTEGER NOT NULL PRIMARY KEY,
                    chunk_id     TEXT    NOT NULL,
                    topic_node   TEXT    NOT NULL,
                    text_preview TEXT    NOT NULL,
                    ts           TEXT    NOT NULL
                )
            """)
            logger.info("current_chunk table created (SQLite)")
        conn.commit()

    @property
    def name(self) -> str:
        return "sqlite"


# ─── Auto-detect backend ───────────────────────────────────────

def _detect_backend() -> DatabaseBackend:
    """Try Actian Vector first; fall back to SQLite."""
    # If explicitly set, use that
    force = os.environ.get("LEGILIMENS_DB_BACKEND", "").strip().lower()
    if force == "actian":
        logger.info("Forcing Actian Vector backend via LEGILIMENS_DB_BACKEND=actian")
        return ActianBackend()
    if force == "sqlite":
        logger.info("Forcing SQLite backend via LEGILIMENS_DB_BACKEND=sqlite")
        return SqliteBackend()

    # Auto-detect: try Actian ODBC, fall back to SQLite
    try:
        import pyodbc
        backend = ActianBackend()
        if backend.health():
            logger.info("Auto-detected Actian Vector backend (ODBC)")
            return backend
        logger.info("Actian Vector ODBC unreachable — falling back to SQLite")
    except Exception:
        logger.info("pyodbc/Actian Vector unavailable — falling back to SQLite")

    return SqliteBackend()


# ─── Module-level singleton ─────────────────────────────────────

_backend: Optional[DatabaseBackend] = None


def get_backend() -> DatabaseBackend:
    global _backend
    if _backend is None:
        _backend = _detect_backend()
        logger.info("Database backend: %s", _backend.name)
    return _backend


def close_backend() -> None:
    global _backend
    if _backend:
        _backend.close()
        _backend = None


# ─── Context manager (unchanged API for callers) ────────────────

@contextmanager
def get_vector_connection() -> Generator:
    """Yield a DB-API connection from the active backend.

    Auto-commits on success, rolls back on error.
    Compatible with both Actian ODBC (pyodbc) and SQLite (sqlite3).
    """
    backend = get_backend()
    conn = backend.get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


# ─── Retry decorator (unchanged API) ────────────────────────────

def with_retry(max_retries: int = 3, backoff_base: float = 1.0,
               retryable_exceptions: tuple = (Exception,)):
    import functools

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exc = e
                    if attempt < max_retries:
                        delay = backoff_base * (2 ** (attempt - 1))
                        logger.warning(
                            "%s failed (attempt %d/%d, retrying in %.1fs): %s",
                            func.__name__, attempt, max_retries, delay, e,
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            "%s failed after %d attempts: %s",
                            func.__name__, max_retries, e,
                        )
            raise last_exc
        return wrapper
    return decorator


# ─── Convenience: init all tables ───────────────────────────────

def init_all_tables() -> None:
    """Initialize all tables on the active backend. Safe to call on every startup."""
    backend = get_backend()
    backend.init_lectures_table()
    backend.init_confusion_events_table()
    backend.init_current_chunk_table()
    logger.info("All tables ready (backend=%s)", backend.name)
