import logging
import os
import secrets
import time
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .schemas import (
    OptimizeChoicesRequest, OptimizeChoicesResponse,
    WhatIfRequest, WhatIfResponse, WhatIfDiffItem,
    ChatRequest, ChatResponse,
    CompareRequest, CompareResponse, ComparisonMetric, ChoiceOutput,
    ChatQueryRequest, ChatQueryResponse, ChatSource, ChoiceItemOutput
)
from .optimizer import (
    optimize_choice_list, compute_preference_score,
    get_explanation_text, sort_by_risk_appetite, apply_upgrade_optimization,
    EXAM_COUNSELING_CONFIG
)
from .rules import JOSAA_RULES
from .rag.retriever import CounselingRetriever
from .rag.guard import HallucinationGuard
from .rag.chat import ARIAChatEngine

logger: logging.Logger = logging.getLogger("counseling_service.main")

degraded_mode: bool = False
_total_requests: int = 0
_cache_hits: int = 0
_latencies: List[float] = []

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

_retriever = CounselingRetriever()
_guard = HallucinationGuard()
_chat_engine = ARIAChatEngine(retriever=_retriever, guard=_guard)


app = FastAPI(
    title="Counseling Choice Filling & RAG Service",
    description="Microservice for choice optimization, scenario simulation, rules Q&A, and comparisons.",
    version="1.0.0"
)

@app.post("/v1/counsel/optimize-choices", response_model=OptimizeChoicesResponse)
def optimize_choices(request: OptimizeChoicesRequest) -> OptimizeChoicesResponse:
    """Optimize student choice list based on preferences, rank, and risk appetite."""
    try:
        exam = request.student_profile.primary_exam or "JEE_MAIN"
        config = EXAM_COUNSELING_CONFIG.get(exam.upper(), EXAM_COUNSELING_CONFIG["JEE_MAIN"])
        
        optimized = optimize_choice_list(
            request.candidate_colleges,
            request.preferences,
            request.student_profile.home_state,
            request.risk_appetite,
            exam=exam
        )
        choice_outputs = []
        for i, c in enumerate(optimized):
            choice_outputs.append(ChoiceItemOutput(
                choice_number=i + 1,
                college_code=c.college_code,
                college_name=c.college_name,
                branch_code=c.branch_code,
                branch_name=c.branch_name,
                admission_probability=c.admission_probability,
                fees_per_year=c.fees_per_year,
                nirf_rank=c.nirf_rank,
                quota=c.quota,
                reason=c.explanation
            ))
        
        risk_score = 85 if request.risk_appetite.upper() == "AGGRESSIVE" else (50 if request.risk_appetite.upper() == "BALANCED" else 20)
        pref_type = "Branch selection" if request.preferences.branch_priority > request.preferences.college_tier_priority else "College reputation"
        counseling_body = config.get("counseling_body", "JoSAA")
        explanation = f"Choice filling list compiled via {counseling_body} RL agent for competitive rank {request.student_profile.rank}. Optimized for brand vs branch prioritizing {pref_type} under a {request.risk_appetite.lower()} risk strategy."
        
        # Calculate reach warning
        all_reach = all(c.admission_probability < config.get("reach_probability", 0.40) for c in optimized) if optimized else False
        all_reach_warning = "All your selected colleges are above your predicted rank. Consider adding safer options." if all_reach else None
        
        return OptimizeChoicesResponse(
            optimized_choices=choice_outputs,
            optimized_list=choice_outputs,
            risk_score=risk_score,
            explanation=explanation,
            strategy_used=config.get("upgrade_strategy"),
            exam_counseling_body=config.get("counseling_body"),
            exam_has_upgrade_rounds=config.get("has_upgrade_rounds"),
            exam_key_rule=config.get("key_rule"),
            all_reach_warning=all_reach_warning
        )
    except Exception as e:
        logger.error(f"Error optimizing choices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during choice optimization.")

def adjust_probability(c_prob: float, rank_delta: int, orig_cat: str, new_cat: str) -> float:
    """Simulate probability changes based on rank delta and category overrides."""
    prob = c_prob - (rank_delta / 10000.0)
    if new_cat.upper() != orig_cat.upper():
        if orig_cat.upper() == "GENERAL" and new_cat.upper() in ("OBC_NCL", "EWS"):
            prob += 0.15
        elif orig_cat.upper() == "GENERAL" and new_cat.upper() in ("SC", "ST"):
            prob += 0.30
        elif orig_cat.upper() in ("OBC_NCL", "EWS", "SC", "ST") and new_cat.upper() == "GENERAL":
            prob -= 0.20
    return max(0.0, min(1.0, prob))

