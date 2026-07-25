"""Health endpoint test — verifies the app boots and /health responds."""
import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch, MagicMock

from main import app
from dependencies import set_embedder, set_vectorai, set_analytics


@pytest.mark.asyncio
async def test_health_returns_ok():
    """The /health endpoint must return 200 with status and version."""
    # Mock the dependencies to avoid needing actual DB connections
    mock_embedder = MagicMock()
    mock_embedder.dim = 384

    mock_vectorai = MagicMock()
    mock_vectorai.health.return_value = True

    mock_analytics = MagicMock()
    mock_analytics.health.return_value = True

    set_embedder(mock_embedder)
    set_vectorai(mock_vectorai)
    set_analytics(mock_analytics)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "legilimens"
        assert "version" in data
    finally:
        # Clean up
        set_embedder(None)
        set_vectorai(None)
        set_analytics(None)


@pytest.mark.asyncio
async def test_health_includes_service_status():
    """Health should report which backing services are available."""
    mock_embedder = MagicMock()
    mock_embedder.dim = 384

    mock_vectorai = MagicMock()
    mock_vectorai.health.return_value = True

    mock_analytics = MagicMock()
    mock_analytics.health.return_value = True

    set_embedder(mock_embedder)
    set_vectorai(mock_vectorai)
    set_analytics(mock_analytics)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")

        data = resp.json()
        assert "services" in data
        services = data["services"]
        # Each service key should be a boolean
        for key in ("embedder", "vectorai_db", "actian_vector"):
            assert key in services
            assert isinstance(services[key], bool)
    finally:
        set_embedder(None)
        set_vectorai(None)
        set_analytics(None)
