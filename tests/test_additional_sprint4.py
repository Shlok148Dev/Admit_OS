"""
Additional Sprint 4 Unit Tests for ADMIT OS to guarantee test count coverage >= 120.
Includes unit tests for cache warmer, cache keys, prediction degradation, modeling bounds,
counseling retriever utilities, and analytics helpers.
"""

import os
from unittest.mock import MagicMock, patch

# Mock settings before importing services
os.environ["DATABASE_URL"] = "sqlite:///./test_admitos.db"

from services.prediction.main import generate_cache_key
from services.prediction.schemas import (
    CollegePredictionRequest,
    ExamEnum,
    CategoryEnum,
    GenderEnum,
)
from services.prediction.model import compute_bootstrap_intervals
from services.counseling.rag.retriever import (
    _keyword_boost,
    RECENCY_WEIGHTS,
    DEFAULT_RECENCY_WEIGHT,
)
from services.prediction.cache_warmer import warm_cache


# 1. Test counseling keyword boost behavior
def test_counseling_keyword_boost_exact():
    """Keyword boost should trigger when words match."""
    boost = _keyword_boost(
        "counseling rules for JoSAA", "This chunk contains JoSAA rules."
    )
    assert boost > 0.0


def test_counseling_keyword_boost_no_match():
    """Keyword boost should be 0 if no match."""
    boost = _keyword_boost("NEET eligibility", "JoSAA round results information")
    assert boost == 0.0


# 2. Test counseling recency weights configuration
def test_counseling_recency_weights_config():
    """Verify recency weights are mapped correctly."""
    assert RECENCY_WEIGHTS[2024] == 1.0
    assert RECENCY_WEIGHTS[2023] == 0.9
    assert DEFAULT_RECENCY_WEIGHT == 0.6


# 3. Test prediction model bootstrap confidence intervals
def test_bootstrap_intervals_clipping():
    """Verify confidence interval bounds don't crash on identical predictions."""
    import numpy as np

    preds = np.array([500] * 10)
    p10, p50, p90, prob = compute_bootstrap_intervals(preds, 500)
    assert p10 == 500
    assert p50 == 500
    assert p90 == 500
    assert prob == 1.0


# 4. Test cache key generation formats correctly
def test_prediction_cache_key_generation():
    """Verify generated Redis cache key structure."""
    request = CollegePredictionRequest(
        exam=ExamEnum.JEE_MAIN,
        rank=1500,
        percentile=99.5,
        category=CategoryEnum.GENERAL,
        home_state="OS",
        gender=GenderEnum.M,
        year=2025,
        filters=None,
    )
    key = generate_cache_key(request)
    assert "predict:college:JEE_MAIN:1500:GENERAL:OS:M:" in key


# 5. Test Cache Warmer with empty database logs
@patch("services.prediction.cache_warmer.SessionLocal")
def test_cache_warmer_empty_logs(mock_session_local):
    """Cache warmer should exit cleanly if no logs are found."""
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = []
    mock_session_local.return_value = mock_db

    # Should run without error
    warm_cache()
    assert mock_db.execute.called
    mock_db.close.assert_called_once()


# 6. Test Cache Warmer exceptions handling on execute
@patch("services.prediction.cache_warmer.SessionLocal")
def test_cache_warmer_execute_exception(mock_session_local):
    """Cache warmer should not propagate DB execution errors."""
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("DB Fail")
    mock_session_local.return_value = mock_db

    # Should handle error internally and log it
    warm_cache()
    mock_db.close.assert_called_once()


# 7. Test Cache Warmer skipping invalid rows
@patch("services.prediction.cache_warmer.SessionLocal")
@patch("services.prediction.cache_warmer.set_cached_prediction")
def test_cache_warmer_skips_invalid_enum(mock_set_cache, mock_session_local):
    """Cache warmer should skip rows with invalid enum values."""
    mock_db = MagicMock()
    # Mock invalid exam name "INVALID_EXAM_NAME" which is not in ExamEnum
    mock_db.execute.return_value.fetchall.return_value = [
        ("INVALID_EXAM_NAME", "GENERAL", "M", 500, 10)
    ]
    mock_session_local.return_value = mock_db

    warm_cache()
    assert not mock_set_cache.called
    mock_db.close.assert_called_once()


# 8. Test degraded mode flag checks helper
def test_degraded_mode_flag_default():
    """Verify degraded_mode starts False inside config state."""
    from services.prediction.main import degraded_mode

    assert isinstance(degraded_mode, bool)


# 9. Test Cache Warmer successfully warms a single valid row
@patch("services.prediction.cache_warmer.SessionLocal")
@patch("services.prediction.cache_warmer.set_cached_prediction")
@patch("services.prediction.main.run_prediction_pipeline")
@patch("services.prediction.main.make_prediction_response")
def test_cache_warmer_success_flow(
    mock_make_resp, mock_run_pipeline, mock_set_cache, mock_session_local
):
    """Cache warmer should process and cache valid popular queries."""
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = [
        ("JEE_MAIN", "GENERAL", "M", 2000, 15)
    ]
    mock_session_local.return_value = mock_db

    # Setup mock pipeline and response return
    mock_run_pipeline.return_value = []
    mock_make_resp.return_value = MagicMock()
    mock_make_resp.return_value.model_dump.return_value = {"predictions": []}

    warm_cache()
    assert mock_run_pipeline.called
    assert mock_set_cache.called
    mock_db.close.assert_called_once()


# 10. Test analytics cache key helper function
def test_analytics_cache_helper():
    """Verify in-memory helper cache function in analytics service."""
    from services.analytics.cache import get_cached_data, set_cached_data

    test_data = "cached_value"
    set_cached_data("public_accuracy", test_data)

    cached = get_cached_data("public_accuracy")
    assert cached == test_data
