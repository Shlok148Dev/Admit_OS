"""
Unit and integration tests for the counseling service optimizer and APIs.
"""
from fastapi.testclient import TestClient
from services.counseling.main import app
from services.counseling.optimizer import (
    filter_colleges_by_exam, CandidateCollege, ChoiceOutput,
    sort_by_risk_appetite, get_choice_label, apply_upgrade_optimization
)

client = TestClient(app)

# Common test data
MOCK_PROFILE = {
    "rank": 5000,
    "percentile": 99.5,
    "category": "GENERAL",
    "home_state": "MH",
    "gender": "M",
    "primary_exam": "JEE_MAIN"
}

MOCK_PREFERENCES = {
    "branch_priority": 0.4,
    "college_tier_priority": 0.3,
    "location_priority": 0.2,
    "fees_priority": 0.1,
    "preferred_branches": ["CS"],
    "adjacent_branches": ["EC"]
}

MOCK_COLLEGES = [
    # Safe college (>70%)
    {
        "college_code": "NIT_TRICHY",
        "college_name": "NIT Trichy",
        "branch_code": "ME",
        "branch_name": "Mechanical Engineering",
        "predicted_closing_rank": 6500,
        "admission_probability": 0.85,
        "fees_per_year": 147150,
        "nirf_rank": 8,
        "quota": "OS"
    },
    # Reach college (>25% and <=70%)
    {
        "college_code": "IIT_BOMBAY",
        "college_name": "IIT Bombay",
        "branch_code": "CS",
        "branch_name": "Computer Science Engineering",
        "predicted_closing_rank": 4800,
        "admission_probability": 0.40,
        "fees_per_year": 220000,
        "nirf_rank": 3,
        "quota": "OS"
    },
    # Safe college (>70%)
    {
        "college_code": "NIT_SURATHKAL",
        "college_name": "NIT Surathkal",
        "branch_code": "EC",
        "branch_name": "Electronics Engineering",
        "predicted_closing_rank": 8000,
        "admission_probability": 0.95,
        "fees_per_year": 135000,
        "nirf_rank": 73,
        "quota": "HS"
    },
    # Unlikely reach (<= 25%)
    {
        "college_code": "IIT_DELHI",
        "college_name": "IIT Delhi",
        "branch_code": "CS",
        "branch_name": "Computer Science Engineering",
        "predicted_closing_rank": 2000,
        "admission_probability": 0.10,
        "fees_per_year": 225000,
        "nirf_rank": 2,
        "quota": "OS"
    }
]

def test_optimize_choices_conservative():
    """Conservative mode should sort primarily by admission_probability DESC."""
    req_body = {
        "session_id": "test-session",
        "student_profile": MOCK_PROFILE,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": [
            MOCK_COLLEGES[0], # NIT Trichy ME (0.85)
            MOCK_COLLEGES[2], # NIT Surathkal EC (0.95)
        ],
        "risk_appetite": "CONSERVATIVE"
    }
    # For JEE_MAIN, MOCK_COLLEGES has IIT_BOMBAY filtered out by exam type (only NIT/IIIT/GFTI allowed).
    # So we pass only NIT and COEP (STATE) to test conservative sorting.
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    
    # Check that after sorting, general DESC order is maintained
    # NIT Surathkal (0.95) > NIT Trichy (0.85)
    assert choices[0]["college_code"] == "NIT_SURATHKAL"
    assert choices[1]["college_code"] == "NIT_TRICHY"

