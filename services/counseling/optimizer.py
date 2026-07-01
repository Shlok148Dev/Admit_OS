"""
Choice List Optimizer logic and scoring algorithms.
"""
from typing import Dict, List, Optional, Any
from .schemas import CandidateCollege, Preferences, ChoiceOutput

EXAM_COUNSELING_CONFIG: Dict[str, Dict[str, Any]] = {
    "JEE_MAIN": {
        "counseling_body": "JoSAA",
        "has_upgrade_rounds": True,
        "upgrade_strategy": "float_freeze",
        "reach_probability": 0.40,
        "reach_lower_bound": 0.25,
        "safe_probability": 0.70,
        "key_rule": "Float / Slide / Freeze options are available to accept and upgrade."
    },
    "JEE_ADVANCED": {
        "counseling_body": "JoSAA",
        "has_upgrade_rounds": True,
        "upgrade_strategy": "float_freeze",
        "reach_probability": 0.40,
        "reach_lower_bound": 0.25,
        "safe_probability": 0.70,
        "key_rule": "Float / Slide / Freeze options are available to accept and upgrade."
    },
    "NEET": {
        "counseling_body": "MCC",
        "has_upgrade_rounds": False,
        "upgrade_strategy": None,
        "reach_probability": 0.40,
        "reach_lower_bound": 0.30,
        "safe_probability": 0.70,
        "key_rule": "Joined candidates of AIQ Round 2/3 cannot resign or participate in state quota counseling."
    },
    "MHT_CET": {
        "counseling_body": "DTE_MH",
        "has_upgrade_rounds": False,
        "upgrade_strategy": None,
        "reach_probability": 0.40,
        "reach_lower_bound": 0.25,
        "safe_probability": 0.70,
        "key_rule": "First preference allotment is auto-frozen. Candidates must report to college and accept it."
    },
    "KCET": {
        "counseling_body": "KEA",
        "has_upgrade_rounds": False,
        "upgrade_strategy": None,
        "reach_probability": 0.40,
        "reach_lower_bound": 0.25,
        "safe_probability": 0.70,
        "key_rule": "Document Verification is mandatory. Choice-2 is upgrade while holding seat."
    },
    "BITSAT": {
        "counseling_body": "BITSAT",
        "has_upgrade_rounds": True,
        "upgrade_strategy": "float_freeze",
        "reach_probability": 0.40,
        "reach_lower_bound": 0.25,
        "safe_probability": 0.70,
        "key_rule": "Direct iterations without slide/float. Refund policy applies on seat cancellation."
    },
    "WBJEE": {
        "counseling_body": "WBJEEB",
        "has_upgrade_rounds": True,
        "upgrade_strategy": "float_freeze",
        "reach_probability": 0.40,
        "reach_lower_bound": 0.25,
        "safe_probability": 0.70,
        "key_rule": "Seats allotted in Round 1 must pay seat acceptance fee and report for verification."
    },
    "AP_EAPCET": {
        "counseling_body": "APSCHE",
        "has_upgrade_rounds": True,
        "upgrade_strategy": "float_freeze",
        "reach_probability": 0.40,
        "reach_lower_bound": 0.25,
        "safe_probability": 0.70,
        "key_rule": "Candidates must upload documents online and report to the allotted colleges after final phase."
    }
}

EXAM_ELIGIBLE_COLLEGE_TYPES: Dict[str, List[str]] = {
    "JEE_MAIN": ["NIT", "IIIT", "GFT5", "GFTI"],
    "JEE_ADVANCED": ["IIT"],
    "NEET": ["AIIMS", "STATE", "PRIVATE", "DEEMED"],
    "MHT_CET": ["STATE", "PRIVATE"],
    "KCET": ["STATE", "PRIVATE"],
    "BITSAT": ["BITS"],
    "WBJEE": ["STATE", "PRIVATE"],
    "AP_EAPCET": ["STATE", "PRIVATE"]
}

