"""Database connection management for Actian Vector (columnar analytics).

Provides:
  - Thread-safe connection pool via a queue
  - Configurable retry with exponential backoff
  - Context managers for safe commit/rollback
  - Idempotent table creation (DDL)
  - Health check
"""
from __future__ import annotations

import logging
import queue
import threading
import time
from contextlib import contextmanager
from typing import Generator, Optional

from config import settings

logger = logging.getLogger(__name__)

# ─── Connection pool ─────────────────────────────────────────────

class ConnectionPool:
    """Simple thread-safe connection pool for Actian Vector ODBC connections.

    Reuses connections to avoid per-query overhead. Connections are validated
    on borrow and recreated on stale.
    """

    def __init__(
        self,
        min_size: int = 1,
        max_size: int = 5,
        idle_timeout: float = 300.0,
        validate_on_borrow: bool = True,
    ):
        self._pool: queue.Queue = queue.Queue(maxsize=max_size)
        self._min_size = min_size
        self._max_size = max_size
        self._idle_timeout = idle_timeout
        self._validate_on_borrow = validate_on_borrow
        self._lock = threading.Lock()
        self._size = 0

        # Pre-warm
        for _ in range(min_size):
            try:
                conn = self._create_connection()
                self._pool.put(self._Wrap(conn, self._idle_timeout))
                self._size += 1
            except Exception:
                logger.warning("Failed to pre-warm a pool connection (non-fatal)")

    def _create_connection(self):
        """Create a new ODBC connection to Actian Vector."""
        import pyodbc

        conn_str = (
            f"DRIVER={{Ingres}};"
            f"SERVER={settings.vector_host};"
            f"PORT={settings.vector_port};"
            f"DATABASE={settings.vector_database};"
            f"UID={settings.vector_user};"
            f"PWD={settings.vector_password};"
        )
        conn = pyodbc.connect(conn_str, autocommit=False)
        conn.timeout = 10
        return conn

    def get(self, timeout: float = 5.0):
        """Borrow a connection from the pool. Raises queue.Empty on timeout."""
        try:
            wrapped = self._pool.get(timeout=timeout)
        except queue.Empty:
            # Try to create a new one if under max
            with self._lock:
                if self._size < self._max_size:
                    conn = self._create_connection()
                    self._size += 1
                    return self._Wrap(conn, self._idle_timeout)
            raise queue.Empty("No connections available")

        # Validate stale connections
        if self._validate_on_borrow and wrapped.is_stale():
            try:
                wrapped.close()
            except Exception:
                pass
            with self._lock:
                self._size -= 1
            conn = self._create_connection()
            with self._lock:
                self._size += 1
            return self._Wrap(conn, self._idle_timeout)

        return wrapped

    def put(self, wrapped) -> None:
        """Return a connection to the pool."""
        try:
            self._pool.put_nowait(wrapped)
        except queue.Full:
            try:
                wrapped.close()
            except Exception:
                pass
            with self._lock:
                self._size -= 1

    def close_all(self) -> None:
        """Close every connection in the pool."""
        while True:
            try:
                wrapped = self._pool.get_nowait()
                wrapped.close()
                with self._lock:
                    self._size -= 1
            except queue.Empty:
                break

    def health(self) -> bool:
        """Check if at least one connection is alive."""
        try:
            wrapped = self.get(timeout=2.0)
            try:
                cursor = wrapped.conn.cursor()
                cursor.execute("SELECT 1")
                return True
            finally:
                self.put(wrapped)
        except Exception:
            return False

    class _Wrap:
        """Wrapper that tracks idle time for connection eviction."""

        def __init__(self, conn, idle_timeout: float):
            self.conn = conn
            self._idle_timeout = idle_timeout
            self._last_used = time.monotonic()

        def touch(self) -> None:
            self._last_used = time.monotonic()

        def is_stale(self) -> bool:
            return (time.monotonic() - self._last_used) > self._idle_timeout

        def close(self) -> None:
            try:
                self.conn.close()
            except Exception:
                pass


# ─── Module-level singleton ─────────────────────────────────────

_pool: Optional[ConnectionPool] = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(min_size=1, max_size=5)
        logger.info("Actian Vector connection pool initialized")
    return _pool


def close_pool() -> None:
    global _pool
    if _pool:
        _pool.close_all()
        _pool = None
        logger.info("Actian Vector connection pool closed")


# ─── Context manager for safe SQL execution ─────────────────────

@contextmanager
def get_vector_connection() -> Generator:
    """Yield a pyodbc connection from the pool. Auto-commits on success, rolls back on error."""
    pool = get_pool()
    wrapped = pool.get()
    wrapped.touch()
    conn = wrapped.conn
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.put(wrapped)


# ─── Retry decorator ─────────────────────────────────────────────

def with_retry(max_retries: int = 3, backoff_base: float = 1.0, retryable_exceptions: tuple = (Exception,)):
    """Decorator to retry a function with exponential backoff."""
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
            raise last_exc  # type: ignore

        return wrapper
    return decorator


# ─── DDL ─────────────────────────────────────────────────────────

def init_confusion_events_table() -> None:
    """Create the confusion_events table if it doesn't exist. Idempotent."""
    with get_vector_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS confusion_events (
                event_id     BIGINT        NOT NULL,
                lecture_id   INT           NOT NULL,
                student_id   VARCHAR(64)   NOT NULL,
                concept_node VARCHAR(64)   NOT NULL,
                ts           TIMESTAMP     NOT NULL,
                signal_type  VARCHAR(16)   NOT NULL CHECK (signal_type IN ('lost', 'gotit', 'slower')),
                cohort       VARCHAR(32)   NOT NULL DEFAULT 'default'
            );
        """)

        # Indexes for the Pensieve queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_ce_lecture_ts
                ON confusion_events (lecture_id, ts);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_ce_concept
                ON confusion_events (lecture_id, concept_node, signal_type);
        """)

        logger.info("confusion_events table ready")


def init_lectures_table() -> None:
    """Create the lectures metadata table. Idempotent."""
    with get_vector_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lectures (
                lecture_id   INT           PRIMARY KEY,
                title        VARCHAR(256)  NOT NULL,
                topic        VARCHAR(128)  NOT NULL,
                started_at   TIMESTAMP     NOT NULL,
                ended_at     TIMESTAMP,
                status       VARCHAR(16)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'ended'))
            );
        """)
        logger.info("lectures table ready")


def init_current_chunk_table() -> None:
    """Tracks the 'current' concept node for each active lecture.
    Updated as Whisper chunks arrive, so pings can tag to the right node.
    """
    with get_vector_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS current_chunk (
                lecture_id   INT           PRIMARY KEY,
                chunk_id     VARCHAR(64)   NOT NULL,
                topic_node   VARCHAR(64)   NOT NULL,
                text_preview VARCHAR(256)  NOT NULL,
                ts           TIMESTAMP     NOT NULL
            );
        """)
        logger.info("current_chunk table ready")


def init_all_tables() -> None:
    """Initialize all tables. Safe to call on every startup."""
    init_lectures_table()
    init_confusion_events_table()
    init_current_chunk_table()
