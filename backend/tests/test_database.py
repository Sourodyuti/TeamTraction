"""Tests for the database backends and retry logic in models/database.py."""
import time
from unittest.mock import MagicMock, patch

import pytest

from models.database import SqliteBackend, with_retry


class TestSqliteBackend:
    def test_init_and_health(self):
        backend = SqliteBackend(":memory:")
        assert backend.health()

    def test_table_creation(self):
        backend = SqliteBackend(":memory:")
        conn = backend.get_conn()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        assert backend.table_exists(cursor, "test")

    def test_table_not_exists(self):
        backend = SqliteBackend(":memory:")
        conn = backend.get_conn()
        cursor = conn.cursor()
        assert not backend.table_exists(cursor, "nonexistent")

    def test_index_creation(self):
        backend = SqliteBackend(":memory:")
        conn = backend.get_conn()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        cursor.execute("CREATE INDEX idx_test_id ON test (id)")
        assert backend.index_exists(cursor, "idx_test_id")

    def test_init_confusion_events_table(self):
        backend = SqliteBackend(":memory:")
        backend.init_confusion_events_table()
        conn = backend.get_conn()
        cursor = conn.cursor()
        assert backend.table_exists(cursor, "confusion_events")

    def test_init_lectures_table(self):
        backend = SqliteBackend(":memory:")
        backend.init_lectures_table()
        conn = backend.get_conn()
        cursor = conn.cursor()
        assert backend.table_exists(cursor, "lectures")

    def test_init_current_chunk_table(self):
        backend = SqliteBackend(":memory:")
        backend.init_current_chunk_table()
        conn = backend.get_conn()
        cursor = conn.cursor()
        assert backend.table_exists(cursor, "current_chunk")

    def test_init_all_tables(self):
        from models.database import init_all_tables
        with patch("models.database.get_backend") as mock_get:
            mock_backend = SqliteBackend(":memory:")
            mock_get.return_value = mock_backend
            init_all_tables()
            conn = mock_backend.get_conn()
            cursor = conn.cursor()
            for t in ["confusion_events", "lectures", "current_chunk"]:
                assert mock_backend.table_exists(cursor, t)

    def test_close(self):
        backend = SqliteBackend(":memory:")
        assert backend.health()
        backend.close()

    def test_idempotent_init(self):
        backend = SqliteBackend(":memory:")
        backend.init_confusion_events_table()
        backend.init_confusion_events_table()
        assert backend.health()

    def test_get_backend_detects_sqlite(self):
        with patch.dict("os.environ", {"LEGILIMENS_DB_BACKEND": "sqlite"}, clear=False):
            from models.database import _detect_backend
            backend = _detect_backend()
            assert backend.name == "sqlite"

    def test_get_backend_fallback_on_missing_odbc(self):
        with patch.dict("os.environ", {}, clear=False):
            with patch("models.database.ActianBackend") as MockActian:
                MockActian.return_value.health.return_value = False
                from models.database import _detect_backend
                backend = _detect_backend()
                assert backend.name == "sqlite"


class TestWithRetry:
    def test_succeeds_on_first_try(self):
        call_count = 0

        @with_retry(max_retries=3, backoff_base=0.01)
        def success():
            nonlocal call_count
            call_count += 1
            return "ok"

        result = success()
        assert result == "ok"
        assert call_count == 1

    def test_retries_on_failure_then_succeeds(self):
        call_count = 0

        @with_retry(max_retries=3, backoff_base=0.01)
        def flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("transient")
            return "recovered"

        result = flaky()
        assert result == "recovered"
        assert call_count == 3

    def test_raises_after_max_retries(self):
        call_count = 0

        @with_retry(max_retries=3, backoff_base=0.01)
        def always_fails():
            nonlocal call_count
            call_count += 1
            raise RuntimeError("permanent")

        with pytest.raises(RuntimeError, match="permanent"):
            always_fails()

        assert call_count == 3

    def test_respects_retryable_exceptions(self):
        call_count = 0

        @with_retry(max_retries=3, backoff_base=0.01, retryable_exceptions=(ValueError,))
        def wrong_error():
            nonlocal call_count
            call_count += 1
            raise TypeError("not retryable")

        with pytest.raises(TypeError):
            wrong_error()

        assert call_count == 1
