"""
Prediction Accuracy Calculation DAG — services/data/dag/prediction_accuracy_calculation.py.

Nightly Airflow DAG that evaluates prediction accuracy metrics (MAE, thresholds) 
using ground-truth outcomes submitted by students and logs. Writes to accuracy_metrics table.
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Any

try:
    from airflow import DAG  # type: ignore[import]
    from airflow.operators.python import PythonOperator
    AIRFLOW_AVAILABLE = True
except ImportError:
    AIRFLOW_AVAILABLE = False

logger = logging.getLogger("prediction_accuracy_dag")

DEFAULT_ARGS = {
    "owner": "admitos-analytics",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

def task_calculate_accuracy(**context: Any) -> str:
    """Query prediction_logs with actual outcomes, calculate stats, and write to DB."""
    from sqlalchemy.orm import Session
    from services.analytics.db import SessionLocal
    from services.analytics.models import PredictionLog, AccuracyMetric
    import redis

    db: Session = SessionLocal()
    try:
        # Get all logs with actual outcomes
        logs = db.query(PredictionLog).filter(PredictionLog.actual_rank.isnot(None)).all()
        if not logs:
            logger.info("No prediction logs with ground truth outcomes to process. Skipping calculation.")
            return "No logs"

        logger.info(f"Processing {len(logs)} prediction logs for accuracy calculation.")

        # Group logs by exam type
        exams_data: dict[str, list[PredictionLog]] = {}
        for l in logs:
            exams_data.setdefault(l.exam_type, []).append(l)

        # For each exam, compute metrics and upsert to DB
        for exam, ex_logs in exams_data.items():
            total = len(ex_logs)
            mae_sum = sum(abs(l.predicted_closing_rank - l.actual_rank) for l in ex_logs)
            w300 = sum(1 for l in ex_logs if abs(l.predicted_closing_rank - l.actual_rank) <= 300)
            w500 = sum(1 for l in ex_logs if abs(l.predicted_closing_rank - l.actual_rank) <= 500)
            w1000 = sum(1 for l in ex_logs if abs(l.predicted_closing_rank - l.actual_rank) <= 1000)

            mae = round(mae_sum / total, 2)
            acc_300 = round(w300 / total, 4)
            acc_500 = round(w500 / total, 4)
            acc_1000 = round(w1000 / total, 4)

            # Check if metric already exists
            metric = db.query(AccuracyMetric).filter(AccuracyMetric.exam_type == exam).first()
            if not metric:
                metric = AccuracyMetric(
                    exam_type=exam,
                    mae=mae,
                    accuracy_within_300=acc_300,
                    accuracy_within_500=acc_500,
                    accuracy_within_1000=acc_1000,
                    total_evaluated=total
                )
                db.add(metric)
            else:
                metric.mae = mae
                metric.accuracy_within_300=acc_300
                metric.accuracy_within_500=acc_500
                metric.accuracy_within_1000=acc_1000
                metric.total_evaluated=total
                db.add(metric)
            
            logger.info(
                f"Exam: {exam} | Total: {total} | MAE: {mae} | "
                f"300: {acc_300} | 500: {acc_500} | 1000: {acc_1000}"
            )

        db.commit()
        logger.info("Accuracy metrics updated successfully in database.")
    except Exception as e:
        logger.error(f"Error during accuracy calculation task: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

    # Step 2: Clear Redis cache for public accuracy
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        redis_client = redis.Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=2)
        redis_client.delete("public_accuracy_metrics")
        logger.info("Public accuracy metrics Redis cache cleared.")
    except Exception as re:
        logger.warning(f"Failed to clear Redis cache: {re}")

    return "Success"

if AIRFLOW_AVAILABLE:
    with DAG(
        dag_id="prediction_accuracy_calculation",
        default_args=DEFAULT_ARGS,
        description="Compute prediction accuracy statistics nightly from ground-truth outcomes",
        schedule_interval="0 2 * * *",  # Nightly at 2:00 AM
        start_date=datetime(2024, 1, 1),
        catchup=False,
        tags=["analytics", "prediction", "accuracy"],
    ) as dag:

        calculate_accuracy = PythonOperator(
            task_id="calculate_accuracy_metrics",
            python_callable=task_calculate_accuracy
        )

        calculate_accuracy
