"""
Main FastAPI application file for prediction-service.
"""

import os
import hashlib
import json
import logging
import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from fastapi import FastAPI, Depends, Request
from sqlalchemy.orm import Session

from .schemas import (
    ExamEnum, CategoryEnum, GenderEnum, PredictionFilters, CollegePredictionRequest,
    ConfidenceInterval, CollegePrediction, PredictionMetadata, CollegePredictionResponse,
    SMEReviewQueueItem, CollegeProfileSchema
)
from .database import init_db, get_db, ExamCutoff, College, SMEReviewQueue, PredictionLog
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import HTTPException, status
import secrets
from .model import (
    CutoffPredictor, generate_synthetic_cutoffs, compute_bootstrap_intervals,
    get_cutoff_rank, COLLEGE_MAP, BRANCH_MAP
)
from .cache import (
    get_cached_prediction, set_cached_prediction,
    is_redis_healthy, get_redis_latency, get_cached_wrapped
)

logger: logging.Logger = logging.getLogger("prediction_service.main")

degraded_mode: bool = False
_total_requests: int = 0
_cache_hits: int = 0
_latencies: List[float] = []
MAX_CONCURRENT_UNCACHED: int = 5
_current_uncached_queries: int = 0
_uncached_lock = threading.Lock()

app = FastAPI(
    title="College Cutoff Prediction Service",
    description="Microservice for predicting college cutoffs.",
    version="1.0.0"
)

@app.middleware("http")
async def track_metrics_middleware(request: Request, call_next):
    global _total_requests, _cache_hits, _latencies
    is_health = request.url.path.endswith("/health") or request.url.path.endswith("/health/detailed")
    start_time = time.time()
    
    request.state.is_cached = False
    
    response = await call_next(request)
    
    if not is_health:
        duration = (time.time() - start_time) * 1000.0
        _total_requests += 1
        if getattr(request.state, "is_cached", False):
            _cache_hits += 1
        _latencies.append(duration)
        if len(_latencies) > 1000:
            _latencies.pop(0)
            
    return response

predictors: Dict[str, CutoffPredictor] = {}

COLLEGES_DATA: List[Dict[str, Any]] = [
    {"college_code": "IIT_BOMBAY", "name": "IIT Bombay", "type": "IIT", "state": "MH", "city": "Mumbai", "nirf_rank_engineering": 3, "established_year": 1958},
    {"college_code": "IIT_DELHI", "name": "IIT Delhi", "type": "IIT", "state": "DL", "city": "New Delhi", "nirf_rank_engineering": 2, "established_year": 1961},
    {"college_code": "IIT_MADRAS", "name": "IIT Madras", "type": "IIT", "state": "TN", "city": "Chennai", "nirf_rank_engineering": 1, "established_year": 1959},
    {"college_code": "NIT_TRICHY", "name": "NIT Tiruchirappalli", "type": "NIT", "state": "TN", "city": "Trichy", "nirf_rank_engineering": 8, "established_year": 1964},
    {"college_code": "NIT_SURATHKAL", "name": "NIT Surathkal", "type": "NIT", "state": "KA", "city": "Mangalore", "nirf_rank_engineering": 12, "established_year": 1960},
    {"college_code": "IIIT_ALLAHABAD", "name": "IIIT Allahabad", "type": "IIIT", "state": "UP", "city": "Allahabad", "nirf_rank_engineering": 25, "established_year": 1999},
    {"college_code": "IIIT_DELHI", "name": "IIIT Delhi", "type": "IIIT", "state": "DL", "city": "New Delhi", "nirf_rank_engineering": 35, "established_year": 2008},
    {"college_code": "COEP_PUNE", "name": "COEP Pune", "type": "STATE", "state": "MH", "city": "Pune", "nirf_rank_engineering": 73, "established_year": 1854},
    {"college_code": "VJTI_MUMBAI", "name": "VJTI Mumbai", "type": "STATE", "state": "MH", "city": "Mumbai", "nirf_rank_engineering": 82, "established_year": 1887},
    {"college_code": "ICT_MUMBAI", "name": "ICT Mumbai", "type": "STATE", "state": "MH", "city": "Mumbai", "nirf_rank_engineering": 95, "established_year": 1933}
]

