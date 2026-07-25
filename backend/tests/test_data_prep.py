"""Tests for the data-prep scripts (chunk_lecture + load_textbook)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Add data-prep/ and backend/ to path so imports resolve
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_PROJECT_ROOT / "data-prep"))
sys.path.insert(0, str(_PROJECT_ROOT / "backend"))


class TestChunkLecture:
    """Test the lecture transcript chunking logic."""

    def _import_module(self):
        """Import chunk_lecture module dynamically."""
        import importlib
        spec = importlib.util.spec_from_file_location(
            "chunk_lecture",
            str(_PROJECT_ROOT / "data-prep" / "chunk_lecture.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_chunk_with_timestamps(self):
        """Transcript with [MM:SS] markers should chunk by time windows."""
        mod = self._import_module()
        text = """
[00:00] Welcome to the lecture on backpropagation.
Let me explain how neural networks learn.

[00:15] The forward pass computes predictions layer by layer.
Each neuron multiplies inputs by weights and adds a bias.

[00:30] The loss function measures how wrong the prediction is.
We use mean squared error or cross-entropy.

[00:45] The chain rule is the heart of backprop.
It lets us break apart complicated functions into simpler pieces.
"""
        chunks = mod.chunk_transcript(text, target_chunk_seconds=15)
        assert len(chunks) >= 2
        # First chunk should start at ts=0
        assert chunks[0]["ts"] == 0.0
        # Each chunk should have text and topic_node
        for c in chunks:
            assert "text" in c
            assert "topic_node" in c
            assert len(c["text"]) > 10

    def test_chunk_without_timestamps(self):
        """Transcript without timestamps should fall back to line-based chunking."""
        mod = self._import_module()
        text = """
Neural networks learn by adjusting weights.
The forward pass produces a prediction.
The loss measures the error.
Backpropagation computes gradients.
The chain rule multiplies derivatives layer by layer.
Weight updates use gradient descent.
"""
        chunks = mod.chunk_transcript(text, target_chunk_seconds=15)
        assert len(chunks) >= 1
        for c in chunks:
            assert len(c["text"]) > 5

    def test_empty_transcript(self):
        """Empty transcript should produce no chunks."""
        mod = self._import_module()
        chunks = mod.chunk_transcript("")
        assert chunks == []

    def test_timestamp_parsing(self):
        """[MM:SS] timestamps should be parsed to seconds correctly."""
        mod = self._import_module()
        ts, text = mod._parse_timestamp("[01:30] Some text here")
        assert ts == 90.0
        assert text == "Some text here"

    def test_timestamp_parsing_no_match(self):
        """Lines without timestamps should return None."""
        mod = self._import_module()
        ts, text = mod._parse_timestamp("Just a normal line")
        assert ts is None
        assert text == "Just a normal line"

    def test_guess_topic_chain_rule(self):
        """guess_topic should detect chain_rule from keywords."""
        mod = self._import_module()
        assert mod.guess_topic("The chain rule is fundamental") == "chain_rule"

    def test_guess_topic_backprop(self):
        """guess_topic should detect backprop from keywords."""
        mod = self._import_module()
        assert mod.guess_topic("Backpropagation computes gradients") == "backprop"

    def test_guess_topic_loss(self):
        """guess_topic should detect loss from keywords."""
        mod = self._import_module()
        assert mod.guess_topic("The loss function measures error") == "loss"

    def test_guess_topic_general(self):
        """Unrecognized text should return 'general'."""
        mod = self._import_module()
        assert mod.guess_topic("The weather is nice today") == "general"

    def test_sample_lecture_chunks(self):
        """The actual sample_lecture.txt should produce reasonable chunks."""
        mod = self._import_module()
        sample_path = _PROJECT_ROOT / "data-prep" / "sample_lecture.txt"
        if not sample_path.exists():
            pytest.skip("sample_lecture.txt not found")
        text = sample_path.read_text(encoding="utf-8")
        chunks = mod.chunk_transcript(text)
        assert len(chunks) >= 3, f"Expected at least 3 chunks, got {len(chunks)}"


class TestLoadTextbook:
    """Test the textbook chunking logic."""

    def _import_module(self):
        """Import load_textbook module dynamically."""
        import importlib
        spec = importlib.util.spec_from_file_location(
            "load_textbook",
            str(_PROJECT_ROOT / "data-prep" / "load_textbook.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_chunk_textbook_paragraphs(self):
        """Textbook should be split on blank lines."""
        mod = self._import_module()
        text = """
Backpropagation is the algorithm that lets neural networks learn. It traces
blame backward through a chain of decisions. Each weight gets a blame score.

The chain rule from calculus makes this possible. If y depends on z and z
depends on x, the derivative of y with respect to x is the product of the
individual derivatives.

The loss function measures how wrong the prediction is. Mean squared error
and cross-entropy are the two most common choices.
"""
        chunks = mod.chunk_textbook(text)
        assert len(chunks) >= 3
        for c in chunks:
            assert "text" in c
            assert "topic_node" in c
            assert "difficulty" in c

    def test_skips_comment_lines(self):
        """Lines starting with # should be skipped."""
        mod = self._import_module()
        text = """# This is a header
# This is a comment

Actual content about backpropagation and gradients.
"""
        chunks = mod.chunk_textbook(text)
        for c in chunks:
            assert not c["text"].startswith("#")

    def test_difficulty_estimation(self):
        """Hard vocabulary should increase difficulty score."""
        mod = self._import_module()
        easy = mod.estimate_difficulty("The weather is nice today")
        hard = mod.estimate_difficulty(
            "The gradient vanishing problem in stochastic backpropagation"
        )
        assert hard > easy

    def test_backprop_notes_file(self):
        """The actual backprop_notes.txt should produce reasonable chunks."""
        mod = self._import_module()
        notes_path = _PROJECT_ROOT / "data-prep" / "backprop_notes.txt"
        if not notes_path.exists():
            pytest.skip("backprop_notes.txt not found")
        text = notes_path.read_text(encoding="utf-8")
        chunks = mod.chunk_textbook(text)
        assert len(chunks) >= 5, f"Expected at least 5 chunks, got {len(chunks)}"
