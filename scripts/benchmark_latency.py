#!/usr/bin/env python3
"""Legilimens — Latency benchmark tool.

Measures each pipeline stage's latency for the on-screen badge:
  ping→radar, embedding, retrieval, Gemini rewrite, ElevenLabs TTS.

Usage:
    python scripts/benchmark_latency.py              # Full pipeline benchmark
    python scripts/benchmark_latency.py --stage embed  # Single stage
    python scripts/benchmark_latency.py --n 50        # 50 iterations

Outputs JSON to stdout, suitable for piping to the dashboard.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Any

# Ensure backend/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))


def bench(fn, iterations: int = 20, warmup: int = 3) -> dict[str, Any]:
    """Benchmark a callable, return timing statistics."""
    # Warmup runs (not counted)
    for _ in range(warmup):
        fn()

    times_ms: list[float] = []
    errors = 0
    for _ in range(iterations):
        try:
            start = time.perf_counter()
            result = fn()
            elapsed = (time.perf_counter() - start) * 1000
            times_ms.append(elapsed)
        except Exception as e:
            errors += 1

    if not times_ms:
        return {"error": "all iterations failed", "errors": errors, "n": iterations}

    return {
        "n": len(times_ms),
        "errors": errors,
        "mean_ms": statistics.mean(times_ms),
        "median_ms": statistics.median(times_ms),
        "p95_ms": sorted(times_ms)[int(len(times_ms) * 0.95)] if len(times_ms) >= 20 else max(times_ms),
        "min_ms": min(times_ms),
        "max_ms": max(times_ms),
    }


def bench_embedding(text: str) -> dict[str, Any]:
    """Benchmark the bge-small embedder."""
    from services.embedder import Embedder

    embedder = Embedder()

    def _run():
        vec, _ = embedder.encode_with_latency(text)
        assert len(vec) == 384
        return vec

    result = bench(_run, iterations=50)
    result["stage"] = "embedding"
    return result


def bench_retrieval(text: str) -> dict[str, Any]:
    """Benchmark VectorAI DB similarity search."""
    from services.embedder import Embedder
    from services.vectorai_client import VectorAIClient

    embedder = Embedder()
    vdb = VectorAIClient()

    def _run():
        vector, _ = embedder.encode_with_latency(text)
        hits = vdb.search_similar(vector, limit=3)
        return hits

    result = bench(_run, iterations=20)
    result["stage"] = "retrieval"
    return result


def bench_gemini(concept: str, text: str) -> dict[str, Any]:
    """Benchmark Gemini analogy rewrite."""
    from services.gemini_client import GeminiClient
    from models.schemas import InterestAvatar

    client = GeminiClient()

    def _run():
        analogy, ms = client.rewrite_analogy(concept, text, InterestAvatar.CRICKETER)
        return analogy

    result = bench(_run, iterations=5)  # Keep low — costs money per call
    result["stage"] = "gemini"
    return result


def bench_elevenlabs(text: str) -> dict[str, Any]:
    """Benchmark ElevenLabs TTS."""
    from services.elevenlabs_client import ElevenLabsClient

    client = ElevenLabsClient()

    def _run():
        audio, ms = client.text_to_speech(text)
        return len(audio)

    result = bench(_run, iterations=5)
    result["stage"] = "elevenlabs"
    return result


def bench_websocket_ping() -> dict[str, Any]:
    """Benchmark the round-trip ping latency (client → server → broadcast)."""
    import asyncio

    async def _measure():
        import websockets
        uri = "ws://localhost:8000/ws/lecture/1"
        start = time.perf_counter()
        async with websockets.connect(uri) as ws:
            ping = json.dumps({
                "type": "ping",
                "student_id": "bench_test",
                "signal_type": "lost",
            })
            await ws.send(ping)
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        return (time.perf_counter() - start) * 1000

    try:
        times = [asyncio.run(_measure()) for _ in range(20)]
        return {
            "stage": "websocket_ping",
            "n": len(times),
            "mean_ms": statistics.mean(times),
            "median_ms": statistics.median(times),
            "min_ms": min(times),
            "max_ms": max(times),
        }
    except Exception as e:
        return {"stage": "websocket_ping", "error": str(e)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Legilimens latency benchmark")
    parser.add_argument("--stage", choices=["embed", "retrieve", "gemini", "elevenlabs", "ping", "all"],
                        default="all", help="Which stage to benchmark")
    parser.add_argument("-n", "--iterations", type=int, default=20, help="Iterations per stage")
    parser.add_argument("--text", default="The chain rule in backpropagation multiplies gradients layer by layer",
                        help="Test text for embedding/retrieval")
    parser.add_argument("--concept", default="chain_rule", help="Concept node for analogy")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    text = args.text
    results: list[dict] = []

    stages = {
        "embed": lambda: bench_embedding(text),
        "retrieve": lambda: bench_retrieval(text),
        "gemini": lambda: bench_gemini(args.concept, text),
        "elevenlabs": lambda: bench_elevenlabs(text),
        "ping": bench_websocket_ping,
    }

    to_run = stages if args.stage == "all" else {args.stage: stages[args.stage]}

    for name, fn in to_run.items():
        print(f"\n🔮 Benchmarking: {name}...")
        result = fn()
        results.append(result)
        print(f"   median: {result.get('median_ms', 0):.1f}ms  "
              f"p95: {result.get('p95_ms', 0):.1f}ms  "
              f"({result.get('n', 0)} runs, {result.get('errors', 0)} errors)")

    if args.json:
        print("\n" + json.dumps(results, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
