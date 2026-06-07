"""
Unit and integration tests for the counseling service optimizer and APIs.
"""
from fastapi.testclient import TestClient
from services.counseling.main import app

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
        "college_code": "COEP_PUNE",
        "college_name": "COEP Pune",
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
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "CONSERVATIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    
    # Check that after sorting and potential upgrade adjustments, general DESC order is maintained
    # Note: Upgrade Optimization rule: if admission_probability for reach college is > 25%,
    # it is inserted exactly one position above the first safe college (probability > 70%).
    # Let's inspect the order.
    # IIT Bombay is reach (0.40). IIT Delhi is <25% (0.10).
    # First safe college is COEP (0.95) or NIT Trichy (0.85).
    # In Conservative:
    # Sorted by probability DESC: COEP (0.95), NIT Trichy (0.85), IIT Bombay (0.40), IIT Delhi (0.10).
    # First safe college is COEP Pune (index 0).
    # Reach is IIT Bombay (0.40). It was after COEP Pune (idx 0).
    # It must be inserted one position above COEP Pune.
    # So new order: IIT Bombay, COEP Pune, NIT Trichy, IIT Delhi.
    assert choices[0]["college_code"] == "IIT_BOMBAY"
    assert choices[1]["college_code"] == "COEP_PUNE"
    assert choices[2]["college_code"] == "NIT_TRICHY"
    assert choices[3]["college_code"] == "IIT_DELHI"

