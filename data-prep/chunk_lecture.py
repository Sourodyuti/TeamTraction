"""Chunk + embed a lecture transcript → VectorAI DB (Phase 1).

Usage:
    python data-prep/chunk_lecture.py --transcript sample_lecture.txt --lecture-id 1

Takes a raw lecture transcript, splits it into ~15s chunks, tags each with
a topic_node (simple heuristic for now), embeds with bge-small, and upserts
into the VectorAI DB `lecture_chunks` collection.

Run from the backend directory (or with backend/ on PYTHONPATH) so the
services.embedder + services.vectorai_client imports resolve.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def chunk_transcript(text: str, target_chunk_seconds: int = 15) -> list[dict]:
    """Split a transcript into ~15s chunks.

    Assumes the transcript has timestamps like [00:15] or is roughly line-based.
    TODO Phase 1: Improve the chunking heuristic — group by sentence boundaries,
      detect topic shifts, tag topic_node from keywords.
    """
    # Naive split: by blank lines or every N sentences
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    chunks = []
    current = []
    ts = 0.0
    for line in lines:
        current.append(line)
        # TODO: detect actual timestamp markers [MM:SS] to compute ts accurately
        if len(current) >= 3:  # ~3 lines ≈ 15s at speaking pace
            chunks.append({
                "text": " ".join(current),
                "topic_node": guess_topic(" ".join(current)),
                "ts": ts,
            })
            ts += target_chunk_seconds
            current = []
    if current:
        chunks.append({
            "text": " ".join(current),
            "topic_node": guess_topic(" ".join(current)),
            "ts": ts,
        })
    return chunks


def guess_topic(text: str) -> str:
    """Heuristic topic detection from keywords. TODO Phase 1: refine."""
    text_lower = text.lower()
    topics = {
        "backprop": ["backprop", "backward pass", "gradient"],
        "chain_rule": ["chain rule", "derivative", "partial"],
        "loss": ["loss", "cost function", "error"],
        "activation": ["activation", "relu", "sigmoid"],
    }
    for topic, keywords in topics.items():
        if any(k in text_lower for k in keywords):
            return topic
    return "general"


def main() -> int:
    parser = argparse.ArgumentParser(description="Chunk + embed a lecture transcript.")
    parser.add_argument("--transcript", required=True, help="Path to transcript .txt")
    parser.add_argument("--lecture-id", type=int, default=1)
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

    # TODO Phase 1: embed each chunk + upsert to VectorAI DB
    # from services.embedder import Embedder
    # from services.vectorai_client import VectorAIClient
    # embedder = Embedder()
    # vdb = VectorAIClient()
    # points = [
    #     {"id": f"{args.lecture_id}_{i}", "vector": embedder.encode(c["text"])[0],
    #      "payload": {"topic_node": c["topic_node"], "ts": c["ts"], "source": "lecture"}}
    #     for i, c in enumerate(chunks)
    # ]
    # vdb.upsert_chunks(points)
    print("\nTODO Phase 1: embed + upsert to VectorAI DB")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
