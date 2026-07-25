"""Load a textbook chapter → VectorAI DB (Phase 1).

Usage:
    python data-prep/load_textbook.py --textbook backprop_notes.txt --source "3B1B"

Chunks a textbook chapter into paragraph-sized segments, embeds with bge-small,
and upserts into the `lecture_chunks` collection as the "knowledge vault" — the
past explanations that Accio Analogy retrieves from.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def chunk_textbook(text: str, max_words: int = 80) -> list[dict]:
    """Split a textbook chapter into paragraph-sized chunks.

    TODO Phase 1: refine — split on headings, detect subtopics, tag difficulty.
    """
    paragraphs = [p.strip() for p in re_split(text) if p.strip()]
    chunks = []
    for para in paragraphs:
        words = para.split()
        for i in range(0, len(words), max_words):
            chunk_text = " ".join(words[i : i + max_words])
            chunks.append({
                "text": chunk_text,
                "topic_node": guess_topic(chunk_text),
                "subtopic": "",
                "difficulty": 3,
                "source": "textbook",
            })
    return chunks


def re_split(text: str) -> list[str]:
    """Split on blank lines (paragraphs)."""
    import re
    return re.split(r"\n\s*\n", text)


def guess_topic(text: str) -> str:
    """Reuse the chunk_lecture heuristic."""
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
    parser = argparse.ArgumentParser(description="Load a textbook chapter to VectorAI DB.")
    parser.add_argument("--textbook", required=True, help="Path to textbook .txt")
    parser.add_argument("--source", default="textbook", help="Source label")
    args = parser.parse_args()

    textbook_path = Path(args.textbook)
    if not textbook_path.exists():
        print(f"Error: {textbook_path} not found", file=sys.stderr)
        return 1

    text = textbook_path.read_text(encoding="utf-8")
    chunks = chunk_textbook(text)

    print(f"Chunked textbook into {len(chunks)} segments:")
    for i, c in enumerate(chunks):
        print(f"  [{i}] {c['topic_node']}: {c['text'][:80]}...")

    # TODO Phase 1: embed + upsert to VectorAI DB
    print("\nTODO Phase 1: embed + upsert to VectorAI DB")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
