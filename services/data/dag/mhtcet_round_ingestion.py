"""MHT-CET Round Ingestion DAG — services/data/dag/mhtcet_round_ingestion.py.

Airflow DAG that crawls DTE Maharashtra CET portal, extracts cutoff tables,
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

logger = logging.getLogger("mhtcet_ingestion_dag")

MHTCET_URLS = [
    "https://cetcell.mahacet.org/admission/counselling-results",
    "https://cetcell.mahacet.org/admission/seat-matrix",
]

DEFAULT_ARGS = {
    "owner": "admitos-data",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
}


def task_crawl_mhtcet(**context: Any) -> str:
    """Task 1: Crawl DTE Maharashtra portal for new documents."""
    from services.data.crawler.web_crawler import WebCrawlerAgent
    agent = WebCrawlerAgent("mhtcet-dag-crawler")
    results = []
    for url in MHTCET_URLS:
        new_hash = agent.check_and_process_page(url, "MHT_CET")
        if new_hash:
            results.append({"url": url, "hash": new_hash})
            logger.info(f"Detected change at: {url}")
    return str(results)


def task_fetch_mhtcet_pdfs(**context: Any) -> str:
    """Task 2: Download MHT-CET cutoff PDFs from portal."""
    import httpx
    import glob

    out_dir = "/tmp/mhtcet_pdfs"
    os.makedirs(out_dir, exist_ok=True)
    downloaded = []
    for url in MHTCET_URLS:
        try:
            with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                resp = client.get(url)
                if resp.status_code == 200 and "pdf" in resp.headers.get("content-type", ""):
                    fname = os.path.join(out_dir, os.path.basename(url) + ".pdf")
                    with open(fname, "wb") as f:
                        f.write(resp.content)
                    downloaded.append(fname)
                    logger.info(f"Downloaded MHT-CET PDF: {fname}")
        except Exception as e:
            logger.warning(f"Failed to download {url}: {e}")
    return str(downloaded)


def task_extract_mhtcet_tables(**context: Any) -> str:
    """Task 3: Extract rank tables using adaptive PDF extractor."""
    from services.data.extractors.pdf_extractor import PDFExtractor
    import glob
    import json

    extractor = PDFExtractor()
    records = []
    for pdf in glob.glob("/tmp/mhtcet_pdfs/*.pdf"):
        recs = extractor.extract(pdf)
        records.extend(recs)
        logger.info(f"Extracted {len(recs)} records from {pdf}")

    out_path = "/tmp/mhtcet_extracted.json"
    with open(out_path, "w") as f:
        json.dump(records, f)
    return out_path


def task_load_mhtcet_to_db(**context: Any) -> None:
    """Task 4: Upsert validated records into PostgreSQL exam_cutoffs table."""
    import json
    from sqlalchemy.orm import Session
    from services.prediction.database import SessionLocal, ExamCutoff, init_db

    init_db()
    with open("/tmp/mhtcet_extracted.json") as f:
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
                exam_type="MHT_CET",
                counseling_body="DTE_MH",
                year=datetime.utcnow().year,
                round_number=1,
                college_code=r.get("college_code", "UNKNOWN")[:20],
                branch_code=r.get("branch_code", "CS")[:10],
                category=r.get("category", "OPEN")[:15],
                quota=r.get("quota", "STATE")[:10],
                opening_rank=opening,
                closing_rank=closing,
                data_confidence="MEDIUM",
                source_url="https://cetcell.mahacet.org",
            )
            db.merge(cutoff)
            loaded += 1
        db.commit()
        logger.info(f"Loaded {loaded} MHT-CET records into DB")
    finally:
        db.close()


def task_publish_mhtcet_kafka(**context: Any) -> None:
    """Task 5: Publish ValidatedGroundTruth event to Kafka."""
    from services.data.crawler.web_crawler import WebCrawlerAgent
    agent = WebCrawlerAgent("mhtcet-dag-publisher")
    agent.publish_to_kafka("data.validated.ground_truth", {
        "exam_type": "MHT_CET",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "status": "completed",
    })


if AIRFLOW_AVAILABLE:
    with DAG(
        dag_id="mhtcet_round_ingestion",
        default_args=DEFAULT_ARGS,
        description="MHT-CET DTE Maharashtra cutoff ingestion pipeline",
        schedule_interval="0 7 * * *",
        start_date=datetime(2024, 1, 1),
        catchup=False,
        tags=["mhtcet", "ingestion", "cutoff"],
    ) as dag:

        crawl = PythonOperator(task_id="crawl_mhtcet_portal", python_callable=task_crawl_mhtcet)
        fetch = PythonOperator(task_id="fetch_mhtcet_pdfs", python_callable=task_fetch_mhtcet_pdfs)
        extract = PythonOperator(task_id="extract_tables", python_callable=task_extract_mhtcet_tables)
        load = PythonOperator(task_id="load_to_db", python_callable=task_load_mhtcet_to_db)
        publish = PythonOperator(task_id="publish_kafka", python_callable=task_publish_mhtcet_kafka)

        crawl >> fetch >> extract >> load >> publish