def populate_synthetic_data(db: Session) -> None:
    """Populate database with synthetic colleges and cutoffs for JEE, NEET and MHT-CET."""
    for c in COLLEGES_DATA:
        if not db.query(College).filter(College.college_code == c["college_code"]).first():
            db.add(College(**c))
    
    # 1. JEE_MAIN
    df = generate_synthetic_cutoffs()
    df_m = df[df["gender"] == "M"]
    for _, row in df_m.iterrows():
        cbody = "JOSAA" if row["college_code"].startswith(("IIT", "NIT", "IIIT")) else "DTE_MH"
        db.add(ExamCutoff(
            exam_type="JEE_MAIN", counseling_body=cbody, year=row["year"], round_number=6,
            college_code=row["college_code"], branch_code=row["branch_code"],
            category=row["category"], quota=row["quota"], opening_rank=row["opening_rank"],
            closing_rank=row["closing_rank"], data_confidence="HIGH",
            source_url=f"https://josaa.admissions.nic.in/cutoffs/{row['college_code']}.pdf"
        ))

    # 2. NEET (Medical)
    neet_colleges = [
        {"college_code": "AIIMS_DELHI", "name": "AIIMS Delhi", "type": "DEEMED", "state": "DL", "city": "New Delhi", "nirf_rank_engineering": None, "established_year": 1956},
        {"college_code": "MAMC_DELHI", "name": "MAMC Delhi", "type": "STATE", "state": "DL", "city": "New Delhi", "nirf_rank_engineering": None, "established_year": 1959}
    ]
    for c in neet_colleges:
        if not db.query(College).filter(College.college_code == c["college_code"]).first():
            db.add(College(**c))
            
    for yr in [2020, 2021, 2022, 2023, 2024]:
        for br in ["MBBS", "BDS"]:
            for cat in ["GENERAL", "EWS", "OBC", "SC", "ST"]:
                cl_rank = 150 if br == "MBBS" else 6000
                if cat == "SC": cl_rank *= 4
                db.add(ExamCutoff(
                    exam_type="NEET", counseling_body="MCC", year=yr, round_number=1,
                    college_code="AIIMS_DELHI", branch_code=br, category=cat, quota="AIQ",
                    opening_rank=int(cl_rank * 0.8), closing_rank=cl_rank, data_confidence="HIGH",
                    source_url="https://mcc.nic.in"
                ))

    # 3. MHT_CET (Maharashtra Engineering)
    for yr in [2021, 2022, 2023, 2024]:
        for br in ["CS", "EC", "ME"]:
            for cat in ["GOPENS", "EWS", "GSCS", "LOBCS"]:
                cl_rank = 250 if br == "CS" else 1800
                if cat == "GSCS": cl_rank *= 3
                db.add(ExamCutoff(
                    exam_type="MHT_CET", counseling_body="DTE_MH", year=yr, round_number=1,
                    college_code="COEP_PUNE", branch_code=br, category=cat, quota="MS",
                    opening_rank=int(cl_rank * 0.8), closing_rank=cl_rank, data_confidence="HIGH",
                    source_url="https://mahacet.org"
                ))
    db.commit()

def load_production_models() -> None:
    """Load production models from MLflow model registry for active exams."""
    import mlflow
    from mlflow.tracking import MlflowClient
    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db"))
    client = MlflowClient()
    
    for exam in ["JEE_MAIN", "NEET", "MHT_CET"]:
        model_name = f"cutoff_{exam}"
        try:
            versions = client.get_latest_versions(model_name, stages=["Production"])
            if not versions:
                continue
            model_uri = f"models:/{model_name}/Production"
            loaded = mlflow.pyfunc.load_model(model_uri)
            if hasattr(loaded, "unwrap"):
                predictors[exam] = loaded.unwrap()
            elif hasattr(loaded, "_model_impl") and hasattr(loaded._model_impl, "python_model"):
                predictors[exam] = loaded._model_impl.python_model
            else:
                predictors[exam] = loaded
        except Exception as e:
            logger.error(f"Failed to load Production model for {exam}: {e}")

@app.on_event("startup")
def startup_event() -> None:
    """Startup event handler to initialize database and load models."""
    try:
        init_db()
        db = next(get_db())
        if db.query(ExamCutoff).count() == 0:
            populate_synthetic_data(db)
        load_production_models()
        if not predictors:
            logger.info("No production models. Running initial training/lifecycle...")
            from .training.train_per_exam import main as run_training
            from .training.mlflow_lifecycle import main as run_lifecycle
            run_training()
            run_lifecycle()
            load_production_models()
        
        # Start cache warmer in a background thread to prevent blocking startup probes
        try:
            import threading
            from .cache_warmer import warm_cache
            threading.Thread(target=warm_cache, daemon=True).start()
            logger.info("Asynchronously started cache warmer.")
        except Exception as cache_ex:
            logger.error(f"Failed to start cache warmer thread: {cache_ex}")
            
    except Exception as e:
        logger.critical(f"Startup initialization failed: {e}", exc_info=True)

