"""
Pydantic schemas for the counseling service endpoints, following Pydantic v2 specs.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class StudentProfile(BaseModel):
    rank: int = Field(..., description="Rank in the primary exam")
    percentile: Optional[float] = Field(
        None, description="Percentile in the primary exam"
    )
    category: str = Field(
        ..., description="Category: GENERAL, OBC_NCL, SC, ST, EWS, PwD"
    )
    home_state: str = Field(
        ..., description="ISO state code of home state, e.g. MH, KA, TN"
    )
    gender: str = Field(..., description="Gender: M, F, OTHER")
    primary_exam: Optional[str] = Field(None, description="JEE_MAIN, NEET, etc.")
    exam: Optional[str] = Field(
        None, description="Alias for primary_exam from frontend"
    )
    preferences: Optional[Dict[str, Any]] = Field(
        None, description="Additional custom preference weights"
    )

    @model_validator(mode="before")
    @classmethod
    def sync_exam_fields(cls, values: Any) -> Any:
        """Accept 'exam' from frontend and map it to 'primary_exam'."""
        if isinstance(values, dict):
            exam_val = values.get("exam")
            primary_val = values.get("primary_exam")
            if exam_val and not primary_val:
                values["primary_exam"] = exam_val
            elif primary_val and not exam_val:
                values["exam"] = primary_val
        return values


class Preferences(BaseModel):
    branch_priority: float = Field(..., ge=0.0, le=1.0)
    college_tier_priority: float = Field(..., ge=0.0, le=1.0)
    location_priority: float = Field(..., ge=0.0, le=1.0)
    fees_priority: float = Field(..., ge=0.0, le=1.0)
    preferred_branches: List[str] = Field(
        default_factory=list, description="Branches with interest score 1.0"
    )
    adjacent_branches: List[str] = Field(
        default_factory=list, description="Branches with interest score 0.6"
    )


class CandidateCollege(BaseModel):
    model_config = {"extra": "ignore"}

    college_code: str
    college_name: str
    branch_code: str
    branch_name: str
    predicted_closing_rank: int = Field(0, description="Predicted closing rank")
    admission_probability: float = Field(..., ge=0.0, le=1.0)
    fees_per_year: int
    nirf_rank: Optional[int] = Field(None, description="NIRF Engineering rank")
    quota: str = Field(..., description="HS, OS, etc.")


class ChoiceOutput(CandidateCollege):
    preference_score: float
    final_score: float
    explanation: str
    choice_number: Optional[int] = None
    label: Optional[str] = None


class OptimizeChoicesRequest(BaseModel):
    session_id: str
    student_profile: StudentProfile
    preferences: Preferences
    candidate_colleges: List[CandidateCollege]
    risk_appetite: str = Field(..., description="CONSERVATIVE, BALANCED, AGGRESSIVE")


class ChoiceItemOutput(BaseModel):
    choice_number: int
    college_code: str
    college_name: str
    branch_code: str
    branch_name: str
    admission_probability: float
    fees_per_year: int
    nirf_rank: Optional[int] = None
    quota: str
    reason: str
    label: Optional[str] = None


class OptimizeChoicesResponse(BaseModel):
    optimized_choices: List[ChoiceItemOutput]
    aspirational_choices: List[ChoiceItemOutput] = Field(default_factory=list)
    optimized_list: Optional[List[ChoiceItemOutput]] = None
    risk_score: int
    explanation: str
    strategy_used: Optional[str] = None
    exam_counseling_body: Optional[str] = None
    exam_has_upgrade_rounds: Optional[bool] = None
    exam_key_rule: Optional[str] = None
    all_reach_warning: Optional[bool] = None
    colleges_filtered_from: Optional[int] = None


class WhatIfRequest(BaseModel):
    session_id: str
    student_profile: StudentProfile
    preferences: Preferences
    candidate_colleges: List[CandidateCollege]
    risk_appetite: str
    rank_delta: int = Field(
        0, description="Change in rank (negative improves, positive worsens)"
    )
    new_category: Optional[str] = Field(None, description="Override category")
    new_home_state: Optional[str] = Field(None, description="Override home state")


class WhatIfDiffItem(BaseModel):
    college_code: str
    branch_code: str
    original_position: int
    new_position: int
    original_probability: float
    new_probability: float
    original_preference_score: float
    new_preference_score: float
    position_change: int


class WhatIfResponse(BaseModel):
    original_choices: List[ChoiceOutput]
    modified_choices: List[ChoiceOutput]
    diff: List[WhatIfDiffItem]
    metadata: Dict[str, Any]


class ChatRequest(BaseModel):
    session_id: str
    query: str
    history: List[Dict[str, str]] = Field(default_factory=list)
    exam_type: str = "JEE_MAIN"
    student_context: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    answer: str
    confidence: str = Field(..., description="HIGH, MEDIUM, LOW, DECLINED")
    sources: List[str]
    warning: Optional[str] = Field(
        None, description="Time-sensitive or verification warning"
    )
    is_fallback: Optional[bool] = None
    declined: Optional[bool] = None
    interactive_widget: Optional[Dict[str, Any]] = None
    student_profile_updates: Optional[Dict[str, Any]] = None
    tool_traces: Optional[List[Dict[str, Any]]] = None


class ChatQueryRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None
    exam_type: Optional[str] = None
    rank: Optional[int] = None
    category: Optional[str] = None
    home_state: Optional[str] = None
    gender: Optional[str] = None


class ChatSource(BaseModel):
    title: str
    url: str


class ChatQueryResponse(BaseModel):
    answer: str
    confidence: str
    sources: List[ChatSource]
    time_warning: Optional[str] = None
    interactive_widget: Optional[Dict[str, Any]] = None
    student_profile_updates: Optional[Dict[str, Any]] = None


class CompareRequest(BaseModel):
    student_profile: StudentProfile
    preferences: Preferences
    option_a: CandidateCollege
    option_b: CandidateCollege


class ComparisonMetric(BaseModel):
    metric_name: str
    option_a_value: Any
    option_b_value: Any
    winner: str  # "A" | "B" | "TIE"


class CompareResponse(BaseModel):
    option_a: ChoiceOutput
    option_b: ChoiceOutput
    metrics: List[ComparisonMetric]
    recommendation: str
    summary: str
