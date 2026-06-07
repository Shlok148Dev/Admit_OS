"""
Unit and integration tests for new NEET, MHT_CET models and GET /v1/admin/sme-queue endpoint.
"""

from __future__ import annotations

import os
os.environ["DATABASE_URL"] = "sqlite:///./test_prediction_new.db"

import base64
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ..main import app, get_db
from ..database import SMEReviewQueue

@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    """Test client fixture running the FastAPI application lifespan."""
    # Ensure test environment uses test db
    os.environ["DATABASE_URL"] = "sqlite:///./test_prediction_new.db"
    
    if os.path.exists("./test_prediction_new.db"):
        try:
            os.remove("./test_prediction_new.db")
        except Exception:
            pass

    with TestClient(app) as c:
        yield c

    if os.path.exists("./test_prediction_new.db"):
        try:
            os.remove("./test_prediction_new.db")
        except Exception:
            pass

def test_neet_predict_college_integration(client: TestClient) -> None:
    """Test predicting college options for NEET exam type."""
    payload = {
        "exam": "NEET",
        "rank": 140,
        "percentile": None,
        "category": "GENERAL",
        "home_state": "DL",
        "gender": "M",
        "year": 2025,
        "filters": {
            "branches": ["MBBS"],
            "college_types": ["DEEMED"],
            "states": ["DL"],
            "max_fees_per_year": None
        }
    }
    response = client.post("/v1/predict/college", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    predictions = data["predictions"]
    assert len(predictions) > 0
    assert predictions[0]["college_code"] == "AIIMS_DELHI"
    assert predictions[0]["branch_code"] == "MBBS"
    assert predictions[0]["quota"] == "AIQ"

def test_mhtcet_predict_college_integration(client: TestClient) -> None:
    """Test predicting college options for MHT_CET exam type."""
    payload = {
        "exam": "MHT_CET",
        "rank": 220,
        "percentile": None,
        "category": "GOPENS",
        "home_state": "MH",
        "gender": "M",
        "year": 2025,
        "filters": {
            "branches": ["CS"],
            "college_types": ["STATE"],
            "states": ["MH"],
            "max_fees_per_year": None
        }
    }
    response = client.post("/v1/predict/college", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    predictions = data["predictions"]
    assert len(predictions) > 0
    assert predictions[0]["college_code"] == "COEP_PUNE"
    assert predictions[0]["branch_code"] == "CS"
    assert predictions[0]["quota"] == "MS"

def test_sme_queue_auth_failure(client: TestClient) -> None:
    """Test GET /v1/admin/sme-queue returns 401 without valid basic auth."""
    response = client.get("/v1/admin/sme-queue")
    assert response.status_code == 401

    # Bad auth
    headers = {"Authorization": "Basic " + base64.b64encode(b"admin:wrongpassword").decode("utf-8")}
    response = client.get("/v1/admin/sme-queue", headers=headers)
    assert response.status_code == 401

def test_sme_queue_auth_success(client: TestClient) -> None:
    """Test GET /v1/admin/sme-queue returns items with valid basic auth."""
    # First, insert a mock item into the DB
    db = next(get_db())
    db.add(SMEReviewQueue(
        exam_type="NEET",
        counseling_body="MCC",
        year=2024,
        round_number=1,
        college_code="AIIMS_DELHI",
        branch_code="MBBS",
        category="GENERAL",
        quota="AIQ",
        opening_rank=10,
        closing_rank=150,
        source_url="https://mcc.nic.in",
        reason="Range check failed",
        resolved=False
    ))
    db.commit()

    headers = {"Authorization": "Basic " + base64.b64encode(b"admin:admin_secure_pass123").decode("utf-8")}
    response = client.get("/v1/admin/sme-queue", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    item = data[0]
    assert item["exam_type"] == "NEET"
    assert item["college_code"] == "AIIMS_DELHI"
    assert item["reason"] == "Range check failed"
    assert item["resolved"] is False
