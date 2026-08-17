from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    name: str | None
    phone: str | None
    tier: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None


class ExamDetailsRegister(BaseModel):
    primary_exam: str = Field(..., max_length=20)
    exam_year: int
    rank: int
    percentile: float | None = None
    category: str = Field(..., max_length=15)
    home_state: str = Field(..., max_length=30)
    gender: str = Field(..., max_length=10)
    preferences: dict | None = None


class StudentProfileResponse(BaseModel):
    id: int
    user_id: int
    primary_exam: str | None
    exam_year: int | None
    rank: int | None
    percentile: float | None
    category: str | None
    home_state: str | None
    gender: str | None
    preferences: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class PredictionHistoryResponse(BaseModel):
    id: int
    user_id: int
    exam_type: str
    rank: int
    category: str
    predictions: list[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
