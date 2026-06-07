from sqlalchemy.orm import Session
from services.user.models import StudentProfile, PredictionHistory
from services.user.schemas import ExamDetailsRegister

def get_student_profile(db: Session, user_id: int) -> StudentProfile | None:
    """Retrieve student profile by user_id."""
    return db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()

def create_default_profile(db: Session, user_id: int) -> StudentProfile:
    """Create a default empty profile for a user."""
    profile = StudentProfile(user_id=user_id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile

def update_or_create_exam_details(
    db: Session, user_id: int, exam_details: ExamDetailsRegister
) -> StudentProfile:
    """Create or update exam details for the user."""
    profile = get_student_profile(db, user_id)
    if not profile:
        profile = StudentProfile(user_id=user_id)
        db.add(profile)
    
    profile.primary_exam = exam_details.primary_exam
    profile.exam_year = exam_details.exam_year
    profile.rank = exam_details.rank
    profile.percentile = exam_details.percentile
    profile.category = exam_details.category
    profile.home_state = exam_details.home_state
    profile.gender = exam_details.gender
    profile.preferences = exam_details.preferences
    
    db.commit()
    db.refresh(profile)
    return profile

def get_predictions_history(db: Session, user_id: int) -> list[PredictionHistory]:
    """Retrieve prediction history for a user."""
    return db.query(PredictionHistory).filter(PredictionHistory.user_id == user_id).all()
