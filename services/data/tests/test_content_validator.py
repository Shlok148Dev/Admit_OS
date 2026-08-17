"""
Unit tests for ContentValidationAgent in services/data/validators/content_validator.py.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from services.prediction.database import Base, SMEReviewQueue
from services.data.validators.content_validator import ContentValidationAgent


# In-memory SQLite for testing DB interactions
@pytest.fixture(name="db_session")
def fixture_db_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_class = sessionmaker(bind=engine)
    session = session_class()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture(name="agent")
def fixture_agent(db_session: Session) -> ContentValidationAgent:
    return ContentValidationAgent(db_session=db_session)


@pytest.fixture(name="valid_record")
def fixture_valid_record() -> dict:
    return {
        "exam_type": "NEET",
        "counseling_body": "MCC",
        "year": 2024,
        "round_number": 1,
        "college_code": "AIIMS_DELHI",
        "branch_code": "MBBS",
        "category": "GENERAL",
        "quota": "AIQ",
        "opening_rank": 5,
        "closing_rank": 50,
        "source_url": "http://mcc.nic.in/neet",
    }


def test_validate_schema_success(
    agent: ContentValidationAgent, valid_record: dict
) -> None:
    errors = agent.validate_schema(valid_record)
    assert len(errors) == 0


def test_validate_schema_missing_fields(agent: ContentValidationAgent) -> None:
    record = {"exam_type": "NEET"}
    errors = agent.validate_schema(record)
    assert len(errors) > 0
    assert any("Missing required field" in err for err in errors)


def test_validate_schema_invalid_types(
    agent: ContentValidationAgent, valid_record: dict
) -> None:
    record = valid_record.copy()
    record["year"] = "not-a-year"
    errors = agent.validate_schema(record)
    assert len(errors) > 0
    assert any("Invalid year" in err for err in errors)


def test_validate_range_success(
    agent: ContentValidationAgent, valid_record: dict
) -> None:
    errors = agent.validate_range(valid_record)
    assert len(errors) == 0


def test_validate_range_failure(
    agent: ContentValidationAgent, valid_record: dict
) -> None:
    record = valid_record.copy()
    record["opening_rank"] = 100
    record["closing_rank"] = 50
    errors = agent.validate_range(record)
    assert len(errors) == 1
    assert "is less than opening_rank" in errors[0]


def test_validate_historical_sparse_data(
    agent: ContentValidationAgent, valid_record: dict
) -> None:
    # Sparse data (n < 3), mean = 40. 50% deviation allowed (20 to 60).
    history = [38, 42]

    # 45 is within 50%
    anomalies = agent.validate_historical_plausibility(valid_record, history)
    assert len(anomalies) == 0

    # 100 is outside 50%
    record = valid_record.copy()
    record["closing_rank"] = 100
    anomalies = agent.validate_historical_plausibility(record, history)
    assert len(anomalies) == 1
    assert "sparse data" in anomalies[0]


def test_validate_historical_3_sigma_anomaly(
    agent: ContentValidationAgent, valid_record: dict
) -> None:
    # History with mean = 50, std_dev = 2
    history = [48, 50, 52]

    # 51 is within 3-sigma (44 to 56)
    record = valid_record.copy()
    record["closing_rank"] = 51
    anomalies = agent.validate_historical_plausibility(record, history)
    assert len(anomalies) == 0

    # 60 is outside 3-sigma (60 > 56)
    record["closing_rank"] = 60
    anomalies = agent.validate_historical_plausibility(record, history)
    assert len(anomalies) == 1
    assert "3-sigma" in anomalies[0]


def test_validate_cross_source(agent: ContentValidationAgent) -> None:
    # 3/3 agree
    conf, errs = agent.validate_cross_source([50, 50, 50])
    assert conf == "HIGH"
    assert len(errs) == 0

    # 2/3 agree
    conf, errs = agent.validate_cross_source([50, 50, 55])
    assert conf == "MEDIUM"
    assert len(errs) == 1

    # Disagree
    conf, errs = agent.validate_cross_source([50, 52, 55])
    assert conf == "LOW"
    assert len(errs) == 1


def test_process_and_validate_sme_queue_push(
    agent: ContentValidationAgent, db_session: Session, valid_record: dict
) -> None:
    # Test valid record does not push to queue
    res = agent.process_and_validate(valid_record, [45, 50, 55], [50, 50, 50])
    assert res["is_valid"] is True
    assert res["confidence"] == "HIGH"
    assert db_session.query(SMEReviewQueue).count() == 0

    # Test record with range check failure pushes to queue
    record_fail = valid_record.copy()
    record_fail["opening_rank"] = 200
    record_fail["closing_rank"] = 50
    res_fail = agent.process_and_validate(record_fail)
    assert res_fail["is_valid"] is False
    assert db_session.query(SMEReviewQueue).count() == 1

    queued = db_session.query(SMEReviewQueue).first()
    assert queued.reason == "Range check failed"
