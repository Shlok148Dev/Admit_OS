"""
Pydantic schemas for request/response serialization.
"""

from datetime import datetime
from typing import Optional, Dict
from pydantic import BaseModel, ConfigDict, Field


class OutcomeSubmissionCreate(BaseModel):
    exam_type: str = Field(..., max_length=20, examples=["JEE_MAIN"])
    counseling_body: str = Field(..., max_length=20, examples=["JoSAA"])
    year: int = Field(..., examples=[2026])
    round_number: int = Field(..., examples=[1])
    college_code: str = Field(..., max_length=20, examples=["NIT_TRICHY"])
    branch_code: str = Field(..., max_length=10, examples=["CS"])
    category: str = Field(..., max_length=15, examples=["GENERAL"])
    quota: str = Field(..., max_length=10, examples=["OS"])
    student_rank: int = Field(..., gt=0, examples=[1250])
    source_url: Optional[str] = Field(None, examples=["https://josaa.nic.in"])


class OutcomeSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    exam_type: str
    counseling_body: str
    year: int
    round_number: int
    college_code: str
    branch_code: str
    category: str
    quota: str
    student_rank: int
    source_url: Optional[str]
    data_confidence: str
    sme_verified: bool
    is_anomalous: bool
    created_at: datetime


class AccuracyMetricsDetail(BaseModel):
    mae: float
    accuracy_within_300: float
    accuracy_within_500: float
    accuracy_within_1000: float
    total_evaluated: int


class PublicAccuracyResponse(BaseModel):
    overall: AccuracyMetricsDetail
    by_exam: Dict[str, AccuracyMetricsDetail]
    data_confidence_disclaimer: str
    data_as_of: str
