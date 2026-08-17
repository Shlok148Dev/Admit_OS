import time
import logging
import json
import threading
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session
from services.user.db import SessionLocal
from services.user.models import User, StudentProfile, PredictionHistory

logger = logging.getLogger("cleanup")


def delete_user_related_records(db: Session, user_id: int) -> None:
    """Delete all records related to the user to prevent FK violations."""
    db.query(StudentProfile).filter(StudentProfile.user_id == user_id).delete()
    db.query(PredictionHistory).filter(PredictionHistory.user_id == user_id).delete()

    # Nullify any SME references if they exist
    # (Checking if column exists or we just execute direct SQL/ORM update)
    # Since we imported only User, StudentProfile, PredictionHistory:
    db.execute(
        text(
            "UPDATE exam_cutoffs SET sme_reviewer_id = NULL WHERE sme_reviewer_id = :user_id"
        ),
        {"user_id": user_id},
    )
    db.execute(
        text("DELETE FROM notification_log WHERE user_id = :user_id"),
        {"user_id": user_id},
    )
    db.execute(
        text("DELETE FROM refresh_tokens WHERE user_id = :user_id"),
        {"user_id": user_id},
    )


def permanently_erase_user(db: Session, user: User) -> None:
    """Erase all user PII and records from the database (DPDP compliant)."""
    try:
        user_id = user.id
        delete_user_related_records(db, user_id)
        db.delete(user)
        db.commit()
        logger.info(
            json.dumps(
                {
                    "event": "dpdp_permanent_erasure_success",
                    "message": f"Successfully wiped user {user_id} and all associated PII",
                }
            )
        )
    except Exception as e:
        db.rollback()
        logger.error(
            json.dumps(
                {
                    "event": "dpdp_permanent_erasure_failed",
                    "user_id": user.id,
                    "error": str(e),
                }
            )
        )


def cleanup_deleted_users(db: Session, retention_hours: int = 72) -> None:
    """Find and wipe users whose soft-delete period has expired."""
    cutoff_time = datetime.utcnow() - timedelta(hours=retention_hours)
    expired_users = (
        db.query(User)
        .filter(User.deleted_at.is_not(None), User.deleted_at <= cutoff_time)
        .all()
    )

    for user in expired_users:
        permanently_erase_user(db, user)


def run_cleanup_loop(interval_seconds: int = 3600) -> None:
    """Continuous background loop for cleanup execution."""
    while True:
        db = SessionLocal()
        try:
            cleanup_deleted_users(db)
        except Exception as e:
            logger.error(json.dumps({"event": "cleanup_loop_error", "error": str(e)}))
        finally:
            db.close()
        time.sleep(interval_seconds)


def start_cleanup_scheduler() -> None:
    """Start background cleanup worker thread."""
    thread = threading.Thread(target=run_cleanup_loop, daemon=True)
    thread.start()
