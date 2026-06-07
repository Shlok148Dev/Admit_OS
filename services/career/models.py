from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, JSON
from sqlalchemy.dialects.postgresql import JSONB
from services.career.db import Base

class Scholarship(Base):
    __tablename__ = "scholarships"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    provider = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(String(255), nullable=False)
    eligibility_criteria = Column(Text, nullable=True)
    eligible_categories = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    eligible_states = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    eligible_genders = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    max_family_income = Column(Numeric(12, 2), nullable=True)
    min_academic_score = Column(Numeric(5, 2), nullable=True)
    source_url = Column(Text, nullable=False)
    data_confidence = Column(String(10), default="HIGH")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
