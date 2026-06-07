"""
Database models for the analytics microservice.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, SmallInteger, String, Boolean, DateTime, Float, Text, UniqueConstraint, CheckConstraint
from services.analytics.db import Base

class OutcomeSubmission(Base):
    """Table to collect actual seat allotment outcomes from students."""
    __tablename__ = "outcome_submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    exam_type = Column(String(20), nullable=False)
    counseling_body = Column(String(20), nullable=False)
    year = Column(SmallInteger, nullable=False)
    round_number = Column(SmallInteger, nullable=False)
    college_code = Column(String(20), nullable=False)
    branch_code = Column(String(10), nullable=False)
    category = Column(String(15), nullable=False)
    quota = Column(String(10), nullable=False)
    student_rank = Column(Integer, nullable=False)
    source_url = Column(Text, nullable=True)
    data_confidence = Column(String(6), default="HIGH")  # HIGH, MEDIUM, LOW
    sme_verified = Column(Boolean, default=False)
    is_anomalous = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "data_confidence IN ('HIGH', 'MEDIUM', 'LOW')",
            name="chk_submission_confidence"
        ),
    )

class AccuracyMetric(Base):
    """Table to store calculated public accuracy statistics."""
    __tablename__ = "accuracy_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    exam_type = Column(String(20), unique=True, nullable=False)
    mae = Column(Float, nullable=False)
    accuracy_within_300 = Column(Float, nullable=False)
    accuracy_within_500 = Column(Float, nullable=False)
    accuracy_within_1000 = Column(Float, nullable=False)
    total_evaluated = Column(Integer, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

# Mapping prediction tables in analytics service (since they reside in the same DB)

class PredictionLog(Base):
    """Table to log prediction queries and results for monitoring and shadow testing."""
    __tablename__ = "prediction_logs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    exam_type = Column(String(20), nullable=False)
    college_code = Column(String(20), nullable=False)
    branch_code = Column(String(10), nullable=False)
    category = Column(String(15), nullable=False)
    quota = Column(String(10), nullable=False)
    gender = Column(String(6), nullable=False)
    rank = Column(Integer, nullable=False)
    predicted_closing_rank = Column(Integer, nullable=False)
    admission_probability = Column(Float, nullable=False)
    actual_allotted = Column(Boolean, nullable=True)
    actual_rank = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class SMEReviewQueue(Base):
    """SME Review Queue table model for low-confidence or anomalous cutoffs."""
    __tablename__ = "sme_review_queue"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    exam_type = Column(String(20), nullable=False)
    counseling_body = Column(String(20), nullable=False)
    year = Column(SmallInteger, nullable=False)
    round_number = Column(SmallInteger, nullable=False)
    college_code = Column(String(20), nullable=False)
    branch_code = Column(String(10), nullable=False)
    category = Column(String(15), nullable=False)
    quota = Column(String(10), nullable=False)
    opening_rank = Column(Integer, nullable=True)
    closing_rank = Column(Integer, nullable=True)
    total_seats = Column(SmallInteger, nullable=True)
    allotted_seats = Column(SmallInteger, nullable=True)
    source_url = Column(Text, nullable=False)
    reason = Column(String(255), nullable=False)
    resolved = Column(Boolean, default=False)
    reviewer_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

class ExamCutoff(Base):
    """Exam cutoff table model."""
    __tablename__ = "exam_cutoffs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    exam_type = Column(String(20), nullable=False)
    counseling_body = Column(String(20), nullable=False)
    year = Column(SmallInteger, nullable=False)
    round_number = Column(SmallInteger, nullable=False)
    college_code = Column(String(20), nullable=False)
    branch_code = Column(String(10), nullable=False)
    category = Column(String(15), nullable=False)
    quota = Column(String(10), nullable=False)
    opening_rank = Column(Integer, nullable=True)
    closing_rank = Column(Integer, nullable=True)
    total_seats = Column(SmallInteger, nullable=True)
    allotted_seats = Column(SmallInteger, nullable=True)
    data_confidence = Column(String(6), nullable=False)
    source_url = Column(Text, nullable=False)
    source_document_hash = Column(String(64), nullable=True)
    sme_verified = Column(Boolean, default=False)
    sme_reviewer_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
