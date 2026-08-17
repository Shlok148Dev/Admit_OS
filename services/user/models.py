from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    JSON,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from services.user.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True
    )
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True)
    name = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    google_id = Column(String(255), unique=True, nullable=True)
    apple_id = Column(String(255), unique=True, nullable=True)
    tier = Column(String(10), default="FREE")  # FREE, PAID
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    profile = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    predictions = relationship(
        "PredictionHistory", back_populates="user", cascade="all, delete-orphan"
    )


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True
    )
    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    primary_exam = Column(String(20), nullable=True)
    exam_year = Column(Integer, nullable=True)
    rank = Column(Integer, nullable=True)
    percentile = Column(Numeric(7, 4), nullable=True)
    category = Column(String(15), nullable=True)
    home_state = Column(String(30), nullable=True)
    gender = Column(String(10), nullable=True)
    preferences = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True
    )

    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exam_type = Column(String(20), nullable=False)
    rank = Column(Integer, nullable=False)
    category = Column(String(15), nullable=False)
    predictions = Column(
        JSON().with_variant(JSONB, "postgresql"), nullable=False
    )  # stores list of colleges predicted
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="predictions")
