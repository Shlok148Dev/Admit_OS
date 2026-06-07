"""
Unit and integration tests for prediction-service.
"""

import os
os.environ["DATABASE_URL"] = "sqlite:///./test_prediction.db"

from typing import Generator
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from ..main import app
from ..model import (
    get_cutoff_rank, add_lags, encode_df, compute_bootstrap_intervals
)

# ----------------- Unit Tests for Utility Functions -----------------

def test_get_cutoff_rank() -> None:
    """Test synthetic rank generation utility."""
    rank = get_cutoff_rank("IIT_BOMBAY", "CS", "GENERAL", "OS", "M", 2024)
    assert isinstance(rank, int)
    assert rank > 0

def test_add_lags() -> None:
    """Test lag feature generation utility."""
    data = pd.DataFrame([
        {
            "college_code": "IIT_BOMBAY", "branch_code": "CS", "category": "GENERAL",
            "quota": "OS", "gender": "M", "year": 2020, "closing_rank": 100
        },
        {
            "college_code": "IIT_BOMBAY", "branch_code": "CS", "category": "GENERAL",
            "quota": "OS", "gender": "M", "year": 2021, "closing_rank": 110
        },
        {
            "college_code": "IIT_BOMBAY", "branch_code": "CS", "category": "GENERAL",
            "quota": "OS", "gender": "M", "year": 2022, "closing_rank": 120
        },
    ])
    res = add_lags(data)
    assert "lag_1" in res.columns
    assert "lag_2" in res.columns
    assert res.iloc[0]["lag_1"] == 110
    assert res.iloc[0]["lag_2"] == 100

def test_encode_df() -> None:
    """Test categorical encoding utility."""
    data = pd.DataFrame([{
        "college_code": "IIT_BOMBAY", "branch_code": "CS", "category": "GENERAL",
        "quota": "OS", "gender": "M"
    }])
    res = encode_df(data)
    assert res.iloc[0]["college_code_enc"] == 0
    assert res.iloc[0]["branch_code_enc"] == 0
    assert res.iloc[0]["category_enc"] == 0
    assert res.iloc[0]["quota_enc"] == 0
    assert res.iloc[0]["gender_enc"] == 0

def test_compute_bootstrap_intervals() -> None:
    """Test percentile extraction and admission probability calculations."""
    preds = np.array([100, 110, 120, 130, 140, 150, 160, 170, 180, 190])
    p10, p50, p90, prob = compute_bootstrap_intervals(preds, 130)
    assert p10 <= p50 <= p90
    assert p10 >= 1
    assert 0.0 <= prob <= 1.0
    assert prob == 0.7

# ----------------- Integration Tests for API -----------------

@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    """Test client fixture running the FastAPI application lifespan."""
    # Clean up any leftover database file before running tests
    if os.path.exists("./test_prediction.db"):
        try:
            os.remove("./test_prediction.db")
        except Exception:
            pass

    with TestClient(app) as c:
        yield c

    # Clean up the test database file
    if os.path.exists("./test_prediction.db"):
        try:
            os.remove("./test_prediction.db")
        except Exception:
            pass

def test_health_check(client: TestClient) -> None:
    """Test service health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data.get("service") == "prediction-service"

def test_predict_college_integration(client: TestClient) -> None:
    """Test predicting college options and verify cutoffs are within 20%."""
    payload = {
        "exam": "JEE_MAIN",
        "rank": 850,
        "percentile": None,
        "category": "GENERAL",
        "home_state": "MH",
        "gender": "M",
        "year": 2025,
        "filters": {
            "branches": ["CS"],
            "college_types": ["IIT"],
            "states": ["MH"],
            "max_fees_per_year": None
        }
    }
    response = client.post("/v1/predict/college", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert "metadata" in data
    predictions = data["predictions"]
    assert len(predictions) > 0
    
    pred = predictions[0]
    assert pred["college_code"] == "IIT_BOMBAY"
    assert pred["branch_code"] == "CS"
    assert pred["quota"] == "OS"
    assert "p10" in pred["confidence_interval"]
    assert "p50" in pred["confidence_interval"]
    assert "p90" in pred["confidence_interval"]
    
    actual_2024 = get_cutoff_rank("IIT_BOMBAY", "CS", "GENERAL", "OS", "M", 2024)
    predicted_closing = pred["predicted_closing_rank"]
    
    lower_bound = actual_2024 * 0.8
    upper_bound = actual_2024 * 1.2
    
    assert lower_bound <= predicted_closing <= upper_bound, \
        f"Predicted rank {predicted_closing} is not within 20% of actual {actual_2024}"
