"""Unit and integration tests for the RAG Knowledge Engine."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_counseling_rag.db")

import pickle
import tempfile
from pathlib import Path
from typing import List
from unittest.mock import MagicMock, patch

import pytest

from services.counseling.rag.ingest import (
    Chunk,
    KnowledgeBaseIngestor,
    _count_tokens,
    _split_into_chunks,
)
from services.counseling.rag.retriever import CounselingRetriever, _cosine_similarity, _keyword_boost
from services.counseling.rag.guard import HallucinationGuard, GuardResult
from services.counseling.rag.chat import ARIAChatEngine


# ─── ingest tests ─────────────────────────────────────────────────────────────

def test_count_tokens_basic() -> None:
    """Approximate token count is proportional to word count."""
    text = " ".join(["word"] * 130)
    assert _count_tokens(text) >= 90  # 130 / 1.3 ≈ 100


def test_split_chunks_respects_min() -> None:
    """Short paragraphs under MIN_CHUNK_TOKENS should be merged."""
    short_para = "Short text."
    text = "\n\n".join([short_para] * 5)
    chunks = _split_into_chunks(text, "test.txt")
    # Very short text — either merged or empty, never 5 separate chunks
    assert len(chunks) <= 3


def test_split_chunks_large_document() -> None:
    """Large document should produce multiple chunks."""
    big_para = " ".join(["counseling rules"] * 200)
    text = "\n\n".join([big_para] * 6)
    chunks = _split_into_chunks(text, "large.txt")
    assert len(chunks) >= 2


def test_ingestor_load_documents(tmp_path: Path) -> None:
    """KnowledgeBaseIngestor should load and chunk .txt files."""
    doc_dir = tmp_path / "docs"
    doc_dir.mkdir()
    content = " ".join(["JoSAA counseling round allocation document"] * 250)
    (doc_dir / "test_rules.txt").write_text(content)

    ingestor = KnowledgeBaseIngestor(seed_dir=doc_dir)
    chunks = ingestor.load_documents()
    assert len(chunks) >= 1
    assert chunks[0].source == "test_rules.txt"


def test_ingestor_save_and_reload(tmp_path: Path) -> None:
    """Ingestor should persist and reload chunks from pickle."""
    doc_dir = tmp_path / "docs"
    doc_dir.mkdir()
    content = " ".join(["NEET counseling MCC rules allocation seat"] * 250)
    (doc_dir / "neet.txt").write_text(content)

    idx_path = tmp_path / "idx.pkl"
    ingestor = KnowledgeBaseIngestor(seed_dir=doc_dir)
    ingestor.load_documents()
    # Use zero embeddings to skip model download in tests
    for c in ingestor.chunks:
        c.embedding = [0.0] * 384
    ingestor.save_index(idx_path)

    with open(idx_path, "rb") as f:
        reloaded: List[Chunk] = pickle.load(f)
    assert len(reloaded) == len(ingestor.chunks)


# ─── retriever tests ──────────────────────────────────────────────────────────

def test_cosine_similarity_identical() -> None:
    """Identical vectors should produce similarity = 1.0."""
    vec = [1.0, 0.5, 0.3]
    sim = _cosine_similarity(vec, vec)
    assert abs(sim - 1.0) < 1e-6


def test_cosine_similarity_zero_vector() -> None:
    """Zero vector should produce similarity = 0.0."""
    assert _cosine_similarity([0.0, 0.0], [1.0, 2.0]) == 0.0


def test_keyword_boost_triggered() -> None:
    """Keyword boost fires when query words appear in chunk text."""
    boost = _keyword_boost("counseling deadline round", "The counseling deadline is March 15")
    assert boost > 0.0


def test_keyword_boost_no_match() -> None:
    """No boost when query words do not appear in chunk."""
    boost = _keyword_boost("NEET cutoff", "JEE seat matrix released today")
    assert boost == 0.0


def test_retriever_with_mock_index(tmp_path: Path) -> None:
    """Retriever should load index and rank chunks by similarity."""
    chunks = [
        Chunk(text="JoSAA round 1 seat allocation for NIT Trichy", source="josaa.txt", embedding=[1.0] + [0.0] * 383),
        Chunk(text="NEET MCC counseling process for medical seats", source="neet.txt", embedding=[0.0] + [1.0] + [0.0] * 382),
    ]
    idx_path = tmp_path / "idx.pkl"
    with open(idx_path, "wb") as f:
        pickle.dump(chunks, f)

    retriever = CounselingRetriever(index_path=idx_path)
    # Manually load chunks from the pickle (bypassing _ensure_loaded)
    with open(idx_path, "rb") as fp:
        retriever.chunks = pickle.load(fp)
    # Patch embedder to return a vector matching first chunk
    retriever._embedder = MagicMock()
    retriever._embedder.encode.return_value = [[1.0] + [0.0] * 383]
    retriever._loaded = True

    results = retriever.retrieve("JoSAA NIT allocation", top_k=2)
    assert len(results) == 2
    # First result should be the JoSAA chunk
    assert "josaa" in results[0][0].source.lower()


# ─── guard tests ──────────────────────────────────────────────────────────────

def test_guard_declines_low_score() -> None:
    """Guard should decline when top_score < 0.60."""
    guard = HallucinationGuard()
    result = guard.validate("Some answer with 12345", [], top_score=0.50)
    assert result.accepted is False
    assert result.confidence == "DECLINED"


def test_guard_declines_unverified_numbers() -> None:
    """Guard should decline answers with numbers not in source chunks."""
    guard = HallucinationGuard()
    chunk = Chunk(text="The closing rank for NIT Trichy is around 2000", source="josaa.txt")
    chunk.embedding = [0.0] * 384
    # Answer contains 99999 which is NOT in source chunk
    result = guard.validate("The cutoff is 99999 ranks", [(chunk, 0.85)], top_score=0.85)
    assert result.accepted is False
    assert result.confidence == "DECLINED"


def test_guard_accepts_verified_answer() -> None:
    """Guard should accept answers with numbers that appear in source."""
    guard = HallucinationGuard()
    chunk = Chunk(text="JoSAA 2024 Round 1 opens on June 15", source="josaa_rules_2024.txt")
    chunk.embedding = [0.0] * 384
    result = guard.validate("JoSAA 2024 Round 1 opens on June 15", [(chunk, 0.90)], top_score=0.90)
    assert result.accepted is True
    assert result.confidence == "HIGH"
    assert "josaa_rules_2024.txt" in result.sources[0]


def test_guard_time_sensitive_warning() -> None:
    """Guard should add a warning for time-sensitive answers."""
    guard = HallucinationGuard()
    chunk = Chunk(text="The counselling deadline is June 2024", source="josaa.txt")
    chunk.embedding = [0.0] * 384
    result = guard.validate(
        "The counselling deadline is June 2024", [(chunk, 0.75)], top_score=0.75
    )
    assert result.accepted is True
    assert "⚠️" in result.warning


def test_guard_confidence_tiers() -> None:
    """Guard should assign correct confidence tier based on score."""
    guard = HallucinationGuard()
    chunk = Chunk(text="Seat allocation is confirmed", source="doc.txt")
    chunk.embedding = [0.0] * 384

    r_high = guard.validate("Seat allocation is confirmed", [(chunk, 0.85)], top_score=0.85)
    r_med = guard.validate("Seat allocation is confirmed", [(chunk, 0.70)], top_score=0.70)
    r_low = guard.validate("Seat allocation is confirmed", [(chunk, 0.62)], top_score=0.62)

    assert r_high.confidence == "HIGH"
    assert r_med.confidence == "MEDIUM"
    assert r_low.confidence == "LOW"


# ─── ARIAChatEngine & Boosting tests ──────────────────────────────────────────

def test_chat_empty_history() -> None:
    """chat() with empty history works."""
    retriever = MagicMock()
    chunk = Chunk(text="General seats are 100", source="rules.txt")
    retriever.retrieve.return_value = [(chunk, 0.90)]
    retriever.get_confidence_tier.return_value = "HIGH"

    guard = MagicMock()
    guard.validate.return_value = GuardResult(
        accepted=True,
        answer="General seats are 100",
        confidence="HIGH",
        warning="",
        sources=["rules.txt (year: 2024)"]
    )

    chat_engine = ARIAChatEngine(retriever=retriever, guard=guard)

    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "your_key_here"}):
        resp = chat_engine.chat("How many seats?", [], "JEE_MAIN", {"rank": 5000})
        assert "General seats are 100" in resp.answer
        assert resp.confidence == "HIGH"
        assert "rules.txt" in resp.sources[0]


def test_chat_sliding_window_history() -> None:
    """chat() with 5-turn history passes last 10 correctly."""
    retriever = MagicMock()
    chunk = Chunk(text="Info", source="rules.txt")
    retriever.retrieve.return_value = [(chunk, 0.90)]
    retriever.get_confidence_tier.return_value = "HIGH"

    guard = MagicMock()
    guard.validate.return_value = GuardResult(
        accepted=True, answer="AI Response", confidence="HIGH", warning="", sources=[]
    )

    chat_engine = ARIAChatEngine(retriever=retriever, guard=guard)

    history = [
        {"role": "user", "content": f"msg {i}"} if i % 2 == 0 else {"role": "assistant", "content": f"msg {i}"}
        for i in range(12)
    ]

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="AI Response")]
    mock_client.messages.create.return_value = mock_response

    with patch.dict("sys.modules", {"anthropic": MagicMock()}), \
         patch.dict(os.environ, {"ANTHROPIC_API_KEY": "valid_key"}), \
         patch("anthropic.Anthropic", return_value=mock_client):

        chat_engine.chat("New Query", history, "JEE_MAIN", {})

        called_messages = mock_client.messages.create.call_args[1]["messages"]
        assert len(called_messages) <= 11
        assert called_messages[-1]["content"] == "New Query"


def test_mht_cet_boosting() -> None:
    """MHT-CET question gets routed to MHT-CET chunks via boosting."""
    chunk_mht = Chunk(text="MHT CAP Rounds seat guidelines.", source="mht_cet_rules.txt", embedding=[0.1]*384)
    chunk_josaa = Chunk(text="JoSAA rules for NIT allocation.", source="josaa_rules.txt", embedding=[0.1]*384)

    retriever = CounselingRetriever()
    retriever.chunks = [chunk_mht, chunk_josaa]
    retriever._loaded = True

    retriever._embedder = MagicMock()
    retriever._embedder.encode.return_value = [[0.1]*384]

    results = retriever.retrieve("rules", top_k=2, exam_type="MHT_CET")

    assert len(results) == 2
    assert results[0][0].source == "mht_cet_rules.txt"


def test_missing_api_key_fallback() -> None:
    """Missing ANTHROPIC_API_KEY falls back gracefully to retrieval-only mode."""
    retriever = MagicMock()
    chunk = Chunk(text="Retrieved guidelines document content.", source="josaa.txt")
    retriever.retrieve.return_value = [(chunk, 0.75)]
    retriever.get_confidence_tier.return_value = "MEDIUM"

    guard = HallucinationGuard()
    chat_engine = ARIAChatEngine(retriever=retriever, guard=guard)

    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "your_key_here"}):
        resp = chat_engine.chat("What is float?", [], "JEE_MAIN", {})
        assert "Full AI responses require API key config." in resp.answer
        assert "Retrieved guidelines" in resp.answer
        assert resp.confidence == "MEDIUM"
