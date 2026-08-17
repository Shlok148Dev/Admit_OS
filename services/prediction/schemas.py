"""
Pydantic schema definitions for prediction-service API matching Technical Bible Section 6.3.
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ExamEnum(str, Enum):
    """Exam types supported by predictor."""

    JEE_MAIN = "JEE_MAIN"
    JEE_ADVANCED = "JEE_ADVANCED"
    NEET = "NEET"
    MHT_CET = "MHT_CET"
    KCET = "KCET"


class CategoryEnum(str, Enum):
    """Student admission categories."""

    GENERAL = "GENERAL"
    OBC_NCL = "OBC_NCL"
    SC = "SC"
    ST = "ST"
    EWS = "EWS"
    PwD = "PwD"
    OBC = "OBC"
    GOPENS = "GOPENS"
    GSCS = "GSCS"
    GSTS = "GSTS"
    LOBCS = "LOBCS"
    TFWS = "TFWS"
    PWD = "PWD"


class GenderEnum(str, Enum):
    """Student genders."""

    M = "M"
    F = "F"
    OTHER = "OTHER"


class PredictionFilters(BaseModel):
    """Optional filters for college prediction list."""

    branches: Optional[List[str]] = Field(None, description="Preferred branches")
    college_types: Optional[List[str]] = Field(
        None, description="Preferred college types"
    )
    states: Optional[List[str]] = Field(None, description="Preferred states")
    max_fees_per_year: Optional[int] = Field(None, description="Max fees limit")


class CollegePredictionRequest(BaseModel):
    """Request payload schema for college prediction."""

    exam: ExamEnum
    rank: int = Field(..., gt=0, description="Student's rank")
    percentile: Optional[float] = Field(
        None, ge=0.0, le=100.0, description="Student's percentile"
    )
    category: CategoryEnum
    home_state: str = Field(
        ..., min_length=2, max_length=2, description="ISO state code"
    )
    gender: GenderEnum
    year: Optional[int] = Field(2026, description="Counseling year")
    filters: Optional[PredictionFilters] = None


class ConfidenceInterval(BaseModel):
    """Confidence bounds of the prediction."""

    p10: int
    p50: int
    p90: int


class CollegePrediction(BaseModel):
    """A single predicted college option."""

    college_code: str
    college_name: str
    branch_code: str
    branch_name: str
    quota: str
    predicted_opening_rank: int
    predicted_closing_rank: int
    confidence_interval: ConfidenceInterval
    admission_probability: float
    historical_closing_ranks: Dict[str, int]
    trend: str
    data_confidence: str
    data_source: str
    source_url: str
    fees_per_year: int
    nirf_rank: Optional[int]


class PredictionMetadata(BaseModel):
    """Metadata for the prediction response."""

    model_version: str
    prediction_timestamp: str
    data_as_of: str
    total_predictions: int
    disclaimer: str


class CollegePredictionResponse(BaseModel):
    """Response payload schema for college prediction."""

    predictions: List[CollegePrediction]
    metadata: PredictionMetadata
    low_probability_warning: Optional[str] = None


class SMEReviewQueueItem(BaseModel):
    """Response payload schema for SME Review Queue items."""

    id: int
    exam_type: str
    counseling_body: str
    year: int
    round_number: int
    college_code: str
    branch_code: str
    category: str
    quota: str
    opening_rank: Optional[int] = None
    closing_rank: Optional[int] = None
    total_seats: Optional[int] = None
    allotted_seats: Optional[int] = None
    source_url: str
    reason: str
    resolved: bool
    reviewer_id: Optional[int] = None

    model_config = {"from_attributes": True}


from datetime import datetime


class CollegeProfileSchema(BaseModel):
    """Schema representing the full college profile matching the colleges database table."""

    college_code: str
    name: str
    type: str
    state: str
    city: str
    nirf_rank_engineering: Optional[int] = None
    nirf_rank_overall: Optional[int] = None
    naac_grade: Optional[str] = None
    established_year: Optional[int] = None
    total_intake: Optional[int] = None
    hostel_available: Optional[bool] = None
    website_url: Optional[str] = None
    official_admission_url: Optional[str] = None
    last_verified: Optional[datetime] = None

    model_config = {"from_attributes": True}
