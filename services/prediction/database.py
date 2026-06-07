"""
Database setup and models matching the technical bible specifications exactly.
"""

import os
import logging
from datetime import datetime
from typing import Generator
from sqlalchemy import (
    create_engine, Column, Integer, String, SmallInteger, Boolean, Text, DateTime,
    UniqueConstraint, CheckConstraint, Float
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Configure logger
logger: logging.Logger = logging.getLogger("prediction_service.database")

Base = declarative_base()

class College(Base):
    """College master table model."""
    __tablename__ = "colleges"
    
    college_code = Column(String(20), primary_key=True)
    name = Column(String(200), nullable=False)
    type = Column(String(10), nullable=False)
    state = Column(String(30), nullable=False)
    city = Column(String(50), nullable=False)
    nirf_rank_engineering = Column(Integer, nullable=True)
    nirf_rank_overall = Column(Integer, nullable=True)
    naac_grade = Column(String(5), nullable=True)
    established_year = Column(SmallInteger, nullable=True)
    total_intake = Column(Integer, nullable=True)
    hostel_available = Column(Boolean, nullable=True)
    website_url = Column(Text, nullable=True)
    official_admission_url = Column(Text, nullable=True)
    last_verified = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "type IN ('IIT', 'NIT', 'IIIT', 'GFTI', 'DEEMED', 'STATE', 'PRIVATE')",
            name="valid_type"
        ),
    )

class ExamCutoff(Base):
    """Exam cutoff table model."""
    __tablename__ = "exam_cutoffs"
    
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

    __table_args__ = (
        UniqueConstraint(
            "exam_type", "counseling_body", "year", "round_number",
            "college_code", "branch_code", "category", "quota",
            name="uq_exam_cutoffs_combo"
        ),
        CheckConstraint(
            "data_confidence IN ('HIGH', 'MEDIUM', 'LOW')",
            name="chk_data_confidence"
        ),
    )

class SMEReviewQueue(Base):
    """SME Review Queue table model for low-confidence or anomalous cutoffs."""
    __tablename__ = "sme_review_queue"
    
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


class PredictionLog(Base):
    """Table to log prediction queries and results for monitoring and shadow testing."""

    __tablename__ = "prediction_logs"

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


class Guide(Base):
    """Guide table model for SEO and informational articles."""
    __tablename__ = "guides"

    slug = Column(String(50), primary_key=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    description = Column(String(200), nullable=True)
    category = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)



# Engine setup
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./admitos_prediction.db")
connect_args = {}
engine_args = {}
if DATABASE_URL.startswith("postgresql"):
    DATABASE_URL = DATABASE_URL.replace("?prepared_statement_cache_size=0", "").replace("&prepared_statement_cache_size=0", "")
    engine_args = {
        "pool_size": 20,
        "max_overflow": 40,
        "pool_timeout": 30,
        "pool_recycle": 3600,
        "pool_pre_ping": True
    }
elif DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_args = {"pool_pre_ping": True}
else:
    engine_args = {}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    logger.error(f"Failed to create database engine: {e}", exc_info=True)
    raise

def init_db() -> None:
    """Initialize database and create tables if they do not exist."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized and tables created.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)
        raise

def get_db() -> Generator[Session, None, None]:
    """Dependency injection to get database session."""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}", exc_info=True)
        raise
    finally:
        db.close()