def generate_cache_key(request: CollegePredictionRequest) -> str:
    """Generate cache key including exam, rank, category, home_state, gender, branch_filter_hash."""
    branches = request.filters.branches if (request.filters and request.filters.branches) else []
    sorted_branches = sorted(branches)
    branch_filter_hash = hashlib.sha256(",".join(sorted_branches).encode('utf-8')).hexdigest()[:12]
    return f"predict:college:{request.exam.value}:{request.rank}:{request.category.value}:{request.home_state}:{request.gender.value}:{branch_filter_hash}"

def get_college_fees(college_code: str) -> int:
    """Retrieve typical yearly fees for a college."""
    fees = {
        "IIT_BOMBAY": 220000, "IIT_DELHI": 225000, "IIT_MADRAS": 210000,
        "NIT_TRICHY": 147150, "NIT_SURATHKAL": 150000, "IIIT_ALLAHABAD": 180000,
        "IIIT_DELHI": 350000, "COEP_PUNE": 135000, "VJTI_MUMBAI": 85000,
        "ICT_MUMBAI": 90000
    }
    return fees.get(college_code, 150000)

def get_db_cutoff(
    db: Session, col_code: str, br_code: str, cat: str, quota: str, year: int, exam_type: str = "JEE_MAIN"
) -> Optional[float]:
    """Retrieve a single closing rank from database."""
    res = db.query(ExamCutoff).filter(
        ExamCutoff.college_code == col_code, ExamCutoff.branch_code == br_code,
        ExamCutoff.category == cat, ExamCutoff.quota == quota, ExamCutoff.year == year,
        ExamCutoff.exam_type == exam_type
    ).first()
    return float(res.closing_rank) if res else None

def get_historical_ranks(
    db: Session, col_code: str, br_code: str, cat: str, quota: str, exam_type: str = "JEE_MAIN"
) -> Dict[str, int]:
    """Retrieve historical closing ranks for the last 5 years."""
    res = db.query(ExamCutoff).filter(
        ExamCutoff.college_code == col_code, ExamCutoff.branch_code == br_code,
        ExamCutoff.category == cat, ExamCutoff.quota == quota,
        ExamCutoff.exam_type == exam_type
    ).all()
    return {str(c.year): c.closing_rank for c in sorted(res, key=lambda x: x.year)}

def compute_trend(historical_ranks: Dict[str, int]) -> str:
    """Determine rank trend direction."""
    years = sorted([int(y) for y in historical_ranks.keys()])
    if len(years) < 2:
        return "STABLE"
    val_recent = historical_ranks[str(years[-1])]
    val_prev = historical_ranks[str(years[-2])]
    diff = val_recent - val_prev
    if diff > 50:
        return "RISING"
    elif diff < -50:
        return "FALLING"
    return "STABLE"

def matches_filters(
    col: College, branch_code: str, request: CollegePredictionRequest
) -> bool:
    """Check if college and branch match the requested filters."""
    # Filter by exam compatibility
    if request.exam == ExamEnum.NEET:
        if col.type not in ("DEEMED", "MEDICAL") and col.college_code not in ("AIIMS_DELHI", "MAMC_DELHI"):
            return False
        if branch_code not in ("MBBS", "BDS"):
            return False
    elif request.exam == ExamEnum.MHT_CET:
        if col.type not in ("STATE", "PRIVATE") or col.state != "MH":
            return False
        if branch_code not in ("CS", "EC", "ME"):
            return False
    elif request.exam == ExamEnum.KCET:
        if col.type not in ("STATE", "PRIVATE") or col.state != "KA":
            return False
    elif request.exam == ExamEnum.JEE_ADVANCED:
        if col.type != "IIT":
            return False
        if branch_code not in ("CS", "EC", "ME"):
            return False
    elif request.exam == ExamEnum.JEE_MAIN:
        if col.type not in ("NIT", "IIIT", "GFTI", "STATE", "PRIVATE"):
            return False
        if col.type == "IIT":
            return False
        if branch_code not in ("CS", "EC", "ME"):
            return False

    f = request.filters
    if not f:
        return True
    if f.branches and branch_code not in f.branches:
        return False
    if f.college_types and col.type not in f.college_types:
        return False
    if f.states and col.state not in f.states:
        return False
    fees = get_college_fees(col.college_code)
    if f.max_fees_per_year and fees > f.max_fees_per_year:
        return False
    return True

