from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean, DateTime, ForeignKey, Numeric, JSON, Text, SmallInteger
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from services.notification.db import Base
from services.notification.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
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
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")

class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
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

class NotificationLog(Base):
    __tablename__ = "notification_log"

    if is_sqlite:
        id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
        created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
        __table_args__ = ()
    else:
        # Composite primary key for PostgreSQL range partitioning
        id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
        created_at = Column(DateTime(timezone=True), primary_key=True, default=datetime.utcnow)
        __table_args__ = (
            {"postgresql_partition_by": "RANGE (created_at)"}
        )

    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    channel = Column(String(10), nullable=False)  # PUSH, EMAIL, SMS, WHATSAPP
    template_id = Column(String(50), nullable=False)
    variables = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    status = Column(String(15), nullable=False, default="PENDING")  # PENDING, SENT, FAILED, OPENED
    sent_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    exam_relevance = Column(String(20), nullable=True)

class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    template_key = Column(String(50), unique=True, nullable=False, index=True)
    channel = Column(String(10), nullable=False)
    title_template = Column(String(200), nullable=False)
    body_template = Column(Text, nullable=False)
    exam_type = Column(String(20), nullable=True)
    priority = Column(String(10), nullable=False)  # CRITICAL, HIGH, NORMAL

class CounselingSchedule(Base):
    __tablename__ = "counseling_schedule"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    event_name = Column(String(200), nullable=False)
    exam_type = Column(String(20), nullable=False)
    round_number = Column(SmallInteger, nullable=True)
    event_date = Column(DateTime(timezone=True), nullable=False)
    action_required = Column(Boolean, default=False)
    official_url = Column(Text, nullable=True)

class NotificationSubscription(Base):
    __tablename__ = "notification_subscriptions"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    exam_type = Column(String(20), nullable=True)
    college_code = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    channels = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)  # e.g., {"PUSH": true, "EMAIL": true}
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    platform = Column(String(20), nullable=False)  # "android", "ios", "web"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

