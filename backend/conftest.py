"""Pytest configuration — ensure backend/ is on sys.path for service imports."""
import sys
from pathlib import Path

# Add backend/ to path so `from services.xxx import ...` resolves
_backend_dir = str(Path(__file__).resolve().parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