def get_lags_for_prediction(
    db: Session, college: str, branch: str, category: str, quota: str, exam_type: str = "JEE_MAIN"
) -> Tuple[float, float]:
    """Retrieve lags from DB or fall back to synthetic calculations."""
    lag_1 = get_db_cutoff(db, college, branch, category, quota, 2024, exam_type)
    lag_2 = get_db_cutoff(db, college, branch, category, quota, 2023, exam_type)
    if lag_1 is None:
        lag_1 = float(get_cutoff_rank(college, branch, category, quota, "M", 2024))
    if lag_2 is None:
        lag_2 = float(get_cutoff_rank(college, branch, category, quota, "M", 2023))
    return lag_1, lag_2

def generate_single_prediction(
    col: College, branch_code: str, request: CollegePredictionRequest, db: Session
) -> Optional[CollegePrediction]:
    """Generate cutoff predictions for a single college-branch combination."""
    exam_type = request.exam.value
    
    if request.exam == ExamEnum.NEET:
        quota = "AIQ"
    elif request.exam == ExamEnum.MHT_CET:
        quota = "MS" if col.state == "MH" else "AI"
    else:
        quota = "HS" if col.state == request.home_state and col.type in ("NIT", "STATE") else "OS"

    pred = predictors.get(exam_type)
    if pred is None:
        pred = predictors.get("JEE_MAIN")
        if pred is None:
            pred = CutoffPredictor()
            predictors[exam_type] = pred

    lag_1, lag_2 = get_lags_for_prediction(db, col.college_code, branch_code, request.category.value, quota, exam_type)
    _, bootstrap_preds = pred.predict_one(
        col.college_code, branch_code, request.category.value, quota, request.gender.value, lag_1, lag_2
    )
    p10, p50, p90, prob = compute_bootstrap_intervals(bootstrap_preds, request.rank)
    hist_ranks = get_historical_ranks(db, col.college_code, branch_code, request.category.value, quota, exam_type)
    
    br_map = {
        "CS": "Computer Science",
        "EC": "Electronics",
        "ME": "Mechanical",
        "MBBS": "Medicine and Surgery",
        "BDS": "Dental Surgery"
    }
    br_name = br_map.get(branch_code, branch_code)
    
    source_url = f"https://josaa.admissions.nic.in/cutoffs/{col.college_code}.pdf"
    if request.exam == ExamEnum.NEET:
        source_url = "https://mcc.nic.in"
    elif request.exam == ExamEnum.MHT_CET:
        source_url = "https://mahacet.org"

    return CollegePrediction(
        college_code=col.college_code, college_name=col.name, branch_code=branch_code,
        branch_name=f"{br_name} Engineering" if branch_code in ("CS", "EC", "ME") else br_name, quota=quota,
        predicted_opening_rank=int(p50 * 0.85),
        predicted_closing_rank=p50, confidence_interval={"p10": p10, "p50": p50, "p90": p90},
        admission_probability=prob, historical_closing_ranks=hist_ranks,
        trend=compute_trend(hist_ranks), data_confidence="HIGH",
        data_source=f"Official Cutoff {col.type}",
        source_url=source_url,
        fees_per_year=get_college_fees(col.college_code), nirf_rank=col.nirf_rank_engineering
    )

def run_prediction_pipeline(
    request: CollegePredictionRequest, db: Session
) -> List[CollegePrediction]:
    """Execute prediction pipeline across all filtered colleges."""
    colleges = db.query(College).all()
    predictions = []
    
    if request.exam == ExamEnum.NEET:
        branches = ["MBBS", "BDS"]
    else:
        branches = list(BRANCH_MAP.keys())

    for col in colleges:
        for branch_code in branches:
            if not matches_filters(col, branch_code, request):
                continue
            pred = generate_single_prediction(col, branch_code, request, db)
            if pred:
                predictions.append(pred)
    predictions.sort(key=lambda x: (-x.admission_probability, x.nirf_rank or 9999))
    return predictions


