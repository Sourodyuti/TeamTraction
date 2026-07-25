"""Tests for the connection pool and retry logic in models/database.py."""
import pytest
import time
from unittest.mock import MagicMock, patch

from models.database import ConnectionPool, with_retry


class TestConnectionPool:
    def test_pool_initializes_with_min_connections(self):
        mock_conn = MagicMock()
        with patch("models.database.ConnectionPool._create_connection", return_value=mock_conn):
            pool = ConnectionPool(min_size=2, max_size=5)

        assert pool._size == 2

    def test_pool_returns_connection(self):
        mock_conn = MagicMock()
        with patch("models.database.ConnectionPool._create_connection", return_value=mock_conn):
            pool = ConnectionPool(min_size=1, max_size=5)
            wrapped = pool.get(timeout=1.0)

        assert wrapped is not None

    def test_pool_put_returns_connection(self):
        mock_conn = MagicMock()
        with patch("models.database.ConnectionPool._create_connection", return_value=mock_conn):
            pool = ConnectionPool(min_size=1, max_size=5)
            wrapped = pool.get(timeout=1.0)
            pool.put(wrapped)

        # Should still have 1 (not leaked)
        assert pool._size == 1

    def test_health_returns_true_on_success(self):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch("models.database.ConnectionPool._create_connection", return_value=mock_conn):
            pool = ConnectionPool(min_size=1, max_size=5)
            assert pool.health() is True

    def test_health_returns_false_on_failure(self):
        mock_conn = MagicMock()
        mock_conn.cursor.side_effect = Exception("Connection refused")

        with patch("models.database.ConnectionPool._create_connection", return_value=mock_conn):
            pool = ConnectionPool(min_size=1, max_size=5)
            assert pool.health() is False

    def test_close_all_clears_pool(self):
        mock_conn = MagicMock()
        with patch("models.database.ConnectionPool._create_connection", return_value=mock_conn):
            pool = ConnectionPool(min_size=2, max_size=5)
            assert pool._size == 2

        pool.close_all()
        assert pool._size == 0
        # Queue should be empty
        assert pool._pool.empty()


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

        assert call_count == 3  # Should have tried 3 times

    def test_respects_retryable_exceptions(self):
        """Only retry on specific exception types."""
        call_count = 0

        @with_retry(max_retries=3, backoff_base=0.01, retryable_exceptions=(ValueError,))
        def wrong_error():
            nonlocal call_count
            call_count += 1
            raise TypeError("not retryable")

        with pytest.raises(TypeError):
            wrong_error()

        assert call_count == 1  # Should not retry TypeError
