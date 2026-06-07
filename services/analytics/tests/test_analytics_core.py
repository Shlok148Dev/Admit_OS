"""
Core unit tests for outcomes and administrative endpoints in the analytics service.
"""

import os
import pytest
from datetime import datetime, timedelta
import jwt as pyjwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup test DB environment variable
os.environ["DATABASE_URL"] = "sqlite:///./test_admitos.db"
os.environ["JWT_SECRET"] = "super-secret-access-key-12345"

from services.analytics.main import app
from services.analytics.db import Base, engine
from services.analytics.models import OutcomeSubmission, AccuracyMetric, PredictionLog, SMEReviewQueue, ExamCutoff

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
        "exp": datetime.utcnow() + timedelta(minutes=15)
    }
    token = pyjwt.encode(payload, "super-secret-access-key-12345", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}

def test_outcome_submission_success():
    db = TestingSessionLocal()
    pred_log = PredictionLog(
        exam_type="JEE_MAIN",
        college_code="NIT_TRICHY",
        branch_code="CS",
        category="GENERAL",
        quota="OS",
        gender="M",
        rank=1250,
        predicted_closing_rank=1300,
        admission_probability=0.85
    )
    db.add(pred_log)
    db.commit()
    db.close()

    headers = get_auth_headers(user_id=42)
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
        "source_url": "https://josaa.nic.in"
    }

    resp = client.post("/v1/outcomes/submit", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == 42
    assert data["is_anomalous"] is False
    assert data["data_confidence"] == "HIGH"

    db = TestingSessionLocal()
    updated_log = db.query(PredictionLog).first()
    assert updated_log.actual_allotted is True
    assert updated_log.actual_rank == 1250
    db.close()

def test_outcome_submission_anomalous():
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
        closing_rank=500,
        data_confidence="HIGH",
        source_url="https://josaa.nic.in"
    )
    db.add(cutoff)
    db.commit()
    db.close()

    headers = get_auth_headers(user_id=99)
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
        "source_url": "https://josaa.nic.in"
    }

    resp = client.post("/v1/outcomes/submit", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_anomalous"] is True
    assert data["data_confidence"] == "LOW"

    db = TestingSessionLocal()
    sme_item = db.query(SMEReviewQueue).first()
    assert sme_item is not None
    assert sme_item.resolved is False
    assert "NIT_TRICHY" in sme_item.college_code
    db.close()

def test_get_public_accuracy_cached():
    db = TestingSessionLocal()
    metric = AccuracyMetric(
        exam_type="JEE_MAIN",
        mae=120.5,
        accuracy_within_300=0.92,
        accuracy_within_500=0.95,
        accuracy_within_1000=0.98,
        total_evaluated=500
    )
    db.add(metric)
    db.commit()
    db.close()

    resp = client.get("/v1/analytics/accuracy/public")
    assert resp.status_code == 200
    data = resp.json()
    assert "JEE_MAIN" in data["by_exam"]
    assert data["by_exam"]["JEE_MAIN"]["mae"] == 120.5

def test_admin_get_queue():
    db = TestingSessionLocal()
    item1 = SMEReviewQueue(
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_DELHI",
        branch_code="CS",
        category="GENERAL",
        quota="OS",
        opening_rank=1000,
        closing_rank=1200,
        source_url="http://example.com",
        reason="Test anomaly 1",
        resolved=False
    )
    item2 = SMEReviewQueue(
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_BOMBAY",
        branch_code="EE",
        category="GENERAL",
        quota="OS",
        opening_rank=800,
        closing_rank=900,
        source_url="http://example.com",
        reason="Test anomaly 2",
        resolved=True
    )
    db.add_all([item1, item2])
    db.commit()
    db.close()

    resp = client.get("/v1/analytics/admin/queue", auth=("admin", "admin_secure_pass123"))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    resp_unres = client.get("/v1/analytics/admin/queue?resolved=false", auth=("admin", "admin_secure_pass123"))
    assert resp_unres.status_code == 200
    data_unres = resp_unres.json()
    assert len(data_unres) == 1
    assert data_unres[0]["college_code"] == "IIT_DELHI"

def test_admin_resolve_item():
    db = TestingSessionLocal()
    sub = OutcomeSubmission(
        user_id=1,
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_BOMBAY",
        branch_code="CS",
        category="GENERAL",
        quota="OS",
        student_rank=1500,
        data_confidence="LOW",
        is_anomalous=True
    )
    db.add(sub)
    item = SMEReviewQueue(
        exam_type="JEE_MAIN",
        counseling_body="JoSAA",
        year=2026,
        round_number=1,
        college_code="IIT_BOMBAY",
        branch_code="CS",
        category="GENERAL",
        quota="OS",
        opening_rank=1500,
        closing_rank=1500,
        source_url="Test URL",
        reason="Test anomaly",
        resolved=False
    )
    db.add(item)
    db.commit()
    item_id = item.id
    db.close()

    resp = client.post(f"/v1/analytics/admin/queue/{item_id}/resolve?approve=true", auth=("admin", "admin_secure_pass123"))
    assert resp.status_code == 200

    db = TestingSessionLocal()
    resolved_item = db.query(SMEReviewQueue).filter(SMEReviewQueue.id == item_id).first()
    assert resolved_item.resolved is True
    
    updated_sub = db.query(OutcomeSubmission).first()
    assert updated_sub.sme_verified is True
    assert updated_sub.data_confidence == "HIGH"

    new_cutoff = db.query(ExamCutoff).filter(ExamCutoff.college_code == "IIT_BOMBAY").first()
    assert new_cutoff is not None
    assert new_cutoff.closing_rank == 1500
    db.close()

def test_admin_health_and_performance():
    resp_health = client.get("/v1/analytics/admin/health", auth=("admin", "admin_secure_pass123"))
    assert resp_health.status_code == 200
    data_health = resp_health.json()
    assert data_health["db_connection"] == "healthy"

    resp_perf = client.get("/v1/analytics/admin/performance", auth=("admin", "admin_secure_pass123"))
    assert resp_perf.status_code == 200
    data_perf = resp_perf.json()
    assert "total_prediction_logs" in data_perf