def test_optimize_choices_aggressive():
    """Aggressive mode sorts by preference_score DESC, probability as tiebreaker."""
    # Let's use colleges that match JEE_MAIN (NITs, IIITs, GFTIs)
    jee_main_colleges = [
        {
            "college_code": "NIT_TRICHY",
            "college_name": "NIT Trichy",
            "branch_code": "ME",
            "branch_name": "Mechanical Engineering",
            "predicted_closing_rank": 6500,
            "admission_probability": 0.85,
            "fees_per_year": 147150,
            "nirf_rank": 8,
            "quota": "OS"
        },
        {
            "college_code": "IIIT_ALLAHABAD",
            "college_name": "IIIT Allahabad",
            "branch_code": "CS",
            "branch_name": "Computer Science Engineering",
            "predicted_closing_rank": 4800,
            "admission_probability": 0.40,
            "fees_per_year": 180000,
            "nirf_rank": 25,
            "quota": "OS"
        }
    ]
    req_body = {
        "session_id": "test-session",
        "student_profile": MOCK_PROFILE,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": jee_main_colleges,
        "risk_appetite": "AGGRESSIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    
    # IIIT Allahabad CS should have higher preference score due to CS branch priority (0.4) vs ME (0.3*0.4)
    assert choices[0]["college_code"] == "IIIT_ALLAHABAD"
    assert choices[1]["college_code"] == "NIT_TRICHY"

def test_optimize_choices_balanced():
    """Balanced mode sorts by a weighted blend of preference and probability."""
    req_body = {
        "session_id": "test-session",
        "student_profile": MOCK_PROFILE,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": [MOCK_COLLEGES[0], MOCK_COLLEGES[2]],
        "risk_appetite": "BALANCED"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["optimized_choices"]) == 2

def test_what_if_simulation():
    """What-if simulation should apply rank delta, update probability, and return diff."""
    adv_profile = MOCK_PROFILE.copy()
    adv_profile["primary_exam"] = "JEE_ADVANCED"
    req_body = {
        "session_id": "test-session",
        "student_profile": adv_profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "CONSERVATIVE",
        "rank_delta": -2000,  # Improves rank
        "new_category": "SC"  # Upgrade category to reserved
    }
    resp = client.post("/v1/counsel/what-if", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert "original_choices" in data
    assert "modified_choices" in data
    assert "diff" in data
    
    # Since rank improved and category changed to SC, probabilities should be higher
    orig_prob = [c["admission_probability"] for c in data["original_choices"] if c["college_code"] == "IIT_BOMBAY"][0]
    mod_prob = [c["admission_probability"] for c in data["modified_choices"] if c["college_code"] == "IIT_BOMBAY"][0]
    assert mod_prob > orig_prob

def test_chat_rag():
    """RAG chat should return an answer via degraded mode (avoids torch load on local Windows)."""
    import services.counseling.main as counseling_main

    # Enable degraded mode to avoid loading sentence_transformers/torch
    # which triggers an access violation on this Windows + Python 3.10 env
    original_mode = counseling_main.degraded_mode
    counseling_main.degraded_mode = True
    try:
        resp = client.post("/v1/counsel/chat", json={"session_id": "test", "query": "What is the float option in JoSAA counseling?"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["answer"]) > 10
        assert data["confidence"] == "LOW"
        assert "degraded" in data["answer"].lower() or "degraded" in (data.get("warning") or "").lower()

        # Fallback response for genuinely irrelevant query
        resp2 = client.post("/v1/counsel/chat", json={"session_id": "test", "query": "xyzzy quux flurble"})
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["confidence"] == "LOW"
    finally:
        counseling_main.degraded_mode = original_mode

def test_get_rules_endpoint():
    """Rules retrieval endpoint should return list of rules for JEE_MAIN."""
    resp = client.get("/v1/counsel/rules/jee_main")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 10

def test_compare_endpoint():
    """Comparison endpoint should compare two options and return winner metrics."""
    req_body = {
        "student_profile": MOCK_PROFILE,
        "preferences": MOCK_PREFERENCES,
        "option_a": MOCK_COLLEGES[0],  # NIT Trichy ME
        "option_b": MOCK_COLLEGES[2]   # COEP Pune EC
    }
    resp = client.post("/v1/counsel/compare", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert "metrics" in data
    assert "recommendation" in data
    assert data["recommendation"] in ("Option A", "Option B")

def test_detailed_health_endpoint():
    """Test the detailed health check returns correct structure and hit rate info."""
    # Hit rules endpoint to increment cache hits and total requests
    resp_rule = client.get("/v1/counsel/rules/jee_main")
    assert resp_rule.status_code == 200

    resp = client.get("/v1/health/detailed")
    assert resp.status_code == 200
    data = resp.json()
    assert "degraded_mode" in data
    assert "resource_usage" in data
    assert "hit_rate" in data
    assert "latency_ms" in data
    assert data["total_requests"] >= 1
    assert data["cache_hits"] >= 1

def test_degraded_mode_toggle_and_chat_bypass():
    """Test manual degraded-mode toggling with auth, and that RAG chat bypasses FAISS search when active."""
    # 1. Accessing toggle without auth should fail
    resp_no_auth = client.post("/v1/admin/degraded-mode?enabled=true")
    assert resp_no_auth.status_code == 401

    # 2. Toggle degraded mode ON
    resp_toggle_on = client.post("/v1/admin/degraded-mode?enabled=true", auth=("admin", "admin_secure_pass123"))
    assert resp_toggle_on.status_code == 200
    assert resp_toggle_on.json()["degraded_mode"] is True

    # 3. Check that chat returns fallback degraded response
    resp_chat = client.post("/v1/counsel/chat", json={"session_id": "test", "query": "What is float?"})
    assert resp_chat.status_code == 200
    chat_data = resp_chat.json()
    assert "degraded mode" in chat_data["answer"].lower()
    assert chat_data["confidence"] == "LOW"
    assert chat_data["warning"] == "Degraded mode active"

    # 4. Check detailed health endpoint reports degraded status
    resp_health = client.get("/v1/health/detailed")
    assert resp_health.status_code == 200
    assert resp_health.json()["degraded_mode"] is True
    assert resp_health.json()["status"] == "degraded"

    # 5. Toggle degraded mode OFF
    resp_toggle_off = client.post("/v1/admin/degraded-mode?enabled=false", auth=("admin", "admin_secure_pass123"))
    assert resp_toggle_off.status_code == 200
    assert resp_toggle_off.json()["degraded_mode"] is False

    # 6. Check detailed health reports healthy status
    resp_health_off = client.get("/v1/health/detailed")
    assert resp_health_off.json()["degraded_mode"] is False
    assert resp_health_off.json()["status"] == "healthy"

def test_optimize_choices_jee_main_uses_float_freeze():
    """JEE_MAIN request uses float_freeze upgrade logic and populates context."""
    profile = MOCK_PROFILE.copy()
    profile["primary_exam"] = "JEE_MAIN"
    req_body = {
        "session_id": "test-session-jee-main",
        "student_profile": profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": [
            {
                "college_code": "NIT_TRICHY",
                "college_name": "NIT Trichy",
                "branch_code": "ME",
                "branch_name": "Mechanical",
                "predicted_closing_rank": 6500,
                "admission_probability": 0.85,
                "fees_per_year": 147150,
                "nirf_rank": 8,
                "quota": "OS"
            }
        ],
        "risk_appetite": "CONSERVATIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["strategy_used"] == "float_freeze"
    assert data["exam_counseling_body"] == "JoSAA"
    assert data["exam_has_upgrade_rounds"] is True
    assert data["exam_key_rule"] is not None
    assert data["colleges_filtered_from"] == 1

def test_optimize_choices_mht_cet_no_upgrade():
    """MHT_CET request has NO upgrade insertion and skips upgrade rounds."""
    profile = MOCK_PROFILE.copy()
    profile["primary_exam"] = "MHT_CET"
    req_body = {
        "session_id": "test-session-mht-cet",
        "student_profile": profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": [
            {
                "college_code": "COEP_PUNE",
                "college_name": "COEP Pune",
                "branch_code": "CS",
                "branch_name": "CSE",
                "predicted_closing_rank": 1000,
                "admission_probability": 0.95,
                "fees_per_year": 135000,
                "nirf_rank": 73,
                "quota": "HS"
            }
        ],
        "risk_appetite": "CONSERVATIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["strategy_used"] is None
    assert data["exam_has_upgrade_rounds"] is False

def test_exam_college_filtering():
    """Verify that filter_colleges_by_exam filters colleges by exam type correctly."""
    colleges = [
        CandidateCollege(college_code="IIT_BOMBAY", college_name="IIT Bombay", branch_code="CS", branch_name="CSE", admission_probability=0.8, fees_per_year=100000, quota="OS"),
        CandidateCollege(college_code="NIT_TRICHY", college_name="NIT Trichy", branch_code="CS", branch_name="CSE", admission_probability=0.8, fees_per_year=100000, quota="OS"),
        CandidateCollege(college_code="COEP_PUNE", college_name="COEP Pune", branch_code="CS", branch_name="CSE", admission_probability=0.8, fees_per_year=100000, quota="OS")
    ]
    # JEE_MAIN: allowed is NIT, IIIT, GFTI. So NIT_TRICHY should remain, others filtered.
    filtered = filter_colleges_by_exam(colleges, "JEE_MAIN")
    assert len(filtered) == 1
    assert filtered[0].college_code == "NIT_TRICHY"

    # JEE_ADVANCED: allowed is IIT.
    filtered_adv = filter_colleges_by_exam(colleges, "JEE_ADVANCED")
    assert len(filtered_adv) == 1
    assert filtered_adv[0].college_code == "IIT_BOMBAY"

def test_sorting_aggressive_low_probability_bottom():
    """Aggressive sorting puts <10% probability options at the bottom, sorting others by preference descending."""
    choices = [
        ChoiceOutput(college_code="C1", college_name="C1", branch_code="CS", branch_name="CS", admission_probability=0.05, fees_per_year=100000, quota="OS", preference_score=0.9, final_score=0.9, explanation=""),
        ChoiceOutput(college_code="C2", college_name="C2", branch_code="CS", branch_name="CS", admission_probability=0.50, fees_per_year=100000, quota="OS", preference_score=0.7, final_score=0.7, explanation=""),
        ChoiceOutput(college_code="C3", college_name="C3", branch_code="CS", branch_name="CS", admission_probability=0.02, fees_per_year=100000, quota="OS", preference_score=0.95, final_score=0.95, explanation=""),
        ChoiceOutput(college_code="C4", college_name="C4", branch_code="CS", branch_name="CS", admission_probability=0.80, fees_per_year=100000, quota="OS", preference_score=0.6, final_score=0.6, explanation="")
    ]
    sorted_choices = sort_by_risk_appetite(choices, "AGGRESSIVE")
    # Expected order:
    # Non-low probability: C2 (pref 0.7), C4 (pref 0.6)
    # Low probability (<10%): C3 (pref 0.95), C1 (pref 0.9)
    assert sorted_choices[0].college_code == "C2"
    assert sorted_choices[1].college_code == "C4"
    assert sorted_choices[2].college_code == "C3"
    assert sorted_choices[3].college_code == "C1"

def test_safe_target_reach_labeling():
    """Verify SAFE/TARGET/REACH labeling based on EXAM_THRESHOLDS."""
    assert get_choice_label(0.75, "JEE_MAIN") == "SAFE"
    assert get_choice_label(0.45, "JEE_MAIN") == "TARGET"
    assert get_choice_label(0.25, "JEE_MAIN") == "REACH"

def test_upgrade_rounds_skipped_for_special_exams():
    """Upgrade logic should be completely skipped for NEET, MHT_CET, and KCET."""
    choices = [
        ChoiceOutput(college_code="IIT_BOMBAY", college_name="IIT Bombay", branch_code="CS", branch_name="CS", admission_probability=0.40, fees_per_year=100000, quota="OS", preference_score=0.9, final_score=0.9, explanation=""),
        ChoiceOutput(college_code="COEP_PUNE", college_name="COEP Pune", branch_code="CS", branch_name="CS", admission_probability=0.95, fees_per_year=100000, quota="OS", preference_score=0.8, final_score=0.8, explanation="")
    ]
    # Normally, IIT_BOMBAY (reach) would upgrade above COEP_PUNE (safe) for JEE_MAIN.
    # For NEET, it should not change order because upgrade rounds are skipped.
    result = apply_upgrade_optimization(choices, exam="NEET")
    assert result[0].college_code == "IIT_BOMBAY"
    assert result[1].college_code == "COEP_PUNE"

def test_colleges_search_endpoint():
    """Verify the /v1/colleges/search endpoint returns filtered list based on exam_type."""
    # Search for JEE_MAIN (should return NITs, IIITs, etc. but not IITs)
    resp = client.get("/v1/colleges/search?exam_type=JEE_MAIN")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for college in data:
        assert college["type"] in ["NIT", "IIIT", "GFTI"]

    # Search with query string
    resp = client.get("/v1/colleges/search?exam_type=JEE_MAIN&query=trichy")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["college_code"] == "NIT_TRICHY"
