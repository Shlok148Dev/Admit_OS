from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class CareerPathsRequest(BaseModel):
    branch_code: str = Field(..., description="e.g. CS, EC, ME")
    college_code: Optional[str] = Field(None, description="e.g. IIT_BOMBAY, NIT_TRICHY")


class JobRoleDetail(BaseModel):
    title: str
    domain: str
    transition_rate: Optional[float] = None
    median_salary: str
    companies: List[str]
    skills: List[str]


class CareerPathsResponse(BaseModel):
    branch_code: str
    college_code: Optional[str]
    paths: List[JobRoleDetail]
    pg_programs: List[str]


class BranchPlacementRates(BaseModel):
    iit_placement_rate: float
    iit_median_salary: float
    nit_placement_rate: float
    nit_median_salary: float


class BranchOverviewResponse(BaseModel):
    code: str
    name: str
    placement_rates: BranchPlacementRates
    common_jobs: List[JobRoleDetail]
    core_skills: List[str]
    average_salary_range: str
    transition_options: Dict[str, float]
    pg_feeds: List[str]


class BranchCompareResponse(BaseModel):
    b1: BranchOverviewResponse
    b2: BranchOverviewResponse


class ScholarshipResponse(BaseModel):
    id: int
    name: str
    provider: str
    description: str
    amount: str
    eligibility_criteria: Optional[str]
    eligible_categories: Optional[List[str]] = None
    eligible_states: Optional[List[str]] = None
    eligible_genders: Optional[List[str]] = None
    max_family_income: Optional[float] = None
    min_academic_score: Optional[float] = None
    source_url: str
    data_confidence: str

    class Config:
        from_attributes = True
