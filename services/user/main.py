from datetime import datetime
import jwt
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from services.user.config import settings
from services.user.db import get_db, Base, engine
from services.user.models import User, StudentProfile, PredictionHistory
from services.user.schemas import (
    UserProfileResponse,
    UserProfileUpdate,
    ExamDetailsRegister,
    StudentProfileResponse,
    MessageResponse,
    PredictionHistoryResponse,
)
from services.user.profiles import (
    update_or_create_exam_details,
    get_predictions_history,
)
from services.user.rate_limit import RateLimitMiddleware

app = FastAPI(title="ADMIT OS User Service", version="1.0.0")
app.add_middleware(RateLimitMiddleware)


# Create tables on startup for simplicity in development
@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)


security = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or token type",
            )
        return int(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def get_current_user(
    user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )
    return user


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "user-service"}


@app.get("/v1/profile/me", response_model=UserProfileResponse)
def get_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@app.patch("/v1/profile/me", response_model=UserProfileResponse)
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if payload.name is not None:
        current_user.name = payload.name
    if payload.phone is not None:
        current_user.phone = payload.phone
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/v1/profile/exam-details", response_model=StudentProfileResponse)
def post_exam_details(
    payload: ExamDetailsRegister,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentProfile:
    profile = update_or_create_exam_details(db, current_user.id, payload)
    return profile


@app.get(
    "/v1/profile/me/predictions-history", response_model=list[PredictionHistoryResponse]
)
def get_my_predictions_history(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PredictionHistory]:
    history = get_predictions_history(db, current_user.id)
    return history


@app.delete("/v1/profile/me", response_model=MessageResponse)
def delete_my_profile(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MessageResponse:
    # Soft-delete immediately, schedule permanent wipe within 72 hours
    current_user.deleted_at = datetime.utcnow()
    db.commit()
    return MessageResponse(
        message="Account deactivated. All PII and exam data will be permanently deleted within 72 hours."
    )