def log_predictions_to_db(
    db: Session, request: CollegePredictionRequest, predictions: List[CollegePrediction]
) -> None:
    """Log predictions to prediction_logs table for shadow testing."""
    for p in predictions:
        db.add(PredictionLog(
            exam_type=request.exam.value,
            college_code=p.college_code,
            branch_code=p.branch_code,
            category=request.category.value,
            quota=p.quota,
            gender=request.gender.value,
            rank=request.rank,
            predicted_closing_rank=p.predicted_closing_rank,
            admission_probability=p.admission_probability
        ))
    try:
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log predictions to database: {e}")
        db.rollback()


def make_prediction_response(predictions: List[CollegePrediction]) -> CollegePredictionResponse:
    """Create prediction response metadata and wrapper."""
    disclaimer = "Predictions based on historical trends. Actual cutoffs may vary."
    if any(p.data_confidence == "LOW" for p in predictions):
        disclaimer += " WARNING: Some predictions are based on low confidence data."
    return CollegePredictionResponse(
        predictions=predictions,
        metadata=PredictionMetadata(
            model_version="cutoff_pred_v2.3.1",
            prediction_timestamp=datetime.utcnow().isoformat() + "Z",
            data_as_of="2024-11-30", total_predictions=len(predictions),
            disclaimer=disclaimer
        )
    )


@app.post("/v1/predict/college", response_model=CollegePredictionResponse)
def predict_college(
    request: CollegePredictionRequest, req: Request, db: Session = Depends(get_db)
) -> CollegePredictionResponse:
    """Predict college cutoffs and chances of admission."""
    exam_type = request.exam.value
    if exam_type not in predictors:
        load_production_models()
    # Gracefully fall back to CutoffPredictor when no production model is in registry
    if exam_type not in predictors:
        logger.warning(f"No production model for {exam_type}. Using fallback CutoffPredictor.")
        predictors[exam_type] = CutoffPredictor()

    cache_key = generate_cache_key(request)
    wrapped = get_cached_wrapped(cache_key)
    
    redis_healthy = is_redis_healthy()
    
    # If we have a cached response (even if stale, check if we need to return it)
    if wrapped:
        fresh_until = wrapped.get("fresh_until", 0)
        # If cache is fresh, OR we are in degraded mode, OR Redis is down: serve from cache immediately
        if time.time() < fresh_until or degraded_mode or not redis_healthy:
            logger.info("Serving prediction from cache.")
            req.state.is_cached = True
            return CollegePredictionResponse(**wrapped["wrapped_response"])

    # If cache is expired or we have a cache miss, we need to query the database/pipeline
    global _current_uncached_queries
    use_limit = not redis_healthy or degraded_mode
    if use_limit:
        with _uncached_lock:
            if _current_uncached_queries >= MAX_CONCURRENT_UNCACHED:
                # Saturated: try to fall back to the stale cache before giving up!
                if wrapped and "wrapped_response" in wrapped:
                    logger.warning("Serving stale cached result under high concurrency limit.")
                    req.state.is_cached = True
                    return CollegePredictionResponse(**wrapped["wrapped_response"])
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Service temporarily overloaded. Please try again later."
                )
            _current_uncached_queries += 1

    try:
        predictions = run_prediction_pipeline(request, db)
        log_predictions_to_db(db, request, predictions)
        
        # Sort predictions descending by admission probability
        predictions.sort(
            key=lambda p: p.admission_probability,
            reverse=True  # HIGHEST probability first
        )
        
        response = make_prediction_response(predictions)
        
        # If no predictions have probability > 0.05, add a warning field
        if all(p.admission_probability <= 0.05 for p in predictions):
            response.low_probability_warning = (
                "All predictions show less than 5% probability for your rank. "
                "Consider adjusting your filters or checking a higher rank range."
            )
            
        set_cached_prediction(cache_key, response.model_dump())
        return response
    except Exception as db_ex:
        logger.error(f"Database/pipeline error occurred: {db_ex}", exc_info=True)
        # Fallback: if we have any stale cached value, serve it
        if wrapped and "wrapped_response" in wrapped:
            logger.warning("DB/pipeline query failed. Serving stale cached result as fallback.")
            req.state.is_cached = True
            return CollegePredictionResponse(**wrapped["wrapped_response"])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is temporarily overloaded or unavailable. Please try again later."
        )
    finally:
        if use_limit:
            with _uncached_lock:
                _current_uncached_queries -= 1

