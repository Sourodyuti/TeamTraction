"""Legilimens — logging configuration.

Structured JSON-style logging for production, readable console format for dev.
All services and routers use `logging.getLogger(__name__)` and get consistent output.
"""
from __future__ import annotations

import logging
import sys


class ColorFormatter(logging.Formatter):
    """Colored console formatter for development."""

    COLORS = {
        logging.DEBUG: "\033[36m",     # cyan
        logging.INFO: "\033[32m",      # green
        logging.WARNING: "\033[33m",   # yellow
        logging.ERROR: "\033[31m",     # red
        logging.CRITICAL: "\033[1;31m", # bold red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, self.RESET)
        record.levelname = f"{color}{record.levelname:8s}{self.RESET}"
        return super().format(record)


def setup_logging(level: str = "INFO") -> None:
    """Configure root logger for the Legilimens backend.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR).
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove any existing handlers
    root.handlers.clear()

    # Console handler — colored for dev
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.DEBUG)
    formatter = ColorFormatter(
        fmt="%(asctime)s │ %(levelname)s │ %(name)s │ %(message)s",
        datefmt="%H:%M:%S",
    )
    console.setFormatter(formatter)
    root.addHandler(console)

    # Suppress noisy third-party loggers
    for noisy in ["uvicorn.access", "httpx", "httpcore", "asyncio"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)
