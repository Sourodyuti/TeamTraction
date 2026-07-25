"""Tests for the ASR router — chunk ingestion, current_chunk tracking."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from routers.asr import (
    ChunkIngest,
    _store_current_chunk,
    ingest_chunk,
    ingest_batch,
)


class TestChunkIngestValidation:
    def test_valid_chunk(self):
        chunk = ChunkIngest(
            text="The chain rule multiplies gradients layer by layer.",
            topic_node="chain_rule",
            lecture_id=1,
            ts=42.0,
        )
        assert chunk.topic_node == "chain_rule"
        assert chunk.difficulty == 3  # default
        assert chunk.source == "lecture"  # default

    def test_empty_text_raises(self):
        with pytest.raises(Exception):
            ChunkIngest(text="", lecture_id=1)

    def test_text_too_long_raises(self):
        with pytest.raises(Exception):
            ChunkIngest(text="x" * 5001, lecture_id=1)


class TestStoreCurrentChunk:
    @pytest.mark.asyncio
    async def test_store_calls_db(self):
        chunk = ChunkIngest(
            text="test text",
            topic_node="chain_rule",
            lecture_id=1,
            ts=0.0,
        )
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        with patch("routers.asr.get_vector_connection") as mock_get_conn:
            # get_vector_connection is a context manager that yields the connection directly
            mock_get_conn.return_value.__enter__ = MagicMock(return_value=mock_conn)
            mock_get_conn.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.cursor.return_value = mock_cursor

            _store_current_chunk(chunk, "1_123")

            # Should have called cursor.execute at least once
            assert mock_cursor.execute.called


class TestIngestChunk:
    @pytest.mark.asyncio
    async def test_returns_chunk_id(self):
        chunk = ChunkIngest(
            text="test text for ingestion",
            topic_node="backprop",
            lecture_id=1,
            ts=0.0,
        )
        background_tasks = AsyncMock()
        background_tasks.add_task = MagicMock()

        with patch("routers.asr._store_current_chunk"):
            with patch("routers.asr._embed_and_upsert"):
                with patch("routers.asr._broadcast_chunk_update"):
                    result = await ingest_chunk(chunk, background_tasks)

        assert result.chunk_id.startswith("1_")
        assert result.status == "stored"
        assert result.topic_node == "backprop"
        # Background tasks should have been scheduled
        assert background_tasks.add_task.call_count == 2  # embed + broadcast

    @pytest.mark.asyncio
    async def test_db_failure_returns_503(self):
        chunk = ChunkIngest(text="test", topic_node="t", lecture_id=1)

        with patch("routers.asr._store_current_chunk", side_effect=Exception("DB down")):
            with pytest.raises(Exception) as exc_info:
                await ingest_chunk(chunk, AsyncMock())

            assert "DB down" in str(exc_info.value) or "503" in str(exc_info.value)


class TestIngestBatch:
    @pytest.mark.asyncio
    async def test_batch_stores_all(self):
        chunks = [
            ChunkIngest(text=f"text {i}", topic_node=f"topic_{i}", lecture_id=1, ts=float(i))
            for i in range(5)
        ]

        with patch("routers.asr._store_current_chunk"):
            with patch("routers.asr._embed_and_upsert"):
                result = await ingest_batch(chunks, AsyncMock())

        assert result["stored"] == 5
        assert result["total"] == 5
        assert result["status"] == "complete"

    @pytest.mark.asyncio
    async def test_batch_too_large_raises(self):
        chunks = [
            ChunkIngest(text=f"x", topic_node="t", lecture_id=1)
            for _ in range(501)
        ]

        with pytest.raises(Exception):
            await ingest_batch(chunks, AsyncMock())

    @pytest.mark.asyncio
    async def test_empty_batch_raises(self):
        with pytest.raises(Exception):
            await ingest_batch([], AsyncMock())