EXAM_THRESHOLDS: Dict[str, Dict[str, float]] = {
    "JEE_MAIN": {"safe": 0.70, "target": 0.40},
    "JEE_ADVANCED": {"safe": 0.70, "target": 0.40},
    "NEET": {"safe": 0.70, "target": 0.40},
    "MHT_CET": {"safe": 0.70, "target": 0.40},
    "KCET": {"safe": 0.70, "target": 0.40},
    "BITSAT": {"safe": 0.70, "target": 0.40},
    "WBJEE": {"safe": 0.70, "target": 0.40},
    "AP_EAPCET": {"safe": 0.70, "target": 0.40}
}

STATE_REGIONS: Dict[str, str] = {
    "JK": "NORTH", "HP": "NORTH", "PB": "NORTH", "HR": "NORTH", "UT": "NORTH",
    "UP": "NORTH", "DL": "NORTH", "CH": "NORTH",
    "AP": "SOUTH", "TG": "SOUTH", "KA": "SOUTH", "KL": "SOUTH", "TN": "SOUTH",
    "PY": "SOUTH", "AN": "SOUTH", "LD": "SOUTH",
    "MH": "WEST", "GJ": "WEST", "GA": "WEST", "DN": "WEST", "DD": "WEST",
    "WB": "EAST", "OR": "EAST", "BH": "EAST", "JH": "EAST",
    "MP": "CENTRAL", "CG": "CENTRAL", "RJ": "CENTRAL",
    "AR": "NORTHEAST", "AS": "NORTHEAST", "MN": "NORTHEAST", "ML": "NORTHEAST",
    "MZ": "NORTHEAST", "NL": "NORTHEAST", "SK": "NORTHEAST", "TR": "NORTHEAST"
}

COLLEGE_STATES: Dict[str, str] = {
    "IIT_BOMBAY": "MH", "IIT_DELHI": "DL", "IIT_MADRAS": "TN",
    "NIT_TRICHY": "TN", "NIT_SURATHKAL": "KA", "IIIT_ALLAHABAD": "UP",
    "IIIT_DELHI": "DL", "COEP_PUNE": "MH", "VJTI_MUMBAI": "MH",
    "ICT_MUMBAI": "MH"
}

def get_region(state: str) -> str:
    """Get region group for a given state code."""
    return STATE_REGIONS.get(state.upper(), "UNKNOWN")

def get_college_state(college_code: str) -> str:
    """Determine the state of a college from college code."""
    return COLLEGE_STATES.get(college_code.upper(), "UNKNOWN")

def get_location_score(college_state: str, home_state: str) -> float:
    """Calculate location match score: 1.0 (home), 0.7 (same region), 0.4 (other)."""
    c_state = college_state.upper()
    h_state = home_state.upper()
    if c_state == h_state:
        return 1.0
    c_region = get_region(c_state)
    h_region = get_region(h_state)
    if c_region != "UNKNOWN" and c_region == h_region:
        return 0.7
    return 0.4

def get_nirf_score(nirf_rank: Optional[int]) -> float:
    """Calculate normalized NIRF score: (500 - rank) / 500 capped at 1.0."""
    if nirf_rank is None or nirf_rank > 500 or nirf_rank <= 0:
        return 0.0
    return max(0.0, min(1.0, (500.0 - nirf_rank) / 500.0))

def get_fees_score(fees: int) -> float:
    """Calculate fees affordability score: 1 - (fees / 300000) capped at 0-1."""
    score = 1.0 - (fees / 300000.0)
    return max(0.0, min(1.0, score))

def get_branch_score(branch_code: str, preferred: List[str], adjacent: List[str]) -> float:
    """Calculate branch score: 1.0 (preferred), 0.6 (adjacent), 0.3 (otherwise)."""
    b_code = branch_code.upper()
    pref_upper = [p.upper() for p in preferred]
    adj_upper = [a.upper() for a in adjacent]
    if b_code in pref_upper:
        return 1.0
    if b_code in adj_upper:
        return 0.6
    return 0.3

