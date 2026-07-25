"""Load a textbook chapter → VectorAI DB (Phase 1).

Usage:
    python data-prep/load_textbook.py --textbook backprop_notes.txt --source "3B1B"
    python data-prep/load_textbook.py --textbook backprop_notes.txt --dry-run

Chunks a textbook chapter into paragraph-sized segments, embeds with bge-small,
and upserts into the `lecture_chunks` collection as the "knowledge vault" — the
past explanations that Accio Analogy retrieves from.

IDs are offset (starting at 10000) to avoid collisions with lecture chunk IDs.

Run from the project root with PYTHONPATH=backend:
    PYTHONPATH=backend python data-prep/load_textbook.py ...
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def chunk_textbook(text: str, max_words: int = 80) -> list[dict]:
    """Split a textbook chapter into paragraph-sized chunks.

    Splits on blank lines (paragraphs). Skips comment lines (starting with #).
    Chunks longer than max_words are split at word boundaries.
    """
    paragraphs = re.split(r"\n\s*\n", text)
    chunks = []

    for para in paragraphs:
        # Clean up: join lines, skip comment/header lines
        lines = [
            l.strip()
            for l in para.splitlines()
            if l.strip() and not l.strip().startswith("#")
        ]
        if not lines:
            continue

        clean_text = " ".join(lines)
        words = clean_text.split()

        for i in range(0, len(words), max_words):
            chunk_text = " ".join(words[i : i + max_words])
            if len(chunk_text.split()) < 5:
                continue  # Skip tiny fragments

            chunks.append({
                "text": chunk_text,
                "topic_node": guess_topic(chunk_text),
                "subtopic": "",
                "difficulty": estimate_difficulty(chunk_text),
                "source": "textbook",
            })

    return chunks


def guess_topic(text: str) -> str:
    """Heuristic topic detection from keywords."""
    text_lower = text.lower()
    topics = {
        "chain_rule": ["chain rule", "derivative", "partial derivative"],
        "backprop": ["backprop", "backward pass", "blame"],
        "loss": ["loss", "cost function", "error", "mean squared"],
        "activation": ["activation", "relu", "sigmoid"],
        "vanishing_gradient": ["vanishing", "exploding"],
        "forward_pass": ["forward pass", "prediction"],
        "weight_update": ["weight update", "learning rate", "gradient descent"],
        "sgd": ["stochastic", "mini-batch", "sgd"],
        "computational_graph": ["computational graph", "automatic differentiation"],
    }
    for topic, keywords in topics.items():
        if any(k in text_lower for k in keywords):
            return topic
    return "general"


def estimate_difficulty(text: str) -> int:
    """Rough difficulty estimate (1-10) based on vocabulary complexity."""
    hard_words = [
        "derivative", "gradient", "jacobian", "hessian", "eigenvalue",
        "vanishing", "exploding", "convergence", "stochastic",
        "backpropagation", "computational graph", "automatic differentiation",
    ]
    text_lower = text.lower()
    count = sum(1 for w in hard_words if w in text_lower)
    return min(3 + count * 2, 10)


def main() -> int:
    parser = argparse.ArgumentParser(description="Load a textbook chapter to VectorAI DB.")
    parser.add_argument("--textbook", required=True, help="Path to textbook .txt")
    parser.add_argument("--source", default="textbook", help="Source label")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print chunks without embedding or upserting to DB")
    args = parser.parse_args()

    textbook_path = Path(args.textbook)
    if not textbook_path.exists():
        print(f"Error: {textbook_path} not found", file=sys.stderr)
        return 1

    text = textbook_path.read_text(encoding="utf-8")
    chunks = chunk_textbook(text)

    print(f"Chunked textbook into {len(chunks)} segments:")
    for i, c in enumerate(chunks):
        print(f"  [{i}] {c['topic_node']} (diff={c['difficulty']}): {c['text'][:80]}...")

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

    # Offset IDs to 10000+ to avoid collision with lecture chunks
    ID_OFFSET = 10000
    points = []
    for i, c in enumerate(chunks):
        vec, ms = embedder.encode_with_latency(c["text"])
        point_id = f"textbook_{ID_OFFSET + i}"
        points.append({
            "id": point_id,
            "vector": vec,
            "payload": {
                "text": c["text"],
                "topic_node": c["topic_node"],
                "subtopic": c.get("subtopic", ""),
                "source": args.source,
                "difficulty": c["difficulty"],
                "chunk_index": i,
            },
        })
        print(f"  [{i}] embedded in {ms:.1f}ms")

    print(f"\n📤 Upserting {len(points)} points to VectorAI DB...")
    vdb = VectorAIClient()
    vdb.connect()
    try:
        vdb.create_lecture_chunks_collection()
        vdb.upsert_chunks(points)
        print(f"✅ Upserted {len(points)} textbook chunks (source={args.source}).")
    finally:
        vdb.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
