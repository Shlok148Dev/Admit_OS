"""Percentile to Merit Rank converter and cohort estimation engine for Indian entrance exams."""

from typing import Dict, Tuple, Optional

# Verified candidate cohorts (annual test-taker volume)
COHORTS: Dict[str, int] = {
    "JEE_MAIN": 1415000,       # ~1.41M JEE Main unique candidates
    "JEE_ADVANCED": 180000,    # ~180k qualified candidates
    "NEET": 2406000,           # ~2.4M NEET-UG candidates
    "MHT_CET": 375000,         # ~375k PCM/PCB engineering applicants
    "KCET": 275000,            # ~275k Karnataka CET applicants
}

def percentile_to_estimated_rank(percentile: float, exam: str) -> Tuple[int, int, int]:
    """
    Converts a raw percentile score into an estimated merit rank bracket.
    Returns: (estimated_mid_rank, rank_min, rank_max)
    Formula: Rank = (100 - Percentile) * (Total_Candidates / 100) + 1
    """
    cohort = COHORTS.get(exam.upper(), 1000000)
    percentile = max(0.0, min(100.0, float(percentile)))
    
    # Precise rank estimation
    calculated_rank = int(round(((100.0 - percentile) / 100.0) * cohort)) + 1
    calculated_rank = max(1, calculated_rank)
    
    # Margin of error based on standard tie-breaking density
    if percentile >= 99.5:
        margin = max(50, int(calculated_rank * 0.05))
    elif percentile >= 95.0:
        margin = max(200, int(calculated_rank * 0.04))
    elif percentile >= 85.0:
        margin = max(800, int(calculated_rank * 0.035))
    else:
        margin = max(1500, int(calculated_rank * 0.03))

    rank_min = max(1, calculated_rank - margin)
    rank_max = min(cohort, calculated_rank + margin)
    
    return calculated_rank, rank_min, rank_max

def rank_to_estimated_percentile(rank: int, exam: str) -> float:
    """Converts a merit rank back to an estimated percentile score."""
    cohort = COHORTS.get(exam.upper(), 1000000)
    rank = max(1, min(cohort, int(rank)))
    percentile = 100.0 - ((rank - 1) / cohort) * 100.0
    return round(max(0.0, min(100.0, percentile)), 4)

def calculate_sigmoid_probability(
    user_rank: int,
    closing_rank: int,
    category_modifier: float = 1.0,
    round_modifier: float = 1.0
) -> float:
    """
    Sigmoid / Logistic Probability Calibration:
    P(Admission) = 1 / (1 + e^( -k * (ClosingRank - UserRank) / sigma ))
    """
    import math
    effective_closing = closing_rank * category_modifier * round_modifier
    sigma = max(effective_closing * 0.12, 120.0)
    k = 2.0
    z = (k * (effective_closing - user_rank)) / sigma
    z_clamped = max(-50.0, min(50.0, z))
    raw_prob = 1.0 / (1.0 + math.exp(-z_clamped))
    return round(max(0.01, min(0.99, raw_prob)), 2)

# Alias for backward compatibility
calculateSigmoidProbability = calculate_sigmoid_probability
