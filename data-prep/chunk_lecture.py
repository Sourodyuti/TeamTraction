"""Chunk + embed a lecture transcript → VectorAI DB (Phase 1).

Usage:
    python data-prep/chunk_lecture.py --transcript sample_lecture.txt --lecture-id 1
    python data-prep/chunk_lecture.py --transcript sample_lecture.txt --lecture-id 1 --dry-run

Takes a raw lecture transcript, splits it into ~15s chunks, tags each with
a topic_node (keyword heuristic), embeds with bge-small, and upserts
into the VectorAI DB `lecture_chunks` collection.

Run from the project root with PYTHONPATH=backend so service imports resolve:
    PYTHONPATH=backend python data-prep/chunk_lecture.py ...
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


# ─── Timestamp-aware chunking ────────────────────────────────────

_TS_RE = re.compile(r"^\[(\d{1,2}):(\d{2})\]\s*")


def _parse_timestamp(line: str) -> tuple[float | None, str]:
    """Extract a [MM:SS] timestamp from a line, return (seconds, clean_text)."""
    m = _TS_RE.match(line)
    if m:
        seconds = int(m.group(1)) * 60 + int(m.group(2))
        return float(seconds), line[m.end():]
    return None, line


def chunk_transcript(text: str, target_chunk_seconds: int = 15) -> list[dict]:
    """Split a transcript into ~15s chunks, using [MM:SS] timestamps when present.

    If timestamps are found, chunks are grouped by time windows.
    If no timestamps, falls back to grouping every 3 lines (~15s at speaking pace).
    """
    raw_lines = [l.strip() for l in text.splitlines() if l.strip()]
    # Skip comment/header lines (start with #)
    lines = [l for l in raw_lines if not l.startswith("#")]

    if not lines:
        return []

    # Parse timestamps
    parsed = []
    for line in lines:
        ts, clean = _parse_timestamp(line)
        parsed.append({"ts": ts, "text": clean})

    has_timestamps = any(p["ts"] is not None for p in parsed)

    chunks: list[dict] = []

    if has_timestamps:
        # Group by time windows
        current_texts: list[str] = []
        window_start = 0.0
        current_ts = 0.0

        for p in parsed:
            if p["ts"] is not None:
                current_ts = p["ts"]

            # If we've accumulated enough time, close the chunk
            if (current_ts - window_start >= target_chunk_seconds
                    and current_texts and p["ts"] is not None):
                chunk_text = " ".join(current_texts)
                chunks.append({
                    "text": chunk_text,
                    "topic_node": guess_topic(chunk_text),
                    "ts": window_start,
                })
                current_texts = []
                window_start = current_ts

            current_texts.append(p["text"])

        # Final chunk
        if current_texts:
            chunk_text = " ".join(current_texts)
            chunks.append({
                "text": chunk_text,
                "topic_node": guess_topic(chunk_text),
                "ts": window_start,
            })
    else:
        # Fallback: group every 3 lines
        ts = 0.0
        for i in range(0, len(parsed), 3):
            batch = parsed[i : i + 3]
            chunk_text = " ".join(p["text"] for p in batch)
            chunks.append({
                "text": chunk_text,
                "topic_node": guess_topic(chunk_text),
                "ts": ts,
            })
            ts += target_chunk_seconds

    return chunks


def guess_topic(text: str) -> str:
    """Heuristic topic detection from keywords."""
    text_lower = text.lower()
    topics = {
        "chain_rule": ["chain rule", "derivative", "partial derivative"],
        "backprop": ["backprop", "backward pass", "gradient"],
        "loss": ["loss", "cost function", "error", "mean squared"],
        "activation": ["activation", "relu", "sigmoid"],
        "vanishing_gradient": ["vanishing", "exploding", "gradient.*vanish"],
        "forward_pass": ["forward pass", "prediction", "forward"],
        "weight_update": ["weight update", "learning rate", "step"],
    }
    for topic, keywords in topics.items():
        if any(k in text_lower for k in keywords):
            return topic
    return "general"


def main() -> int:
    parser = argparse.ArgumentParser(description="Chunk + embed a lecture transcript.")
    parser.add_argument("--transcript", required=True, help="Path to transcript .txt")
    parser.add_argument("--lecture-id", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true",
                        help="Print chunks without embedding or upserting to DB")
    args = parser.parse_args()

    transcript_path = Path(args.transcript)
    if not transcript_path.exists():
        print(f"Error: {transcript_path} not found", file=sys.stderr)
        return 1

    text = transcript_path.read_text(encoding="utf-8")
    chunks = chunk_transcript(text)

    print(f"Chunked into {len(chunks)} segments:")
    for i, c in enumerate(chunks):
        print(f"  [{i}] {c['topic_node']} @ {c['ts']}s: {c['text'][:80]}...")

    if args.dry_run:
        print("\n🏃 Dry run — skipping embed + upsert.")
        return 0

    # Add backend/ to path so services imports resolve
    backend_dir = str(Path(__file__).resolve().parent.parent / "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from services.embedder import Embedder
    from services.vectorai_client import VectorAIClient

    print("\n📐 Embedding chunks with bge-small-en...")
    embedder = Embedder()

    points = []
    for i, c in enumerate(chunks):
        vec, ms = embedder.encode_with_latency(c["text"])
        point_id = f"lecture_{args.lecture_id}_chunk_{i}"
        points.append({
            "id": point_id,
            "vector": vec,
            "payload": {
                "text": c["text"],
                "topic_node": c["topic_node"],
                "ts": c["ts"],
                "source": "lecture",
                "lecture_id": args.lecture_id,
                "chunk_index": i,
                "difficulty": 5,  # mid-range default
            },
        })
        print(f"  [{i}] embedded in {ms:.1f}ms")

    print(f"\n📤 Upserting {len(points)} points to VectorAI DB...")
    vdb = VectorAIClient()
    vdb.connect()
    try:
        vdb.create_lecture_chunks_collection()
        vdb.upsert_chunks(points)
        print(f"✅ Upserted {len(points)} lecture chunks.")
    finally:
        vdb.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