def test_optimize_choices_aggressive():
    """Aggressive mode sorts by preference_score DESC, probability as tiebreaker."""
    req_body = {
        "session_id": "test-session",
        "student_profile": MOCK_PROFILE,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "AGGRESSIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    
    # Preference scores:
    # IIT Bombay CS: branch=1.0*0.4, nirf=(500-3)/500=0.994*0.3, loc=1.0(home MH)*0.2, fees=1-(220k/300k)=0.266*0.1 -> ~0.92
    # IIT Delhi CS: branch=1.0*0.4, nirf=0.996*0.3, loc=0.4(other DL)*0.2, fees=0.25*0.1 -> ~0.80
    # COEP EC: branch=0.6*0.4, nirf=(500-73)/500=0.854*0.3, loc=1.0(home MH)*0.2, fees=1-(135k/300k)=0.55*0.1 -> ~0.75
    # NIT Trichy ME: branch=0.3*0.4, nirf=0.984*0.3, loc=0.4(other TN)*0.2, fees=0.51*0.1 -> ~0.55
    # Sorted by pref score: IIT Bombay, IIT Delhi, COEP Pune, NIT Trichy.
    # First safe college: COEP Pune.
    # IIT Bombay is already above first safe. IIT Delhi is NOT a reach college (>25% constraint: prob is 0.10).
    # So no upgrade moves occur.
    # Order: IIT Bombay, IIT Delhi, COEP Pune, NIT Trichy.
    assert choices[0]["college_code"] == "IIT_BOMBAY"
    assert choices[1]["college_code"] == "IIT_DELHI"
    assert choices[2]["college_code"] == "COEP_PUNE"
    assert choices[3]["college_code"] == "NIT_TRICHY"

def test_optimize_choices_balanced():
    """Balanced mode sorts by a weighted blend of preference and probability."""
    req_body = {
        "session_id": "test-session",
        "student_profile": MOCK_PROFILE,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "BALANCED"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["optimized_choices"]) == 4

def test_what_if_simulation():
    """What-if simulation should apply rank delta, update probability, and return diff."""
    req_body = {
        "session_id": "test-session",
        "student_profile": MOCK_PROFILE,
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
        "option_b": MOCK_COLLEGES[1]   # IIT Bombay CS
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
    """JEE_MAIN request uses float_freeze upgrade logic."""
    profile = MOCK_PROFILE.copy()
    profile["primary_exam"] = "JEE_MAIN"
    req_body = {
        "session_id": "test-session-jee-main",
        "student_profile": profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "CONSERVATIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    assert choices[0]["college_code"] == "IIT_BOMBAY"
    assert data["strategy_used"] == "float_freeze"
    assert data["exam_counseling_body"] == "JoSAA"
    assert data["exam_has_upgrade_rounds"] is True

def test_optimize_choices_mht_cet_no_upgrade():
    """MHT_CET request has NO upgrade insertion."""
    profile = MOCK_PROFILE.copy()
    profile["primary_exam"] = "MHT_CET"
    req_body = {
        "session_id": "test-session-mht-cet",
        "student_profile": profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "CONSERVATIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    assert choices[0]["college_code"] == "COEP_PUNE"
    assert choices[1]["college_code"] == "NIT_TRICHY"
    assert choices[2]["college_code"] == "IIT_BOMBAY"
    assert choices[3]["college_code"] == "IIT_DELHI"
    assert data["strategy_used"] is None
    assert data["exam_has_upgrade_rounds"] is False

def test_optimize_choices_neet_uses_mop_up_threshold():
    """NEET request uses mop_up threshold (0.30)."""
    profile = MOCK_PROFILE.copy()
    profile["primary_exam"] = "NEET"
    colleges = [
        {
            "college_code": "COLLEGE_SAFE",
            "college_name": "Safe Medical College",
            "branch_code": "MBBS",
            "branch_name": "MBBS",
            "predicted_closing_rank": 8000,
            "admission_probability": 0.85,
            "fees_per_year": 100000,
            "nirf_rank": 50,
            "quota": "AIQ"
        },
        {
            "college_code": "COLLEGE_REACH_LOW",
            "college_name": "Low Reach Medical College",
            "branch_code": "MBBS",
            "branch_name": "MBBS",
            "predicted_closing_rank": 6000,
            "admission_probability": 0.28,
            "fees_per_year": 100000,
            "nirf_rank": 40,
            "quota": "AIQ"
        },
        {
            "college_code": "COLLEGE_REACH_HIGH",
            "college_name": "High Reach Medical College",
            "branch_code": "MBBS",
            "branch_name": "MBBS",
            "predicted_closing_rank": 5000,
            "admission_probability": 0.40,
            "fees_per_year": 100000,
            "nirf_rank": 30,
            "quota": "AIQ"
        }
    ]
    req_body = {
        "session_id": "test-session-neet",
        "student_profile": profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": colleges,
        "risk_appetite": "CONSERVATIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    assert choices[0]["college_code"] == "COLLEGE_REACH_HIGH"
    assert choices[1]["college_code"] == "COLLEGE_SAFE"
    assert choices[2]["college_code"] == "COLLEGE_REACH_LOW"
    assert data["strategy_used"] == "mop_up"

def test_optimize_choices_balanced_sort_mix():
    """BALANCED sort produces a mix of SAFE/TARGET/REACH."""
    profile = MOCK_PROFILE.copy()
    profile["primary_exam"] = "JEE_MAIN"
    req_body = {
        "session_id": "test-session-balanced-mix",
        "student_profile": profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "BALANCED"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    assert len(choices) == 4
    has_safe = any(c["admission_probability"] > 0.70 for c in choices)
    has_reach = any(c["admission_probability"] <= 0.40 for c in choices)
    assert has_safe is True
    assert has_reach is True

def test_optimize_choices_generate_reason_mht_cet():
    """generate_reason returns MHT-CET specific text for MHT_CET exam."""
    profile = MOCK_PROFILE.copy()
    profile["primary_exam"] = "MHT_CET"
    req_body = {
        "session_id": "test-session-mht-cet-reason",
        "student_profile": profile,
        "preferences": MOCK_PREFERENCES,
        "candidate_colleges": MOCK_COLLEGES,
        "risk_appetite": "CONSERVATIVE"
    }
    resp = client.post("/v1/counsel/optimize-choices", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    choices = data["optimized_choices"]
    assert any("MHT-CET" in c["reason"] for c in choices)

