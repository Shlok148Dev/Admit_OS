"""
Lifecycle script to promote models to Production based on shadow tests and accuracy gating.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Any

import mlflow
from mlflow.tracking import MlflowClient
from sqlalchemy.orm import Session

from services.prediction.database import SessionLocal, init_db, ExamCutoff, PredictionLog

logger: logging.Logger = logging.getLogger("prediction_service.lifecycle")
logging.basicConfig(level=logging.INFO)


def get_latest_candidate_version(client: MlflowClient, model_name: str) -> Optional[Any]:
    """Retrieve the latest version of a model in 'None' or 'Staging' stages."""
    try:
        versions = client.get_latest_versions(model_name, stages=["None", "Staging"])
        if versions:
            return versions[0]
    except Exception as e:
        logger.warning(f"No versions found or error retrieving model versions for {model_name}: {e}")
    return None


def get_actual_cutoff(
    db: Session, exam_type: str, college_code: str, branch_code: str, category: str, quota: str
) -> Optional[int]:
    """Retrieve actual 2024 closing rank from database for shadow validation."""
    res = db.query(ExamCutoff).filter(
        ExamCutoff.exam_type == exam_type,
        ExamCutoff.college_code == college_code,
        ExamCutoff.branch_code == branch_code,
        ExamCutoff.category == category,
        ExamCutoff.quota == quota,
        ExamCutoff.year == 2024
    ).first()
    return res.closing_rank if res else None


def get_shadow_logs(db: Session, exam_type: str) -> List[PredictionLog]:
    """Retrieve last 30 days logs or generate mock logs using 2024 data if insufficient."""
    cutoff_date = datetime.utcnow() - timedelta(days=30)
    logs = db.query(PredictionLog).filter(
        PredictionLog.exam_type == exam_type,
        PredictionLog.created_at >= cutoff_date
    ).all()

    if len(logs) >= 5:
        return logs

    logger.info(f"Fewer than 5 logs for {exam_type}. Generating mock logs from 2024 cutoffs.")
    cutoffs = db.query(ExamCutoff).filter(
        ExamCutoff.exam_type == exam_type,
        ExamCutoff.year == 2024
    ).limit(50).all()

    mock_logs = []
    for c in cutoffs:
        mock_logs.append(PredictionLog(
            exam_type=exam_type, college_code=c.college_code, branch_code=c.branch_code,
            category=c.category, quota=c.quota, gender="M", rank=c.closing_rank,
            predicted_closing_rank=c.closing_rank, admission_probability=1.0,
            created_at=datetime.utcnow()
        ))
    return mock_logs


def evaluate_on_logs(db: Session, logs: List[PredictionLog], model: Any, exam_type: str) -> float:
    """Evaluate candidate model on prediction logs, calculating within_500 accuracy."""
    from services.prediction.main import get_lags_for_prediction

    if hasattr(model, "unwrap"):
        predictor = model.unwrap()
    elif hasattr(model, "_model_impl") and hasattr(model._model_impl, "python_model"):
        predictor = model._model_impl.python_model
    else:
        predictor = model

    correct = 0
    for log in logs:
        lag_1, lag_2 = get_lags_for_prediction(
            db, log.college_code, log.branch_code, log.category, log.quota, exam_type
        )
        actual = get_actual_cutoff(db, exam_type, log.college_code, log.branch_code, log.category, log.quota)
        if actual is None:
            actual = log.rank
        try:
            pred_val, _ = predictor.predict_one(
                log.college_code, log.branch_code, log.category, log.quota, log.gender, lag_1, lag_2
            )
            if abs(pred_val - actual) <= 500:
                correct += 1
        except Exception as e:
            logger.warning(f"Prediction failed for log {log.id}: {e}")

    return correct / len(logs) if logs else 0.0


def promote_model_version(client: MlflowClient, model_name: str, version: str) -> None:
    """Transition model stage to Production and archive old models."""
    client.transition_model_version_stage(
        name=model_name,
        version=version,
        stage="Production",
        archive_existing_versions=True
    )


def process_exam_promotion(db: Session, client: MlflowClient, exam_type: str) -> None:
    """Load candidate version, run shadow evaluation, and promote if gating threshold is met."""
    model_name = f"cutoff_{exam_type}"
    ver = get_latest_candidate_version(client, model_name)
    if not ver:
        logger.info(f"No candidate version found to validate for {model_name}.")
        return

    model_uri = f"models:/{model_name}/{ver.version}"
    logger.info(f"Loading candidate model from {model_uri}...")
    model = mlflow.pyfunc.load_model(model_uri)

    logs = get_shadow_logs(db, exam_type)
    accuracy = evaluate_on_logs(db, logs, model, exam_type)

    threshold = 0.80 if "JEE" in exam_type else 0.75
    logger.info(f"{model_name} v{ver.version} shadow test accuracy: {accuracy:.4f} (Required: {threshold})")

    if accuracy >= threshold:
        promote_model_version(client, model_name, ver.version)
        logger.info(f"Successfully promoted {model_name} version {ver.version} to Production.")
    else:
        logger.warning(f"{model_name} version {ver.version} did not meet gating criteria.")


def main() -> None:
    """Orchestrate promotion across JEE_MAIN, NEET, and MHT_CET models."""
    init_db()
    db = SessionLocal()
    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db"))
    client = MlflowClient()

    try:
        exams = ["JEE_MAIN", "NEET", "MHT_CET"]
        for exam in exams:
            logger.info(f"Processing promotion for {exam}...")
            process_exam_promotion(db, client, exam)
    finally:
        db.close()


if __name__ == "__main__":
    main()