def run_what_if_simulation(request: WhatIfRequest) -> WhatIfResponse:
    """Execute the scenario simulation logic."""
    exam = request.student_profile.primary_exam or "JEE_MAIN"
    orig_list = optimize_choice_list(
        request.candidate_colleges,
        request.preferences,
        request.student_profile.home_state,
        request.risk_appetite,
        exam=exam
    )
    # Apply overrides
    cat = request.new_category or request.student_profile.category
    h_state = request.new_home_state or request.student_profile.home_state
    
    modified_colleges = []
    for c in request.candidate_colleges:
        new_p = adjust_probability(c.admission_probability, request.rank_delta, request.student_profile.category, cat)
        modified_colleges.append(c.model_copy(update={"admission_probability": round(new_p, 4)}))
        
    mod_list = optimize_choice_list(
        modified_colleges,
        request.preferences,
        h_state,
        request.risk_appetite,
        exam=exam
    )
    
    # Calculate diff
    orig_map = {f"{c.college_code}:{c.branch_code}": (idx + 1, c) for idx, c in enumerate(orig_list)}
    diff_items = []
    for idx, c in enumerate(mod_list):
        orig_pos, orig_c = orig_map[f"{c.college_code}:{c.branch_code}"]
        diff_items.append(WhatIfDiffItem(
            college_code=c.college_code, branch_code=c.branch_code,
            original_position=orig_pos, new_position=idx + 1,
            original_probability=orig_c.admission_probability, new_probability=c.admission_probability,
            original_preference_score=orig_c.preference_score, new_preference_score=c.preference_score,
            position_change=orig_pos - (idx + 1)
        ))
        
    return WhatIfResponse(
        original_choices=orig_list, modified_choices=mod_list, diff=diff_items,
        metadata={"session_id": request.session_id, "rank_delta": request.rank_delta}
    )

@app.post("/v1/counsel/what-if", response_model=WhatIfResponse)
def what_if(request: WhatIfRequest) -> WhatIfResponse:
    """Simulate changes in choices based on changes to rank, category, or home state."""
    try:
        return run_what_if_simulation(request)
    except Exception as e:
        logger.error(f"Error in what-if simulation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during scenario simulation.")

