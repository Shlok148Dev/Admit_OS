import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from services.career.db import Base, engine, get_db, get_neo4j_session, close_neo4j_driver, SessionLocal
from services.career.cache import get_cached, set_cached
from services.career.schemas import (
    CareerPathsRequest, CareerPathsResponse, BranchOverviewResponse,
    BranchCompareResponse, ScholarshipResponse
)
from services.career.graph_service import build_branch_overview, get_career_paths
from services.career.scholarship_service import find_scholarships
from services.career.seed import seed_all

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("career_service.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Created PostgreSQL tables.")
    except Exception as e:
        logger.error(f"SQL init failed: {e}", exc_info=True)

    try:
        with SessionLocal() as db_session:
            with next(get_neo4j_session()) as neo4j_sess:
                seed_all(db_session, neo4j_sess)
        logger.info("Successfully seeded data on startup.")
    except Exception as e:
        logger.error(f"Seeding failed on startup: {e}", exc_info=True)
        
    yield
    close_neo4j_driver()

app = FastAPI(
    title="ADMIT OS Career Service",
    description="Branch vs Brand decision tool & Scholarship finder.",
    version="1.0.0",
    lifespan=lifespan
)

@app.post("/v1/career/paths", response_model=CareerPathsResponse)
def get_paths(req: CareerPathsRequest) -> CareerPathsResponse:
    try:
        with next(get_neo4j_session()) as session:
            paths = get_career_paths(session, req.branch_code.upper(), req.college_code)
            if not paths:
                raise HTTPException(status_code=404, detail=f"Branch code {req.branch_code} not found")
            return CareerPathsResponse(**paths)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching paths: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/v1/career/branch/{code}", response_model=BranchOverviewResponse)
def get_branch(code: str) -> BranchOverviewResponse:
    try:
        with next(get_neo4j_session()) as session:
            overview = build_branch_overview(session, code.upper())
            if not overview:
                raise HTTPException(status_code=404, detail=f"Branch code {code} not found")
            return overview
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching branch {code}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/v1/career/compare", response_model=BranchCompareResponse)
def compare_branches(
    b1: str = Query(..., description="First branch code"),
    b2: str = Query(..., description="Second branch code")
) -> BranchCompareResponse:
    b1_key = b1.upper()
    b2_key = b2.upper()
    cache_key = f"branch_compare:{b1_key}:{b2_key}"
    cached = get_cached(cache_key)
    if cached:
        return BranchCompareResponse(**cached)

    try:
        with next(get_neo4j_session()) as session:
            overview1 = build_branch_overview(session, b1_key)
            overview2 = build_branch_overview(session, b2_key)
            if not overview1 or not overview2:
                raise HTTPException(status_code=404, detail="One or both branch codes not found")
            res = BranchCompareResponse(b1=overview1, b2=overview2)
            set_cached(cache_key, res.model_dump(), ttl=86400) # 24 hours TTL
            return res
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing branches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/v1/career/scholarships", response_model=List[ScholarshipResponse])
def get_scholarships(
    category: Optional[str] = None,
    state: Optional[str] = None,
    gender: Optional[str] = None,
    income: Optional[float] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> List[ScholarshipResponse]:
    try:
        scholarships = find_scholarships(
            db, category=category, state=state, gender=gender,
            income=income, limit=limit, offset=offset
        )
        return [ScholarshipResponse.model_validate(s) for s in scholarships]
    except Exception as e:
        logger.error(f"Error fetching scholarships: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "healthy"}