def compute_preference_score(college: CandidateCollege, pref: Preferences, home_state: str) -> float:
    """Compute overall preference score based on priorities."""
    b_score = get_branch_score(college.branch_code, pref.preferred_branches, pref.adjacent_branches)
    n_score = get_nirf_score(college.nirf_rank)
    col_state = get_college_state(college.college_code)
    l_score = get_location_score(col_state, home_state)
    f_score = get_fees_score(college.fees_per_year)
    
    return float(
        pref.branch_priority * b_score +
        pref.college_tier_priority * n_score +
        pref.location_priority * l_score +
        pref.fees_priority * f_score
    )

def get_college_type(college_code: str) -> str:
    code = college_code.upper()
    if "IIIT_" in code or code == "IIIT":
        return "IIIT"
    if "IIT_" in code or code == "IIT":
        return "IIT"
    if "NIT_" in code or code == "NIT":
        return "NIT"
    if "AIIMS_" in code or code == "AIIMS":
        return "AIIMS"
    if "BITS_" in code or "BITSAT" in code or code.startswith("BITS"):
        return "BITS"
    if "GFTI" in code or "GFT5" in code:
        return "GFTI"
    if code in ("COEP_PUNE", "VJTI_MUMBAI", "ICT_MUMBAI", "BMSCE_BANGALORE", "KGMU_LUCKNOW", "MAMC_DELHI"):
        return "STATE"
    if code in ("RVCE_BANGALORE", "PESU_BANGALORE", "SPIT_MUMBAI", "DY_PATIL_PUNE"):
        return "PRIVATE"
    if "IIIT" in code: return "IIIT"
    if "IIT" in code: return "IIT"
    if "NIT" in code: return "NIT"
    if "AIIMS" in code: return "AIIMS"
    if "BITS" in code: return "BITS"
    if "GFTI" in code: return "GFTI"
    if "PRIVATE" in code: return "PRIVATE"
    return "STATE"

def get_choice_label(prob: float, exam: str) -> str:
    exam_upper = exam.upper()
    thresholds = EXAM_THRESHOLDS.get(exam_upper, {"safe": 0.70, "target": 0.40})
    if prob >= thresholds["safe"]:
        return "SAFE"
    elif prob >= thresholds["target"]:
        return "TARGET"
    return "REACH"

def filter_colleges_by_exam(colleges: List[CandidateCollege], exam: str) -> List[CandidateCollege]:
    exam_upper = exam.upper()
    allowed_types = EXAM_ELIGIBLE_COLLEGE_TYPES.get(exam_upper, [])
    if not allowed_types:
        return colleges
    filtered = []
    for c in colleges:
        c_type = getattr(c, "college_type", None)
        if not c_type and hasattr(c, "model_extra") and c.model_extra:
            c_type = c.model_extra.get("college_type")
        if not c_type:
            c_type = get_college_type(c.college_code)
        
        if c_type.upper() in [t.upper() for t in allowed_types]:
            filtered.append(c)
    return filtered

def sort_by_risk_appetite(choices: List[ChoiceOutput], risk_appetite: str) -> List[ChoiceOutput]:
    """Sort choices according to the risk appetite criteria."""
    appetite = risk_appetite.upper()
    if appetite == "CONSERVATIVE":
        choices.sort(key=lambda x: (-x.admission_probability, -x.preference_score))
    elif appetite == "BALANCED":
        choices.sort(key=lambda x: (-x.final_score, -x.preference_score, -x.admission_probability))
    else:  # AGGRESSIVE
        choices.sort(key=lambda x: (x.admission_probability < 0.10, -x.preference_score, -x.admission_probability))
    return choices

