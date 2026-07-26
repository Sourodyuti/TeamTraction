from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Optional

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware:
    def __init__(
        self,
        app: FastAPI,
        requests_per_minute: int = 60,
        burst: int = 10,
    ) -> None:
        self.app = app
        self.requests_per_minute = requests_per_minute
        self.burst = burst
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        client_ip = request.client.host if request.client else "unknown"
        path = scope.get("path", "")

        if path in ("/health", "/metrics"):
            await self.app(scope, receive, send)
            return

        now = time.monotonic()
        key = f"{client_ip}:{path}"

        async with self._lock:
            window = self._windows[key]
            window[:] = [t for t in window if now - t < 60.0]
            window.append(now)

            if len(window) > self.requests_per_minute:
                logger.warning("Rate limit exceeded: %s (%d req/min)", key, len(window))
                response = JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Try again in a moment."},
                )
                return await response(scope, receive, send)

        await self.app(scope, receive, send)
