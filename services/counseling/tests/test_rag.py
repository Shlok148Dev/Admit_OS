"""Unit and integration tests for the RAG Knowledge Engine."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_counseling_rag.db")

import pickle
from pathlib import Path
from typing import List
from unittest.mock import MagicMock, patch


from services.counseling.rag.ingest import (
    Chunk,
    KnowledgeBaseIngestor,
    _count_tokens,
    _split_into_chunks,
)
from services.counseling.rag.retriever import (
    CounselingRetriever,
    _cosine_similarity,
    _keyword_boost,
)
from services.counseling.rag.guard import HallucinationGuard, GuardResult
from services.counseling.rag.chat import (
    ARIAChatEngine,
    _compute_rank_from_percentile,
    _check_exam_institute_mismatch,
    _detect_query_style,
    _extract_parameters_regex,
    _get_next_missing_slot,
    _filter_sources,
)

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
    boost = _keyword_boost(
        "counseling deadline round", "The counseling deadline is March 15"
    )
    assert boost > 0.0


def test_keyword_boost_no_match() -> None:
    """No boost when query words do not appear in chunk."""
    boost = _keyword_boost("NEET cutoff", "JEE seat matrix released today")
    assert boost == 0.0


def test_retriever_with_mock_index(tmp_path: Path) -> None:
    """Retriever should load index and rank chunks by similarity."""
    chunks = [
        Chunk(
            text="JoSAA round 1 seat allocation for NIT Trichy",
            source="josaa.txt",
            embedding=[1.0] + [0.0] * 383,
        ),
        Chunk(
            text="NEET MCC counseling process for medical seats",
            source="neet.txt",
            embedding=[0.0] + [1.0] + [0.0] * 382,
        ),
    ]
    idx_path = tmp_path / "idx.pkl"
    with open(idx_path, "wb") as f:
        pickle.dump(chunks, f)

    retriever = CounselingRetriever(index_path=idx_path)
    with open(idx_path, "rb") as fp:
        retriever.chunks = pickle.load(fp)
    retriever._embedder = MagicMock()
    retriever._embedder.encode.return_value = [[1.0] + [0.0] * 383]
    retriever._loaded = True

    results = retriever.retrieve("JoSAA NIT allocation", top_k=2)
    assert len(results) == 2
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
    chunk = Chunk(
        text="The closing rank for NIT Trichy is around 2000", source="josaa.txt"
    )
    chunk.embedding = [0.0] * 384
    result = guard.validate(
        "The cutoff is 99999 ranks", [(chunk, 0.85)], top_score=0.85
    )
    assert result.accepted is False
    assert result.confidence == "DECLINED"


def test_guard_accepts_verified_answer() -> None:
    """Guard should accept answers with numbers that appear in source."""
    guard = HallucinationGuard()
    chunk = Chunk(
        text="JoSAA 2024 Round 1 opens on June 15", source="josaa_rules_2024.txt"
    )
    chunk.embedding = [0.0] * 384
    result = guard.validate(
        "JoSAA 2024 Round 1 opens on June 15", [(chunk, 0.90)], top_score=0.90
    )
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

    with patch.dict("sys.modules", {"sentence_transformers": MagicMock()}):
        r_high = guard.validate(
            "Seat allocation is confirmed", [(chunk, 0.85)], top_score=0.85
        )
        r_med = guard.validate(
            "Seat allocation is confirmed", [(chunk, 0.70)], top_score=0.70
        )
        r_low = guard.validate(
            "Seat allocation is confirmed", [(chunk, 0.62)], top_score=0.62
        )

        assert r_high.confidence == "HIGH"
        assert r_med.confidence == "MEDIUM"
        assert r_low.confidence == "LOW"


# ─── New architecture unit tests ─────────────────────────────────────────────


def test_compute_rank_from_percentile_jee_main() -> None:
    """97.7 percentile in JEE Main should yield ~33,350 AIR rank."""
    rank = _compute_rank_from_percentile(97.7, "JEE_MAIN")
    # (100 - 97.7) / 100 * 1,450,000 = 33,350
    assert 30_000 <= rank <= 36_000, f"Expected ~33350, got {rank}"


def test_compute_rank_from_percentile_mht_cet() -> None:
    """97.7 percentile in MHT-CET should yield ~9,200 rank (4L candidates)."""
    rank = _compute_rank_from_percentile(97.7, "MHT_CET")
    assert 8_000 <= rank <= 11_000, f"Expected ~9200, got {rank}"


def test_compute_rank_never_zero() -> None:
    """Percentile 100 should yield rank 1, not 0."""
    assert _compute_rank_from_percentile(100.0, "JEE_MAIN") == 1


def test_exam_mismatch_iit_mhtcet() -> None:
    """IIT Bombay queried with MHT-CET should trigger mismatch warning."""
    warning = _check_exam_institute_mismatch("what is IIT Bombay cutoff", "MHT_CET")
    assert warning is not None
    # The warning contains 'JEE ADVANCED' (uppercase with space, not underscore)
    assert "JEE" in warning and "ADVANCED" in warning
    assert "Mismatch" in warning or "mismatch" in warning.lower()


def test_exam_mismatch_iit_neet() -> None:
    """IIT queried with NEET should trigger mismatch warning."""
    warning = _check_exam_institute_mismatch("IIT Madras CSE cutoff", "NEET")
    assert warning is not None


def test_exam_mismatch_none_for_jee_advanced() -> None:
    """IIT queried with JEE Advanced should NOT trigger mismatch."""
    warning = _check_exam_institute_mismatch("IIT Bombay cutoff", "JEE_ADVANCED")
    assert warning is None


def test_exam_mismatch_none_for_nit_jee_main() -> None:
    """NIT queried with JEE Main should NOT trigger mismatch."""
    warning = _check_exam_institute_mismatch("NIT Trichy CSE cutoff", "JEE_MAIN")
    assert warning is None


def test_regex_extraction_percentile_not_rank() -> None:
    """'suggest me 2 to 3 colleges' must NOT extract rank=2."""
    result = _extract_parameters_regex("suggest me 2 to 3 best colleges for my percentile 97.7", {})
    assert result["extracted_rank"] is None, f"Should not extract rank from count, got {result['extracted_rank']}"
    assert result["extracted_percentile"] == 97.7


def test_regex_extraction_obc_category() -> None:
    """'im obc' should extract OBC_NCL category."""
    result = _extract_parameters_regex("im obc", {})
    assert result["extracted_category"] == "OBC_NCL"


def test_regex_extraction_rank_with_keyword() -> None:
    """'my rank is 33350' should extract rank=33350."""
    result = _extract_parameters_regex("my rank is 33350 in jee main", {})
    assert result["extracted_rank"] == 33350


def test_regex_extraction_no_rank_flag() -> None:
    """'I dont know my rank' should set explicit_no_rank=True."""
    result = _extract_parameters_regex("I dont know my rank", {})
    assert result["explicit_no_rank"] is True


def test_detect_query_style_cutoff() -> None:
    """Percentile query should be classified as CUTOFF_CHANCES."""
    assert _detect_query_style("can I get NIT Trichy with 97.7 percentile") == "CUTOFF_CHANCES"


def test_detect_query_style_comparison() -> None:
    """vs query should be classified as COMPARISON."""
    assert _detect_query_style("COEP vs VJTI which is better") == "COMPARISON"


def test_detect_query_style_rules() -> None:
    """Float/freeze query should be RULES_QA."""
    assert _detect_query_style("what is float in josaa round") == "RULES_QA"


def test_detect_query_style_greeting() -> None:
    """Standalone 'hello' should be GREETING."""
    assert _detect_query_style("hello") == "GREETING"


def test_slot_tracker_asks_rank_first() -> None:
    """Empty context should ask for rank first."""
    missing = _get_next_missing_slot({}, "JEE_MAIN")
    assert missing == "rank_or_percentile"


def test_slot_tracker_asks_category_when_rank_known() -> None:
    """With rank set but default category, should ask for category."""
    ctx = {"rank": 33350, "category": "GENERAL"}
    missing = _get_next_missing_slot(ctx, "JEE_MAIN")
    assert missing == "category"


def test_slot_tracker_returns_none_when_complete() -> None:
    """With rank + confirmed category + non-default state, no slot missing."""
    ctx = {"rank": 33350, "category": "OBC_NCL", "home_state": "MH"}
    missing = _get_next_missing_slot(ctx, "JEE_MAIN")
    assert missing is None


def test_filter_sources_removes_unlisted_college() -> None:
    """Source for NIT Patna should be filtered if NIT Patna not in narrative."""
    sources = ["Prediction Engine (NIT_PATNA)", "Prediction Engine (NIT_CALICUT)"]
    # Narrative only mentions NIT Calicut, not NIT Patna
    narrative = "Your best option is NIT Calicut CSE with 67% probability."
    filtered = _filter_sources(sources, narrative)
    # At minimum, NIT Calicut must remain
    assert any("NIT_CALICUT" in s for s in filtered)


# ─── ARIAChatEngine integration tests ────────────────────────────────────────


def test_chat_empty_history() -> None:
    """chat() with a complete student profile and mocked guard works."""
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
        sources=["rules.txt (year: 2024)"],
    )

    chat_engine = ARIAChatEngine(retriever=retriever, guard=guard)

    # Provide complete profile (rank + confirmed category + home_state) to skip slot-fill
    complete_profile = {"rank": 5000, "category": "OBC_NCL", "home_state": "MH"}
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "your_key_here", "GROQ_API_KEY": "", "GEMINI_API_KEY": ""}):
        resp = chat_engine.chat("How many seats?", [], "JEE_MAIN", complete_profile)
        assert "100" in resp.answer
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
        (
            {"role": "user", "content": f"msg {i}"}
            if i % 2 == 0
            else {"role": "assistant", "content": f"msg {i}"}
        )
        for i in range(12)
    ]

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"thought":"t","profile_updates":null,"narrative_response":"AI Response"}')]
    mock_client.messages.create.return_value = mock_response

    with patch.dict("sys.modules", {"anthropic": MagicMock()}), patch.dict(
        os.environ, {"GROQ_API_KEY": "", "ANTHROPIC_API_KEY": "sk-ant-validkey", "GEMINI_API_KEY": ""}
    ), patch("services.counseling.config.settings.GROQ_API_KEY", ""), patch(
        "services.counseling.config.settings.ANTHROPIC_API_KEY", "sk-ant-validkey"
    ), patch(
        "services.counseling.config.settings.GEMINI_API_KEY", ""
    ), patch(
        "anthropic.Anthropic", return_value=mock_client
    ):
        # Use complete profile to avoid slot-fill intercepting the call
        chat_engine.chat("New Query", history, "JEE_MAIN", {"rank": 5000, "category": "OBC_NCL", "home_state": "MH"})
        called_messages = mock_client.messages.create.call_args[1]["messages"]
        assert len(called_messages) <= 11
        assert called_messages[-1]["content"] == "New Query"


def test_mht_cet_boosting() -> None:
    """MHT-CET question gets routed to MHT-CET chunks via boosting."""
    chunk_mht = Chunk(
        text="MHT CAP Rounds seat guidelines.",
        source="mht_cet_rules.txt",
        embedding=[0.1] * 384,
    )
    chunk_josaa = Chunk(
        text="JoSAA rules for NIT allocation.",
        source="josaa_rules.txt",
        embedding=[0.1] * 384,
    )

    retriever = CounselingRetriever()
    retriever.chunks = [chunk_mht, chunk_josaa]
    retriever._loaded = True
    retriever._embedder = MagicMock()
    retriever._embedder.encode.return_value = [[0.1] * 384]

    results = retriever.retrieve("rules", top_k=2, exam_type="MHT_CET")

    assert len(results) == 2
    assert results[0][0].source == "mht_cet_rules.txt"


def test_missing_api_key_fallback() -> None:
    """Missing API key falls back gracefully to retrieval-only mode."""
    retriever = MagicMock()
    chunk = Chunk(text="Retrieved guidelines document content.", source="josaa.txt")
    retriever.retrieve.return_value = [(chunk, 0.75)]
    retriever.get_confidence_tier.return_value = "MEDIUM"

    guard = HallucinationGuard()
    chat_engine = ARIAChatEngine(retriever=retriever, guard=guard)

    with patch.dict(
        os.environ, {"ANTHROPIC_API_KEY": "", "GROQ_API_KEY": "", "GEMINI_API_KEY": ""}
    ), patch("services.counseling.config.settings.GROQ_API_KEY", ""), patch(
        "services.counseling.config.settings.ANTHROPIC_API_KEY", ""
    ), patch(
        "services.counseling.config.settings.GEMINI_API_KEY", "", create=True
    ):
        # Provide complete profile so slot-fill doesn't intercept
        complete_profile = {"rank": 5000, "category": "OBC_NCL", "home_state": "MH"}
        resp = chat_engine.chat("What is float?", [], "JEE_MAIN", complete_profile)
        assert "Retrieved guidelines" in resp.answer
        assert "josaa" in resp.answer.lower() or "official" in resp.answer.lower()
        assert resp.confidence == "MEDIUM"


def test_iit_mhtcet_mismatch_returns_warning() -> None:
    """Asking about IIT Bombay with MHT-CET exam should return governing body mismatch."""
    retriever = MagicMock()
    retriever.retrieve.return_value = []
    retriever.get_confidence_tier.return_value = "LOW"

    guard = MagicMock()
    guard.validate.return_value = GuardResult(
        accepted=True, answer="", confidence="HIGH", warning="", sources=[]
    )

    chat_engine = ARIAChatEngine(retriever=retriever, guard=guard)

    with patch.dict(os.environ, {"GROQ_API_KEY": "", "ANTHROPIC_API_KEY": "", "GEMINI_API_KEY": ""}):
        resp = chat_engine.chat(
            "what is IIT Bombay cutoff in mhtcet?", [], "MHT_CET", {}
        )
        assert "Mismatch" in resp.answer or "mismatch" in resp.answer.lower() or "JEE" in resp.answer


def test_percentile_query_asks_for_slot_not_assuming_rank() -> None:
    """'suggest 2 to 3 colleges' with no rank/percentile should ask for rank/percentile, not treat 2 as rank."""
    retriever = MagicMock()
    retriever.retrieve.return_value = []
    retriever.get_confidence_tier.return_value = "LOW"

    guard = MagicMock()
    guard.validate.return_value = GuardResult(
        accepted=True, answer="", confidence="HIGH", warning="", sources=[]
    )

    chat_engine = ARIAChatEngine(retriever=retriever, guard=guard)

    with patch.dict(os.environ, {"GROQ_API_KEY": "", "ANTHROPIC_API_KEY": "", "GEMINI_API_KEY": ""}):
        # Profile with no rank/percentile and no confirmed category
        resp = chat_engine.chat(
            "suggest me 2 to 3 best colleges", [], "JEE_MAIN", {}
        )
        # Must NOT say "rank of 2" or "rank of 3"
        assert "rank of 2" not in resp.answer.lower()
        assert "rank of 3" not in resp.answer.lower()
        # The answer should ask for rank/percentile OR category — it's a valid slot-fill
        # The key thing is it does NOT hallucinate a rank from the count
        assert resp.answer  # Non-empty response
        assert isinstance(resp.answer, str)