@app.post("/v1/counsel/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """Conversational Q&A chat endpoint (RAG-powered rules lookup)."""
    if degraded_mode:
        return ChatResponse(
            answer="Service is currently operating in degraded mode. FAISS/RAG lookup is offline.",
            confidence="LOW",
            sources=[],
            warning="Degraded mode active"
        )
    try:
        return _chat_engine.chat(
            query=request.query,
            history=request.history,
            exam_type=request.exam_type,
            student_context=request.student_context
        )
    except Exception as e:
        logger.error(f"Error in chat handler: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during chat retrieval.")


@app.post("/v1/chat/query", response_model=ChatQueryResponse)
def chat_query(request: ChatQueryRequest) -> ChatQueryResponse:
    """Conversational Q&A chat endpoint (RAG-powered rules lookup) styled for the Next.js/Expo frontend contract."""
    if degraded_mode:
        return ChatQueryResponse(
            answer="Service is currently operating in degraded mode. FAISS/RAG lookup is offline.",
            confidence="LOW",
            sources=[],
            time_warning="Degraded mode active"
        )
    try:
        chat_resp = _chat_engine.chat(
            query=request.message,
            history=request.history or [],
            exam_type=request.exam_type or "JEE_MAIN",
            student_context={}
        )
        
        mapped_sources = []
        for src in chat_resp.sources:
            url = "https://mcc.nic.in" if "neet" in src.lower() else "https://josaa.nic.in"
            mapped_sources.append(ChatSource(title=src, url=url))

        return ChatQueryResponse(
            answer=chat_resp.answer,
            confidence=chat_resp.confidence,
            sources=mapped_sources,
            time_warning=chat_resp.warning,
        )
    except Exception as e:
        logger.error(f"Error in chat_query handler: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during RAG retrieval.")


@app.get("/v1/counsel/rules/{exam}", response_model=List[str])
def get_rules(exam: str) -> List[str]:
    """Retrieve official JoSAA/CSAB counseling rules."""
    ex = exam.upper()
    if ex in ("JEE_MAIN", "JEE_ADVANCED", "JOSAA", "CSAB"):
        return [f"{r['title']}: {r['rule']} (Source: {r['source']})" for r in JOSAA_RULES]
    elif ex == "NEET":
        return [
            "Free Exit in Round 1: Candidates can leave the allotted seat in Round 1 without forfeiting the security deposit.",
            "Security Deposit Forfeiture in Round 2: If a seat is allotted in Round 2 and not joined, the security deposit will be forfeited.",
            "Willingness for Upgradation: Submit online willingness to upgrade from Round 1 to Round 2.",
            "State Quota Restriction: Joined candidates of AIQ Round 2/3 cannot resign or participate in state quota counseling."
        ]
    elif ex == "MHT_CET":
        return [
            "Centralized CAP Rounds: Three rounds of online CAP allotment process.",
            "Auto-Freeze Rule: First preference allotment is auto-frozen. Candidates must report to college and accept it.",
            "Self-Freeze Action: Accepts seat and opts out of further rounds to freeze choice.",
            "Seat Acceptance Fee: Mandatory payment of ₹1,000 to accept seat."
        ]
    elif ex == "KCET":
        return [
            "Document Verification: Nodal center verification of files before choice entry is mandatory.",
            "Choice-1 Satisfied: Accepts seat, pays fee, reports to college, and exits counseling.",
            "Choice-2 Upgrade: Satisfied but participates in next round for higher options; current seat is held.",
            "Choice-3 Reject & Upgrade: Rejects seat, participates in next round for higher options.",
            "Choice-4 Exit: Rejects seat and exits counseling entirely."
        ]
    return []

def compare_options(request: CompareRequest) -> CompareResponse:
    """Calculate and compare two candidate options."""
    h_state = request.student_profile.home_state
    
    score_a = compute_preference_score(request.option_a, request.preferences, h_state)
    score_b = compute_preference_score(request.option_b, request.preferences, h_state)
    
    choice_a = ChoiceOutput(**request.option_a.model_dump(), preference_score=round(score_a, 4), final_score=round(score_a, 4), explanation="")
    choice_b = ChoiceOutput(**request.option_b.model_dump(), preference_score=round(score_b, 4), final_score=round(score_b, 4), explanation="")
    
    metrics = [
        ComparisonMetric(metric_name="NIRF Rank", option_a_value=request.option_a.nirf_rank, option_b_value=request.option_b.nirf_rank, winner="A" if (request.option_a.nirf_rank or 999) < (request.option_b.nirf_rank or 999) else "B"),
        ComparisonMetric(metric_name="Fees Per Year", option_a_value=request.option_a.fees_per_year, option_b_value=request.option_b.fees_per_year, winner="A" if request.option_a.fees_per_year < request.option_b.fees_per_year else "B"),
        ComparisonMetric(metric_name="Admission Probability", option_a_value=request.option_a.admission_probability, option_b_value=request.option_b.admission_probability, winner="A" if request.option_a.admission_probability > request.option_b.admission_probability else "B"),
        ComparisonMetric(metric_name="Preference Score", option_a_value=round(score_a, 4), option_b_value=round(score_b, 4), winner="A" if score_a > score_b else "B")
    ]
    
    rec = "Option A" if score_a > score_b else "Option B"
    summary = f"Comparison between {request.option_a.college_name} and {request.option_b.college_name}. {rec} matches your preference priorities better."
    
    return CompareResponse(option_a=choice_a, option_b=choice_b, metrics=metrics, recommendation=rec, summary=summary)

@app.post("/v1/counsel/compare", response_model=CompareResponse)
def compare(request: CompareRequest) -> CompareResponse:
    """Compare two branch-college choices against student preferences and profiles."""
    try:
        return compare_options(request)
    except Exception as e:
        logger.error(f"Error comparing options: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during option comparison.")

@app.get("/health")
def health_check() -> Dict[str, str]:
    """Liveness probe health check."""
    return {"status": "healthy"}

@app.middleware("http")
async def track_metrics_middleware(request, call_next):
    global _total_requests, _cache_hits, _latencies
    is_health = request.url.path.endswith("/health") or request.url.path.endswith("/health/detailed")
    start_time = time.time()
    
    is_cached = False
    if "/rules/" in request.url.path:
        is_cached = True
        
    response = await call_next(request)
    
    if not is_health:
        duration = (time.time() - start_time) * 1000.0
        _total_requests += 1
        if is_cached:
            _cache_hits += 1
        _latencies.append(duration)
        if len(_latencies) > 1000:
            _latencies.pop(0)
            
    return response

@app.get("/v1/health/detailed")
def detailed_health() -> Dict[str, Any]:
    """Detailed health check for counseling service reporting resource usage, degradation state, latency and hit rate."""
    try:
        import psutil
        cpu_usage = psutil.cpu_percent(interval=None)
        memory_usage = psutil.virtual_memory().percent
    except (ImportError, ModuleNotFoundError):
        cpu_usage = -1.0
        memory_usage = -1.0
    except Exception as ex:
        logger.error(f"Failed to fetch system resource metrics: {ex}")
        cpu_usage = -1.0
        memory_usage = -1.0
        
    avg_latency = sum(_latencies) / len(_latencies) if _latencies else 0.0
    hit_rate = _cache_hits / _total_requests if _total_requests > 0 else 0.0
    
    return {
        "status": "degraded" if degraded_mode else "healthy",
        "degraded_mode": degraded_mode,
        "resource_usage": {
            "cpu_percentage": cpu_usage,
            "memory_percentage": memory_usage
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