def apply_upgrade_optimization(choices: List[ChoiceOutput], config: Optional[Dict[str, Any]] = None, exam: str = "JEE_MAIN") -> List[ChoiceOutput]:
    """Move reach options (>reach_lower_bound prob) exactly one position above the first safe option (>safe_probability)."""
    if exam.upper() in ("NEET", "MHT_CET", "KCET"):
        return choices
        
    if config is None:
        config = EXAM_COUNSELING_CONFIG.get(exam.upper(), EXAM_COUNSELING_CONFIG["JEE_MAIN"])
        
    if not config.get("has_upgrade_rounds", True):
        return choices
        
    safe_prob = config.get("safe_probability", 0.70)
    reach_lower = config.get("reach_lower_bound", 0.25)
    
    first_safe_idx = -1
    for i, c in enumerate(choices):
        if c.admission_probability > safe_prob:
            first_safe_idx = i
            break
            
    if first_safe_idx == -1:
        return choices
        
    before_safe = choices[:first_safe_idx]
    safe_and_after = choices[first_safe_idx:]
    reach_to_move = []
    remaining_safe_and_after = []
    
    for c in safe_and_after:
        if reach_lower < c.admission_probability <= safe_prob:
            reach_to_move.append(c)
        else:
            remaining_safe_and_after.append(c)
            
    return before_safe + reach_to_move + remaining_safe_and_after

def get_explanation_text(pos: int, prob: float, b_name: str, c_name: str) -> str:
    """Generate human-readable explanations for choice position."""
    if pos == 1:
        if prob <= 0.40:
            return f"Top dream choice ({b_name} at {c_name}) with aggressive reach."
        if prob <= 0.70:
            return f"Top preference choice ({b_name} at {c_name}) with moderate admission probability."
        return f"Top preference choice ({b_name} at {c_name}) with highly safe admission chance."
    if prob > 0.70:
        return f"Safe backup at Position {pos}: Excellent chance of admission for {b_name} at {c_name}."
    if prob > 0.25:
        return f"Upgrade option at Position {pos}: Good choice with realistic admission chance."
    return f"Long shot at Position {pos}: Low admission chance but valuable to fill above safe backups."

def generate_reason(item: ChoiceOutput, config: Dict[str, Any], exam: str) -> str:
    """Generate exam-specific reason explanations for the choice."""
    pos = item.choice_number or 1
    prob = item.admission_probability
    b_name = item.branch_name
    c_name = item.college_name
    
    exam_upper = exam.upper()
    if exam_upper == "MHT_CET":
        if pos == 1:
            return f"MHT-CET choice at Position 1: Auto-frozen if allotted. Ensure {b_name} at {c_name} is your dream option."
        return f"MHT-CET CAP Option {pos}: {b_name} at {c_name}."
    elif exam_upper == "NEET":
        if pos == 1:
            return f"Top dream medical choice ({b_name} at {c_name}) via MCC."
        return f"NEET choice at Position {pos}: {b_name} at {c_name}."
    else:
        return get_explanation_text(pos, prob, b_name, c_name)

def optimize_choice_list(
    colleges: List[CandidateCollege], pref: Preferences, home_state: str, risk_appetite: str, exam: str = "JEE_MAIN"
) -> List[ChoiceOutput]:
    """Scoring, sorting, and upgrading the candidate choices."""
    filtered_colleges = filter_colleges_by_exam(colleges, exam)
    choices = []
    for c in filtered_colleges:
        pref_score = compute_preference_score(c, pref, home_state)
        if risk_appetite.upper() == "BALANCED":
            final_score = 0.6 * pref_score + 0.4 * c.admission_probability
        elif risk_appetite.upper() == "CONSERVATIVE":
            final_score = c.admission_probability
        else:
            final_score = pref_score
            
        choices.append(ChoiceOutput(
            **c.model_dump(),
            preference_score=round(pref_score, 4),
            final_score=round(final_score, 4),
            explanation="",
            choice_number=None,
            label=get_choice_label(c.admission_probability, exam)
        ))
        
    sorted_choices = sort_by_risk_appetite(choices, risk_appetite)
    config = EXAM_COUNSELING_CONFIG.get(exam.upper(), EXAM_COUNSELING_CONFIG["JEE_MAIN"])
    optimized = apply_upgrade_optimization(sorted_choices, config, exam=exam)
    
    for i, c in enumerate(optimized):
        c.choice_number = i + 1
        c.explanation = generate_reason(c, config, exam)
        
    return optimized
