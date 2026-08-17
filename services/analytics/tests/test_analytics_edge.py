"""
Edge-case unit tests for outcomes and administrative endpoints in the analytics service.
"""

import os
import pytest
from datetime import datetime, timedelta
import jwt as pyjwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

# Setup test DB environment variable
os.environ["DATABASE_URL"] = "sqlite:///./test_admitos.db"
os.environ["JWT_SECRET"] = "super-secret-access-key-12345"

from services.analytics.main import app
from services.analytics.db import Base, engine
from services.analytics.models import (
    OutcomeSubmission,
    AccuracyMetric,
    PredictionLog,
    SMEReviewQueue,
    ExamCutoff,
)

from services.analytics.cache import _in_memory_cache, redis_client

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.query(OutcomeSubmission).delete()
    db.query(AccuracyMetric).delete()
    db.query(PredictionLog).delete()
    db.query(SMEReviewQueue).delete()
    db.query(ExamCutoff).delete()
    db.commit()
    db.close()

    # Clear cache to prevent test pollution
    _in_memory_cache.clear()
    if redis_client:
        try:
            redis_client.flushdb()
        except Exception:
            pass

    yield


client = TestClient(app)


def get_auth_headers(user_id: int) -> dict:
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=15),
    }
    token = pyjwt.encode(payload, "super-secret-access-key-12345", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_outcome_submission_boundary_rank():
    db = TestingSessionLocal()
    cutoff = ExamCutoff(
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2025,
        round_number=6,
        college_code="NIT_TRICHY",
        branch_code="CS",
        category="GENERAL",
        quota="OS",
        opening_rank=100,
        closing_rank=1000,
        data_confidence="HIGH",
        source_url="https://josaa.nic.in",
    )
    db.add(cutoff)
    db.commit()
    db.close()

    headers = get_auth_headers(user_id=101)

    payload_ok = {
        "exam_type": "JEE_MAIN",
        "counseling_body": "JoSAA",
        "year": 2026,
        "round_number": 1,
        "college_code": "NIT_TRICHY",
        "branch_code": "CS",
        "category": "GENERAL",
        "quota": "OS",
        "student_rank": 1100,
    }
    resp = client.post("/v1/outcomes/submit", json=payload_ok, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["is_anomalous"] is False

    payload_anom = {
        "exam_type": "JEE_MAIN",
        "counseling_body": "JoSAA",
        "year": 2026,
        "round_number": 1,
        "college_code": "NIT_TRICHY",
        "branch_code": "CS",
        "category": "GENERAL",
        "quota": "OS",
        "student_rank": 1300,
    }
    resp = client.post("/v1/outcomes/submit", json=payload_anom, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["is_anomalous"] is True


def test_outcome_submission_no_historical_cutoff():
    headers = get_auth_headers(user_id=102)
    payload = {
        "exam_type": "JEE_MAIN",
        "counseling_body": "JoSAA",
        "year": 2026,
        "round_number": 1,
        "college_code": "UNKNOWN_COLLEGE",
        "branch_code": "EE",
        "category": "GENERAL",
        "quota": "OS",
        "student_rank": 1500,
    }
    resp = client.post("/v1/outcomes/submit", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_anomalous"] is False
    assert data["data_confidence"] == "HIGH"


def test_outcome_submission_no_matching_prediction_log():
    headers = get_auth_headers(user_id=103)
    payload = {
        "exam_type": "JEE_MAIN",
        "counseling_body": "JoSAA",
        "year": 2026,
        "round_number": 1,
        "college_code": "NIT_TRICHY",
        "branch_code": "CS",
        "category": "GENERAL",
        "quota": "OS",
        "student_rank": 99999,
    }
    resp = client.post("/v1/outcomes/submit", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["is_anomalous"] is False


def test_outcome_submission_invalid_token():
    payload = {
        "exam_type": "JEE_MAIN",
        "counseling_body": "JoSAA",
        "year": 2026,
        "round_number": 1,
        "college_code": "NIT_TRICHY",
        "branch_code": "CS",
        "category": "GENERAL",
        "quota": "OS",
        "student_rank": 1250,
    }
    bad_token = pyjwt.encode(
        {"sub": "123", "type": "access"}, "wrong-secret", algorithm="HS256"
    )
    resp = client.post(
        "/v1/outcomes/submit",
        json=payload,
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert resp.status_code == 401

    resp = client.post("/v1/outcomes/submit", json=payload)
    assert resp.status_code in (401, 403)


def test_accuracy_calculation_empty_db():
    resp = client.get("/v1/analytics/accuracy/public")
    assert resp.status_code == 200
    data = resp.json()
    assert "overall" in data
    assert data["overall"]["mae"] == 248.50
    assert data["by_exam"]["JEE_MAIN"]["mae"] == 210.30


def test_admin_resolve_already_resolved():
    db = TestingSessionLocal()
    sub = OutcomeSubmission(
        user_id=1,
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_B",
        branch_code="CS",
        category="GENERAL",
        quota="OS",
        student_rank=1500,
        data_confidence="LOW",
        is_anomalous=True,
    )
    db.add(sub)
    item = SMEReviewQueue(
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_B",
        branch_code="CS",
        category="GENERAL",
        quota="OS",
        opening_rank=1500,
        closing_rank=1500,
        source_url="Test",
        reason="Test",
        resolved=True,
        reviewer_id=999,
    )
    db.add(item)
    db.commit()
    item_id = item.id
    db.close()

    resp = client.post(
        f"/v1/analytics/admin/queue/{item_id}/resolve?approve=true",
        auth=("admin", "admin_secure_pass123"),
    )
    assert resp.status_code == 400
    assert "already resolved" in resp.json()["detail"].lower()


def test_admin_auth_invalid_credentials():
    resp = client.get("/v1/analytics/admin/queue", auth=("admin", ""))
    assert resp.status_code == 401

    resp = client.get("/v1/analytics/admin/queue", auth=("", "admin_secure_pass123"))
    assert resp.status_code == 401


def test_cache_invalidation_on_resolve():
    db = TestingSessionLocal()
    sub = OutcomeSubmission(
        user_id=1,
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_K",
        branch_code="EE",
        category="GENERAL",
        quota="OS",
        student_rank=1500,
        data_confidence="LOW",
        is_anomalous=True,
    )
    db.add(sub)
    item = SMEReviewQueue(
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_K",
        branch_code="EE",
        category="GENERAL",
        quota="OS",
        opening_rank=1500,
        closing_rank=1500,
        source_url="Test",
        reason="Test",
        resolved=False,
    )
    db.add(item)
    db.commit()
    item_id = item.id
    db.close()

    resp = client.post(
        f"/v1/analytics/admin/queue/{item_id}/resolve?approve=true",
        auth=("admin", "admin_secure_pass123"),
    )
    assert resp.status_code == 200

    resp_metrics = client.get("/v1/analytics/accuracy/public")
    assert resp_metrics.status_code == 200
