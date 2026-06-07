"""
SME Review Queue and Admin monitoring routes.
"""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from services.analytics.db import get_db
from services.analytics.models import OutcomeSubmission, SMEReviewQueue, ExamCutoff, PredictionLog
from services.analytics.auth import authenticate_admin
from services.analytics.cache import delete_cached_data

logger: logging.Logger = logging.getLogger("analytics_service.admin")

router = APIRouter()

def _map_queue_item_to_dict(item: SMEReviewQueue, db: Session) -> Dict[str, Any]:
    """Map queue item and corresponding outcome submission details to dict response."""
    sub = db.query(OutcomeSubmission).filter(
        OutcomeSubmission.exam_type == item.exam_type,
        OutcomeSubmission.college_code == item.college_code,
        OutcomeSubmission.branch_code == item.branch_code,
        OutcomeSubmission.category == item.category,
        OutcomeSubmission.quota == item.quota,
        OutcomeSubmission.student_rank == item.opening_rank
    ).first()

    return {
        "id": item.id,
        "exam_type": item.exam_type,
        "counseling_body": item.counseling_body,
        "year": item.year,
        "round_number": item.round_number,
        "college_code": item.college_code,
        "branch_code": item.branch_code,
        "category": item.category,
        "quota": item.quota,
        "opening_rank": item.opening_rank,
        "closing_rank": item.closing_rank,
        "source_url": item.source_url,
        "reason": item.reason,
        "resolved": item.resolved,
        "reviewer_id": item.reviewer_id,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "submission_id": sub.id if sub else None,
        "student_user_id": sub.user_id if sub else None
    }

def _update_submission_status(item: SMEReviewQueue, approve: bool, db: Session) -> None:
    """Update student outcome submission verification status."""
    sub = db.query(OutcomeSubmission).filter(
        OutcomeSubmission.exam_type == item.exam_type,
        OutcomeSubmission.college_code == item.college_code,
        OutcomeSubmission.branch_code == item.branch_code,
        OutcomeSubmission.category == item.category,
        OutcomeSubmission.quota == item.quota,
        OutcomeSubmission.student_rank == item.opening_rank
    ).first()

    if sub:
        sub.sme_verified = approve
        if approve:
            sub.data_confidence = "HIGH"
        db.add(sub)

def _upsert_exam_cutoff(item: SMEReviewQueue, approve: bool, db: Session) -> None:
    """Insert or update official historic cutoff values if verified by SME."""
    if not approve:
        return
        
    cutoff = db.query(ExamCutoff).filter(
        ExamCutoff.exam_type == item.exam_type,
        ExamCutoff.counseling_body == item.counseling_body,
        ExamCutoff.year == item.year,
        ExamCutoff.round_number == item.round_number,
        ExamCutoff.college_code == item.college_code,
        ExamCutoff.branch_code == item.branch_code,
        ExamCutoff.category == item.category,
        ExamCutoff.quota == item.quota
    ).first()

    if not cutoff:
        cutoff = ExamCutoff(
            exam_type=item.exam_type, counseling_body=item.counseling_body, year=item.year,
            round_number=item.round_number, college_code=item.college_code, branch_code=item.branch_code,
            category=item.category, quota=item.quota, opening_rank=item.opening_rank,
            closing_rank=item.closing_rank, data_confidence="HIGH", source_url=item.source_url,
            sme_verified=True, sme_reviewer_id=999
        )
    else:
        cutoff.opening_rank = min(cutoff.opening_rank or item.opening_rank, item.opening_rank)
        cutoff.closing_rank = max(cutoff.closing_rank or item.closing_rank, item.closing_rank)
        cutoff.sme_verified = True
        cutoff.sme_reviewer_id = 999
        cutoff.data_confidence = "HIGH"
        
    db.add(cutoff)