security = HTTPBasic()

def authenticate_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    correct_username = os.getenv("ADMIN_USERNAME", "admin")
    correct_password = os.getenv("ADMIN_PASSWORD", "admin_secure_pass123")
    is_user_ok = secrets.compare_digest(credentials.username, correct_username)
    is_pass_ok = secrets.compare_digest(credentials.password, correct_password)
    if not (is_user_ok and is_pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect admin username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/v1/admin/sme-queue", response_model=List[SMEReviewQueueItem])
def get_sme_queue(
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user: str = Depends(authenticate_admin)
) -> List[SMEReviewQueueItem]:
    """Retrieve all items in the SME Review Queue, optionally filtered by resolved status."""
    query = db.query(SMEReviewQueue)
    if resolved is not None:
        query = query.filter(SMEReviewQueue.resolved == resolved)
    return query.all()

@app.get("/v1/colleges/{code}", response_model=CollegeProfileSchema)
def get_college_profile(code: str, req: Request, db: Session = Depends(get_db)) -> CollegeProfileSchema:
    """Get college profile by code with Redis caching (TTL=1h)."""
    cache_key = f"college:{code}"
    cached = get_cached_prediction(cache_key)
    if cached:
        req.state.is_cached = True
        return CollegeProfileSchema(**cached)
        
    college = db.query(College).filter(College.college_code == code).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
        
    profile_data = CollegeProfileSchema.model_validate(college)
    set_cached_prediction(cache_key, profile_data.model_dump(), ttl=3600)
    return profile_data

@app.get("/health")
def health_check() -> Dict[str, str]:
    """Liveness check for deployment health probes."""
    return {"status": "healthy", "service": "prediction-service"}

@app.get("/v1/health/detailed")
def detailed_health() -> Dict[str, Any]:
    """Detailed health check endpoint reporting resource usage, db pools, and cache status."""
    try:
        import psutil
    except ImportError:
        psutil = None
    
    # 1. CPU and Memory resource stats
    try:
        if psutil is not None:
            cpu_usage = psutil.cpu_percent(interval=None)
            memory_info = psutil.virtual_memory()
            memory_usage = memory_info.percent
        else:
            cpu_usage = -1.0
            memory_usage = -1.0
    except Exception as ex:
        logger.error(f"Failed to fetch system resource metrics: {ex}")
        cpu_usage = -1.0
        memory_usage = -1.0
        
    # 2. Database Connection Pool stats
    try:
        from .database import engine
        active_connections = engine.pool.checkedout() if hasattr(engine, 'pool') and hasattr(engine.pool, 'checkedout') else -1
        pool_size = engine.pool.size() if hasattr(engine, 'pool') and hasattr(engine.pool, 'size') else -1
        max_overflow = engine.pool.overflow() if hasattr(engine, 'pool') and hasattr(engine.pool, 'overflow') else -1
    except Exception as ex:
        logger.error(f"Failed to fetch DB pool metrics: {ex}")
        active_connections = -1
        pool_size = -1
        max_overflow = -1
        
    # 3. Redis Connectivity and Latency
    redis_lat = get_redis_latency()
    
    avg_latency = sum(_latencies) / len(_latencies) if _latencies else 0.0
    hit_rate = _cache_hits / _total_requests if _total_requests > 0 else 0.0
    
    return {
        "status": "degraded" if degraded_mode or redis_lat < 0 else "healthy",
        "degraded_mode": degraded_mode,
        "resource_usage": {
            "cpu_percentage": cpu_usage,
            "memory_percentage": memory_usage
        },
        "database": {
            "active_connections": active_connections,
            "pool_size": pool_size,
            "max_overflow": max_overflow
        },
        "redis": {
            "latency_ms": redis_lat,
            "healthy": redis_lat >= 0
        },
        "hit_rate": hit_rate,
        "latency_ms": avg_latency,
        "total_requests": _total_requests,
        "cache_hits": _cache_hits
    }

@app.post("/v1/admin/degraded-mode")
def toggle_degraded_mode(enabled: bool, admin_user: str = Depends(authenticate_admin)) -> Dict[str, Any]:
    """Toggle degraded mode state manually for testing recovery and grace fallback."""
    global degraded_mode
    degraded_mode = enabled
    logger.warning(f"Degraded mode manually set to {degraded_mode}.")
    return {"degraded_mode": degraded_mode}

