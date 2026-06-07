"""NEET Round Ingestion DAG — services/data/dag/neet_round_ingestion.py.

Airflow DAG that crawls MCC NEET portal, extracts cutoff tables from PDFs,
validates, loads into PostgreSQL, and publishes to Kafka.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any

try:
    from airflow import DAG  # type: ignore[import]
    from airflow.operators.python import PythonOperator
    AIRFLOW_AVAILABLE = True
except ImportError:
    AIRFLOW_AVAILABLE = False

import logging

logger = logging.getLogger("neet_ingestion_dag")

NEET_PDF_URLS = [
    "https://mcc.nic.in/UGCounselling/Meritalongwithdetails.aspx",
    "https://mcc.nic.in/UGCounselling/counselling_results.aspx",
]

DEFAULT_ARGS = {
    "owner": "admitos-data",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
}


def task_fetch_neet_pdfs(**context: Any) -> str:
    """Task 1: Download NEET cutoff PDFs from MCC portal."""
    import tempfile
    import os
    import httpx

    out_dir = os.path.join("/tmp", "neet_pdfs")
    os.makedirs(out_dir, exist_ok=True)
    downloaded = []
    for url in NEET_PDF_URLS:
        try:
            with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                resp = client.get(url)
                if resp.status_code == 200 and "pdf" in resp.headers.get("content-type", ""):
                    fname = os.path.join(out_dir, os.path.basename(url) + ".pdf")
                    with open(fname, "wb") as f:
                        f.write(resp.content)
                    downloaded.append(fname)
                    logger.info(f"Downloaded NEET PDF: {fname}")
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
    return str(downloaded)


def task_extract_tables(**context: Any) -> str:
    """Task 2: Extract rank tables from downloaded PDFs."""
    from services.data.extractors.pdf_extractor import PDFExtractor
    import glob
    import json

    extractor = PDFExtractor()
    out_dir = "/tmp/neet_pdfs"
    records = []
    for pdf in glob.glob(f"{out_dir}/*.pdf"):
        recs = extractor.extract(pdf)
        records.extend(recs)
        logger.info(f"Extracted {len(recs)} records from {pdf}")

    out_path = "/tmp/neet_extracted.json"
    with open(out_path, "w") as f:
        json.dump(records, f)
    return out_path


def task_validate_records(**context: Any) -> None:
    """Task 3: Validate extracted rows against schema constraints."""
    import json

    with open("/tmp/neet_extracted.json") as f:
        records = json.load(f)

    valid = []
    for r in records:
        opening = r.get("opening_rank") or 0
        closing = r.get("closing_rank") or 0
        if opening > 0 and closing >= opening:
            valid.append(r)
        else:
            logger.warning(f"Invalid record skipped: {r}")
    logger.info(f"Validation: {len(valid)}/{len(records)} records are valid")


def task_load_to_db(**context: Any) -> None:
    """Task 4: Upsert validated records into PostgreSQL exam_cutoffs table."""
    import json
    from sqlalchemy.orm import Session
    from services.prediction.database import SessionLocal, ExamCutoff, init_db

    init_db()
    with open("/tmp/neet_extracted.json") as f:
        records = json.load(f)

    db: Session = SessionLocal()
    try:
        loaded = 0
        for r in records:
            opening = r.get("opening_rank") or 0
            closing = r.get("closing_rank") or 0
            if not (opening > 0 and closing >= opening):
                continue
            cutoff = ExamCutoff(
                exam_type="NEET",
                counseling_body="MCC",
                year=datetime.utcnow().year,
                round_number=1,
                college_code=r.get("college_code", "UNKNOWN")[:20],
                branch_code=r.get("branch_code", "MBBS")[:10],
                category=r.get("category", "OPEN")[:15],
                quota=r.get("quota", "AIQ")[:10],
                opening_rank=opening,
                closing_rank=closing,
                data_confidence="MEDIUM",
                source_url="https://mcc.nic.in",
            )
            db.merge(cutoff)
            loaded += 1
        db.commit()
        logger.info(f"Loaded {loaded} NEET records into DB")
    finally:
        db.close()


def task_publish_kafka(**context: Any) -> None:
    """Task 5: Publish ValidatedGroundTruth event to Kafka."""
    from services.data.crawler.web_crawler import WebCrawlerAgent
    agent = WebCrawlerAgent("neet-dag-publisher")
    agent.publish_to_kafka("data.validated.ground_truth", {
        "exam_type": "NEET",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "status": "completed",
    })


if AIRFLOW_AVAILABLE:
    with DAG(
        dag_id="neet_round_ingestion",
        default_args=DEFAULT_ARGS,
        description="NEET MCC cutoff ingestion pipeline",
        schedule_interval="0 6 * * *",
        start_date=datetime(2024, 1, 1),
        catchup=False,
        tags=["neet", "ingestion", "cutoff"],
    ) as dag:

        fetch = PythonOperator(task_id="fetch_neet_pdfs", python_callable=task_fetch_neet_pdfs)
        extract = PythonOperator(task_id="extract_tables", python_callable=task_extract_tables)
        validate = PythonOperator(task_id="validate_records", python_callable=task_validate_records)
        load = PythonOperator(task_id="load_to_db", python_callable=task_load_to_db)
        publish = PythonOperator(task_id="publish_kafka", python_callable=task_publish_kafka)

        fetch >> extract >> validate >> load >> publish
