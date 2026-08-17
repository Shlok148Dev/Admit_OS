from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from services.auth.db import Base


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

    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True
    )

    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")
