"""
SEO static parameter generator for ADMIT OS.
Queries colleges, cutoffs, and guides to produce Next.js static params.
"""

import json
import logging
import os
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from services.prediction.database import (
    engine,
    Base,
    College,
    ExamCutoff,
    Guide,
    SessionLocal,
)

# Configure logger
logger = logging.getLogger("content_service.seo_generator")
logging.basicConfig(level=logging.INFO)

# Default guides to seed if table is empty
DEFAULT_GUIDES = [
    {
        "slug": "josaa-choice-filling-guide-2026",
        "title": "JoSAA Choice Filling Strategy Guide 2026",
        "description": "Step-by-step strategy to optimize your JEE choices.",
        "category": "engineering",
        "content": "Learn how to build your choice-filling list. Balance reaches and safeties.",
    },
    {
        "slug": "neet-counseling-checklist-2026",
        "title": "NEET UG Counseling Checklist & Guidelines 2026",
        "description": "Essential documents and timelines for NEET admissions.",
        "category": "medical",
        "content": "A complete list of documents required for MCC reporting.",
    },
    {
        "slug": "mht-cet-choice-filling-tips",
        "title": "MHT-CET Counseling: Avoid These Common Mistakes",
        "description": "Mistakes to avoid when selecting colleges in DTE Maharashtra.",
        "category": "engineering",
        "content": "Tips on TFWS schemes, round-wise upgrades, and state seat matrix rules.",
    },
    {
        "slug": "bitsat-counseling-procedure",
        "title": "BITSAT 2026 Iterations & Counseling Overview",
        "description": "Understand BITS iterations, waitlist rules, and fee refunds.",
        "category": "engineering",
        "content": "A detailed look at Pilani, Goa, and Hyderabad campus iteration schemes.",
    },
    {
        "slug": "kcet-document-verification-guide",
        "title": "KCET Document Verification & Eligibility Clauses",
        "description": "A comprehensive guide on clauses A through O in KCET.",
        "category": "engineering",
        "content": "Important checklist for Karnataka examinations authority counseling.",
    },
]


def init_seo_database() -> None:
    """Ensure database tables, including the guides table, exist and are seeded."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schemas verified.")
        db: Session = SessionLocal()
        try:
            seed_guides(db)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)


def seed_guides(db: Session) -> None:
    """Seed the default guides if the guides table is empty."""
    try:
        count = db.query(Guide).count()
        if count == 0:
            for g in DEFAULT_GUIDES:
                db_guide = Guide(**g)
                db.add(db_guide)
            db.commit()
            logger.info("Default guides seeded successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed guides: {e}", exc_info=True)


def get_max_colleges() -> int:
    """Retrieve maximum colleges limit from environment variables."""
    try:
        return int(os.getenv("MAX_SEO_COLLEGES", "30"))
    except ValueError:
        logger.warning("Invalid MAX_SEO_COLLEGES value. Defaulting to 30.")
        return 30


def query_colleges(db: Session, limit: int) -> List[str]:
    """Retrieve top N college codes based on database records."""
    try:
        colleges = (
            db.query(College.college_code)
            .order_by(
                College.nirf_rank_engineering.asc().nullslast(),
                College.college_code.asc(),
            )
            .limit(limit)
            .all()
        )
        return [c[0] for c in colleges]
    except Exception as e:
        logger.error(f"Failed to query colleges: {e}", exc_info=True)
        return []


def query_top_branches_and_categories(db: Session) -> Tuple[List[str], List[str]]:
    """Retrieve top 5 branches and top 3 categories by frequency in cutoffs."""
    try:
        branch_query = (
            db.query(ExamCutoff.branch_code, func.count(ExamCutoff.id))
            .group_by(ExamCutoff.branch_code)
            .order_by(func.count(ExamCutoff.id).desc())
            .limit(5)
            .all()
        )
        branches = [b[0] for b in branch_query]

        cat_query = (
            db.query(ExamCutoff.category, func.count(ExamCutoff.id))
            .group_by(ExamCutoff.category)
            .order_by(func.count(ExamCutoff.id).desc())
            .limit(3)
            .all()
        )
        categories = [c[0] for c in cat_query]

        # Fallbacks if database is empty/sparse
        if not branches:
            branches = ["CS", "EC", "ME", "EE", "CE"]
        if not categories:
            categories = ["GENERAL", "OBC_NCL", "SC"]

        return branches, categories
    except Exception as e:
        logger.error(f"Failed to query branches and categories: {e}", exc_info=True)
        return ["CS", "EC", "ME", "EE", "CE"], ["GENERAL", "OBC_NCL", "SC"]


def query_cutoffs(
    db: Session, colleges: List[str], branches: List[str], categories: List[str]
) -> List[Dict[str, str]]:
    """Query combinations of cutoffs that exist in the database."""
    try:
        cutoffs = (
            db.query(
                ExamCutoff.college_code, ExamCutoff.branch_code, ExamCutoff.category
            )
            .filter(
                ExamCutoff.college_code.in_(colleges),
                ExamCutoff.branch_code.in_(branches),
                ExamCutoff.category.in_(categories),
            )
            .distinct()
            .all()
        )

        # Fallback to Cartesian product if no records are found in test db
        if not cutoffs:
            return [
                {"college": col, "branch": br, "category": cat}
                for col in colleges
                for br in branches
                for cat in categories
            ]

        return [{"college": c[0], "branch": c[1], "category": c[2]} for c in cutoffs]
    except Exception as e:
        logger.error(f"Failed to query cutoffs: {e}", exc_info=True)
        return []


def query_guides(db: Session) -> List[str]:
    """Retrieve slugs for all articles in the guides database."""
    try:
        guides = db.query(Guide.slug).all()
        return [g[0] for g in guides]
    except Exception as e:
        logger.error(f"Failed to query guides: {e}", exc_info=True)
        return []


def write_json_output(filepath: str, data: Any) -> None:
    """Safely write data to a JSON file, creating parent directories if needed."""
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Successfully generated: {filepath}")
    except Exception as e:
        logger.error(f"Failed to write output to {filepath}: {e}", exc_info=True)


def generate_seo_params() -> Tuple[int, int, int]:
    """Main orchestration function to run the SEO params generation."""
    init_seo_database()
    max_colleges = get_max_colleges()

    db: Session = SessionLocal()
    try:
        colleges = query_colleges(db, max_colleges)
        branches, categories = query_top_branches_and_categories(db)
        cutoffs = query_cutoffs(db, colleges, branches, categories)
        guides = query_guides(db)
    finally:
        db.close()

    out_dir = os.path.join("frontend", "web", "src", "lib", "seo_data")

    college_params = [{"code": code} for code in colleges]
    guide_params = [{"slug": slug} for slug in guides]

    write_json_output(os.path.join(out_dir, "colleges.json"), college_params)
    write_json_output(os.path.join(out_dir, "cutoffs.json"), cutoffs)
    write_json_output(os.path.join(out_dir, "guides.json"), guide_params)

    return len(college_params), len(cutoffs), len(guide_params)


if __name__ == "__main__":
    c_len, cut_len, g_len = generate_seo_params()
    print(f"Generated params: {c_len} colleges, {cut_len} cutoffs, {g_len} guides.")