def _calculate_performance_metrics(logs: List[PredictionLog]) -> Dict[str, Any]:
    """Calculate overall and by-exam MAE metrics from prediction logs."""
    mae = sum(abs(l.predicted_closing_rank - l.actual_rank) for l in logs) / len(logs)
    w300 = sum(1 for l in logs if abs(l.predicted_closing_rank - l.actual_rank) <= 300) / len(logs)
    w500 = sum(1 for l in logs if abs(l.predicted_closing_rank - l.actual_rank) <= 500) / len(logs)
    
    by_exam = {}
    exams = set(l.exam_type for l in logs)
    for ex in exams:
        ex_logs = [l for l in logs if l.exam_type == ex]
        ex_len = len(ex_logs)
        ex_mae = sum(abs(l.predicted_closing_rank - l.actual_rank) for l in ex_logs) / ex_len
        ex_w300 = sum(1 for l in ex_logs if abs(l.predicted_closing_rank - l.actual_rank) <= 300) / ex_len
        ex_w500 = sum(1 for l in ex_logs if abs(l.predicted_closing_rank - l.actual_rank) <= 500) / ex_len
        
        by_exam[ex] = {
            "total_evaluated": ex_len,
            "mae": round(ex_mae, 2),
            "accuracy_within_300": round(ex_w300, 4),
            "accuracy_within_500": round(ex_w500, 4)
        }

    return {
        "overall": {
            "mae": round(mae, 2),
            "accuracy_within_300": round(w300, 4),
            "accuracy_within_500": round(w500, 4)
        },
        "by_exam": by_exam
    }

@router.get("/analytics/admin/queue", response_model=List[Dict[str, Any]])
def get_admin_queue(
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user: str = Depends(authenticate_admin)
) -> List[Dict[str, Any]]:
    """Get all items in the SME review queue."""
    query = db.query(SMEReviewQueue)
    if resolved is not None:
        query = query.filter(SMEReviewQueue.resolved == resolved)
    return [_map_queue_item_to_dict(item, db) for item in query.all()]

@router.post("/analytics/admin/queue/{item_id}/resolve")
def resolve_admin_queue_item(
    item_id: int,
    approve: bool = True,
    db: Session = Depends(get_db),
    admin_user: str = Depends(authenticate_admin)
) -> Dict[str, Any]:
    """Resolve an SME queue item. If approved, mark verified and insert into official cutoffs."""
    item = db.query(SMEReviewQueue).filter(SMEReviewQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")

    if item.resolved:
        raise HTTPException(status_code=400, detail="Review item already resolved")

    item.resolved = True
    item.reviewer_id = 999
    item.updated_at = datetime.utcnow()

    _update_submission_status(item, approve, db)
    _upsert_exam_cutoff(item, approve, db)

    db.commit()
    delete_cached_data("public_accuracy_metrics")
    return {"status": "success", "message": f"Queue item {item_id} resolved with approve={approve}"}

@router.get("/analytics/admin/health")
def get_admin_health(
    db: Session = Depends(get_db),
    admin_user: str = Depends(authenticate_admin)
) -> Dict[str, Any]:
    """Get system database statistics, queue counts, and health probes."""
    db_healthy = True
    try:
        db.execute(func.now())
    except Exception:
        db_healthy = False

    total_submissions = db.query(OutcomeSubmission).count()
    unresolved_sme = db.query(SMEReviewQueue).filter(SMEReviewQueue.resolved == False).count()
    resolved_sme = db.query(SMEReviewQueue).filter(SMEReviewQueue.resolved == True).count()
    anomalous_submissions = db.query(OutcomeSubmission).filter(OutcomeSubmission.is_anomalous == True).count()

    anomaly_rate = 0.0
    if total_submissions > 0:
        anomaly_rate = round(anomalous_submissions / total_submissions, 4)

    return {
        "db_connection": "healthy" if db_healthy else "unhealthy",
        "total_submissions": total_submissions,
        "anomalous_submissions": anomalous_submissions,
        "anomaly_rate": anomaly_rate,
        "queue_counts": {
            "unresolved": unresolved_sme,
            "resolved": resolved_sme,
            "total": unresolved_sme + resolved_sme
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/analytics/admin/performance")
def get_admin_performance(
    db: Session = Depends(get_db),
    admin_user: str = Depends(authenticate_admin)
) -> Dict[str, Any]:
    """Exposes internal detailed shadow testing performance metrics."""
    total_logs = db.query(PredictionLog).count()
    evaluated_logs = db.query(PredictionLog).filter(PredictionLog.actual_rank.isnot(None)).count()
    logs = db.query(PredictionLog).filter(PredictionLog.actual_rank.isnot(None)).all()
    
    if not logs:
        return {
            "total_prediction_logs": total_logs,
            "evaluated_prediction_logs": evaluated_logs,
            "overall": {"mae": None, "accuracy_within_300": None, "accuracy_within_500": None},
            "status": "Insufficient outcomes data for validation"
        }

    metrics = _calculate_performance_metrics(logs)
    return {
        "total_prediction_logs": total_logs,
        "evaluated_prediction_logs": evaluated_logs,
        "overall": metrics["overall"],
        "by_exam": metrics["by_exam"],
        "timestamp": datetime.utcnow().isoformat()
    }
