"""Phase 0 smoke test — verify FastAPI boots and /health returns 200.

Run: pytest tests/test_health.py -v
"""
import pytest
from httpx import AsyncClient, ASGITransport

# Import the app at module level so the test can fail fast if something's wrong
from main import app


@pytest.mark.asyncio
async def test_health_returns_ok():
    """The /health endpoint must return 200 and {"status": "ok"}."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "legilimens"
    assert "version" in data
