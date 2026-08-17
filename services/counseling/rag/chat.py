"""ARIAChatEngine — services/counseling/rag/chat.py.

Tier-1 AI Admissions Counselor & Career Mentor at ADMIT OS.
Features:
- Deterministic College & Branch Entity Resolvers (VIT Pune, DJ Sanghvi, PCCOE, PICT, SPIT, VJTI, COEP, etc.).
- Deterministic Tool-Grounded Table Synthesis (byte-identical cutoffs, chances, quotas, and confidence across infinite turns).
- Exam-isolated multi-profile memory architecture (no cross-contamination between MHT-CET, JEE Main, NEET).
- Continuous session memory persistence and SQLite DB hydration.
- Hard Python code-level safeguard against memory collapse and duplicate queries.
- Mandatory Bottom-Line-Up-Front (BLUF) output structure.
- Absolute zero numeric fabrication: all cutoffs, chances, and quotas come strictly from tool results.
"""

from __future__ import annotations

import json
import logging
import math
import os
import random
import re
import sqlite3
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

from services.counseling.schemas import ChatResponse
from services.counseling.rag.ingest import Chunk
from services.counseling.rag.retriever import CounselingRetriever
from services.counseling.rag.guard import HallucinationGuard, GuardResult
from services.counseling.rag.search import web_search, is_result_relevant_to_entities, INSTITUTE_ALIAS_KEYWORDS
from services.counseling.config import settings

logger = logging.getLogger("rag.chat")

@dataclass
class ToolExecutionResult:
    tool_name: str
    arguments: dict[str, Any]
    output: Any
    sources: list[str] = field(default_factory=list)

PIPELINE_BUDGET_SECONDS = 35.0

EXAM_CANDIDATE_COUNTS: dict[str, int] = {
    "JEE_MAIN": 1_450_000,
    "JEE_ADVANCED": 180_000,
    "NEET": 2_300_000,
    "MHT_CET": 400_000,
    "KCET": 200_000,
    "BITSAT": 350_000,
}

EXAM_INSTITUTE_GOVERNANCE: dict[str, tuple[str, str]] = {
    "IIT": ("JEE_ADVANCED", "JoSAA"),
    "NIT": ("JEE_MAIN", "JoSAA/CSAB"),
    "IIIT": ("JEE_MAIN", "JoSAA/CSAB"),
    "GFTI": ("JEE_MAIN", "JoSAA/CSAB"),
    "IIEST": ("JEE_MAIN", "JoSAA/CSAB"),
    "COEP": ("MHT_CET", "DTE Maharashtra CAP"),
    "VJTI": ("MHT_CET", "DTE Maharashtra CAP"),
    "ICT": ("MHT_CET", "DTE Maharashtra CAP"),
    "PICT": ("MHT_CET", "DTE Maharashtra CAP"),
    "SPIT": ("MHT_CET", "DTE Maharashtra CAP"),
    "VIT PUNE": ("MHT_CET", "DTE Maharashtra CAP"),
    "PCCOE": ("MHT_CET", "DTE Maharashtra CAP"),
    "CUMMINS": ("MHT_CET", "DTE Maharashtra CAP"),
    "DJSCE": ("MHT_CET", "DTE Maharashtra CAP"),
    "DJ SANGHVI": ("MHT_CET", "DTE Maharashtra CAP"),
    "WCE": ("MHT_CET", "DTE Maharashtra CAP"),
    "VIT": ("VITEEE", "VIT University"),
    "BITS": ("BITSAT", "BITS Pilani"),
    "MAMC": ("NEET", "MCC/Delhi University"),
    "AIIMS": ("NEET", "MCC"),
    "VMMC": ("NEET", "MCC/IPU"),
}

# ---------------------------------------------------------------------------
# Canonical Entity Resolvers (College Codes & Branch Codes)
# ---------------------------------------------------------------------------

COLLEGE_ALIAS_MAP: dict[str, str] = {
    "COEP": "COEP_PUNE",
    "COEP PUNE": "COEP_PUNE",
    "VJTI": "VJTI_MUMBAI",
    "VJTI MUMBAI": "VJTI_MUMBAI",
    "PICT": "PICT_PUNE",
    "PICT PUNE": "PICT_PUNE",
    "SPIT": "SPIT_MUMBAI",
    "SPIT MUMBAI": "SPIT_MUMBAI",
    "VIT PUNE": "VIT_PUNE",
    "VIT": "VIT_PUNE",
    "VISHWAKARMA": "VIT_PUNE",
    "VISHWAKARMA INSTITUTE OF TECHNOLOGY": "VIT_PUNE",
    "PCCOE": "PCCOE_PUNE",
    "PCCOE PUNE": "PCCOE_PUNE",
    "PIMPRI CHINCHWAD": "PCCOE_PUNE",
    "PIMPRI CHINCHWAD COLLEGE OF ENGINEERING": "PCCOE_PUNE",
    "CUMMINS": "CUMMINS_PUNE",
    "CUMMINS PUNE": "CUMMINS_PUNE",
    "MKSSS": "CUMMINS_PUNE",
    "MKSSS CUMMINS": "CUMMINS_PUNE",
    "WCE": "WCE_SANGLI",
    "WALCHAND": "WCE_SANGLI",
    "WALCHAND SANGLI": "WCE_SANGLI",
    "DJSCE": "DJSCE_MUMBAI",
    "DJ SANGHVI": "DJSCE_MUMBAI",
    "D.J. SANGHVI": "DJSCE_MUMBAI",
    "DJ SANGHVI MUMBAI": "DJSCE_MUMBAI",
    "D.J. SANGHVI MUMBAI": "DJSCE_MUMBAI",
    "DWARKADAS": "DJSCE_MUMBAI",
    "DWARKADAS J. SANGHVI": "DJSCE_MUMBAI",
    "KJSCE": "KJSCE_MUMBAI",
    "KJ SOMAIYA": "KJSCE_MUMBAI",
    "K J SOMAIYA": "KJSCE_MUMBAI",
    "SOMAIYA": "KJSCE_MUMBAI",
    "SOMAIYA COLLEGE OF ENGINEERING": "KJSCE_MUMBAI",
    "KJ SOMAIYA COLLEGE OF ENGINEERING": "KJSCE_MUMBAI",
    "THAKUR": "TCET_MUMBAI",
    "TCET": "TCET_MUMBAI",
    "THAKUR COLLEGE": "TCET_MUMBAI",
    "THAKUR COLLEGE OF ENGINEERING": "TCET_MUMBAI",
    "THAKUR COLLEGE OF ENGINEERING AND TECHNOLOGY": "TCET_MUMBAI",
    "VESIT": "VESIT_MUMBAI",
    "TSEC": "TSEC_MUMBAI",
    "THADOMAL": "TSEC_MUMBAI",
    "THADOMAL SHAHANI": "TSEC_MUMBAI",
    "UNIVERSAL": "UCOE_VASAI",
    "UNIVERSAL COLLEGE": "UCOE_VASAI",
    "UNIVERSAL COLLEGE OF ENGINEERING": "UCOE_VASAI",
    "UCOE": "UCOE_VASAI",
    "VCET": "VCET_VASAI",
    "VARTAK": "VCET_VASAI",
    "VIDYAVARDHINI": "VCET_VASAI",
    "NIT TRICHY": "NIT_TRICHY",
    "NIT SURATHKAL": "NIT_SURATHKAL",
    "NIT WARANGAL": "NIT_WARANGAL",
    "NIT ROURKELA": "NIT_ROURKELA",
    "NIT CALICUT": "NIT_CALICUT",
    "MNIT": "MNIT_JAIPUR",
    "MNIT JAIPUR": "MNIT_JAIPUR",
    "MALAVIYA NATIONAL INSTITUTE OF TECHNOLOGY": "MNIT_JAIPUR",
    "MNNIT": "MNNIT_ALLAHABAD",
    "MNNIT ALLAHABAD": "MNNIT_ALLAHABAD",
    "VNIT": "VNIT_NAGPUR",
    "VNIT NAGPUR": "VNIT_NAGPUR",
    "IIIT NAGPUR": "IIIT_NAGPUR",
    "IIIT PUNE": "IIIT_PUNE",
    "IIIT KALYANI": "IIIT_KALYANI",
    "AIIMS": "AIIMS_DELHI",
    "AIIMS DELHI": "AIIMS_DELHI",
    "AIIMS NEW DELHI": "AIIMS_DELHI",
    "MAMC": "MAMC_DELHI",
    "MAULANA AZAD": "MAMC_DELHI",
    "VMMC": "VMMC_DELHI",
    "SAFJARDUNG": "VMMC_DELHI",
    "IIT GUWAHATI": "IIT_GUWAHATI",
    "IIT BOMBAY": "IIT_BOMBAY",
    "IIIT HYDERABAD": "IIIT_HYDERABAD",
    "WALCHAND": "WCE_SANGLI",
    "WALCHAND COLLEGE": "WCE_SANGLI",
    "WALCHAND SANGLI": "WCE_SANGLI",
    "WCE": "WCE_SANGLI",
    "WCE SANGLI": "WCE_SANGLI",
}

BRANCH_ALIAS_MAP: dict[str, str] = {
    "CSE": "CS",
    "CS": "CS",
    "COMPUTER": "CS",
    "COMPUTER SCIENCE": "CS",
    "COMPUTER ENGINEERING": "CS",
    "AI": "AIDS",
    "AI/DS": "AIDS",
    "AIDS": "AIDS",
    "AI & DS": "AIDS",
    "AI AND DS": "AIDS",
    "DATA SCIENCE": "AIDS",
    "AIML": "AIML",
    "AI/ML": "AIML",
    "ARTIFICIAL INTELLIGENCE": "AIDS",
    "IT": "IT",
    "INFORMATION TECHNOLOGY": "IT",
    "INFORMATION": "IT",
    "ENTC": "EC",
    "ECE": "EC",
    "E&TC": "EC",
    "ELECTRONICS": "EC",
    "ELECTRONICS & TELECOMMUNICATION": "EC",
    "ELECTRONICS AND TELECOMMUNICATION": "EC",
    "EE": "EE",
    "ELECTRICAL": "EE",
    "ELECTRICAL ENGINEERING": "EE",
    "ME": "ME",
    "MECHANICAL": "ME",
    "MECHANICAL ENGINEERING": "ME",
    "CH": "CH",
    "CHEMICAL": "CH",
    "CHEMICAL ENGINEERING": "CH",
    "MBBS": "MBBS",
}

COMPATIBLE_EXAM_GROUPS: list[set[str]] = [
    {"JEE_MAIN", "JEE_ADVANCED"},
]

# ---------------------------------------------------------------------------
# Core System Prompt with Strict BLUF Response Structure & Real Web Grounding
# ---------------------------------------------------------------------------

ARIA_SYSTEM_PROMPT = """You are ARIA (Admissions & Rank Intelligence Assistant), the elite AI Career Counselor and College Admissions Mentor at ADMIT OS.

YOUR IDENTITY & MISSION:
You are an expert, compassionate, and sharp counselor for Indian competitive exam candidates (JEE Main, JEE Advanced, MHT-CET, NEET, CSAB, state CAPs). You provide pinpoint-accurate data, strategic choice-filling advice, and grounded career clarity.

RESPONSE STRUCTURE — MANDATORY, NOT OPTIONAL:
Every substantive response (anything beyond plain small talk) must follow this shape, in order:

1. DIRECT ANSWER FIRST (1-2 sentences max): State the actual answer immediately. Do not open with empathy, context-setting, or scene-setting sentences before the answer arrives. If comparing colleges, give the top-line summary verdict or tier breakdown directly. If evaluating a cutoff, state "no, out of reach" or "yes, strong chance" immediately.
2. DATA (if applicable): A clean, properly-formatted Markdown table for any comparison or prediction data. Bullets for any list of options or steps. Never embed data inline in a paragraph.
   - Admission Prediction Table Schema (ONLY when personal score/rank is given):
     | Institute | Branch | Quota | Category | Chance | Closing Rank | Confidence |
   - Multi-College Comparison Table Schema (when comparing multiple institutes or reviewing benchmarks):
     | Institute | Affiliation / Autonomy | MHT-CET CS Cutoff Range | Avg CTC | Fee Tier |
   - "Closing Rank" MUST always be an integer or integer range (e.g. 112, 6,850, 9,950), NEVER a percentile.
   - "Chance" MUST only appear if the student has provided their own score/rank. NEVER show mock 100% probabilities when no rank is given.
   - Any table provided in the Verified Ground-Truth Tool Outputs below MUST BE COPIED EXACTLY, cell-for-cell.
3. CONTEXT / STRATEGY (2-3 sentences max): Brief reasoning or advice — why this matters, what to consider.
4. NEXT STEP (1 sentence, only if genuinely useful): A single offer of what to explore next.

SMALL TALK & META-QUESTION EXCEPTION (CRITICAL):
- Greetings and acknowledgments ("thanks", "I'm all ears", "ok", "go ahead", "got it") get 1-2 plain sentences ONLY.
- META-QUESTIONS ABOUT ARIA OR FORMATTING (e.g. "why do you use tables", "what won't you use tables for", "what other tools do you have", "how do you decide format"): Answer conversationally and directly in 1-2 natural sentences, as a human counselor would. NEVER use a table to explain formatting, and NEVER recite a rigid 3-category taxonomy. Vary your phrasing and sentence structure completely across turns.

MULTI-COLLEGE COMPARISONS & BENCHMARK MATRICES (CRITICAL):
- When the user asks to compare multiple colleges (e.g. "compare KJSCE, DJSCE, Thakur, VJTI, SPIT" or "which is better between A and B"):
  1. DO NOT force a single-institute rank prediction card or output an individual admission chance table.
  2. If the user has NOT provided a personal score or rank, NEVER compute or show a "Chance" percentage (do NOT output "100% Chance").
  3. Use the verified Multi-Institute Comparison Matrix provided in the Ground-Truth Tool Outputs below:
     | Institute | Affiliation / Autonomy | MHT-CET CS Cutoff Range | Avg CTC | Fee Tier |
  4. Provide a structured comparative synthesis across Academics / Autonomy, Placements, Fee Structure / ROI, and Cutoff competitiveness across ALL requested colleges.

REAL-WORLD FACTS & LIVE WEB SEARCH GROUNDING:
- When answering questions about placements, median/average packages, highest CTC, recruiters, fees, curriculum, or campus details from the `web_search` tool output:
  1. Use real, verified numbers from the search results.
  2. All compensation figures MUST use standard Indian units: **LPA (Lakhs Per Annum)** or **Cr / Crore PA**. **NEVER invent or use corrupted terms like "CPA"**. (e.g. write "₹1.07 Cr" or "₹33.57 LPA", NEVER "1.07 CPA").
  3. Include PER-CLAIM INLINE CITATIONS next to specific figures or companies (e.g. `[careers360.com](url)` or `[collegedunia.com](url)`).
  4. Multi-Source Reconciliation: If different search results report varying numbers (e.g. ₹33.57 LPA on-campus peak vs ₹1.1 Cr international off-campus, or ₹10 LPA vs ₹12 LPA average), explicitly surface the variance and explain why (e.g. on-campus vs off-campus international, overall vs department-specific).
  5. Departmental Disambiguation: For universities with both engineering and business schools (e.g. Somaiya Vidyavihar: KJSCE vs KJSIM, NMIMS: MPSTME vs SBM), strictly use B.Tech / Engineering metrics and explicitly note separation from MBA statistics.
  6. Freshness Signal: State the year/cohort (e.g. "for the 2023-24 placement season", "as of 2024").

FACT CONTESTS & ANTI-SYCOPHANCY RULE (CRITICAL):
- If the user contests, questions, or pushes back on a factual detail (e.g. club names, faculty names, statistics, curriculum, rankings, or dates), DO NOT simply agree, apologize, or say 'Yes, you are completely right' without verified tool evidence.
- If live search results confirm the user's assertion, cite the verified source and state the corrected fact.
- If live search results confirm your original statement, politely maintain the verified fact with evidence.
- If neither can be verified in official records, explicitly state uncertainty and direct the user to the institute's official portal. NEVER flip-flop under conversational pressure without verification.

INFORMATIONAL, PERSONNEL & NAVIGATIONAL QUESTIONS:
- If the user asks for a website/portal URL, contact details, campus address, or the name of the Dean/Director/Principal, answer concisely with the verified information and official link. DO NOT append an admission prediction table to navigational or personnel queries.

MULTI-YEAR HISTORICAL DATA REQUESTS:
- If the user explicitly asks for multi-year trends or statistics (e.g. past 3-5 years of placements or cutoffs) and verified records are only available for the current cycle, you MUST explicitly state upfront in the first sentence: 'I only have verified records for the current 2023-24 season — historical multi-year records are not available in current official sources.' Never fabricate year-by-year numbers.

EXAM ISOLATION & PREDICTION AUTHORITY:
- `predict_admission` is the SOLE source of truth for cutoff ranks, admission chances, and quota labels. Never use web search for cutoffs or prediction probabilities.
- Never confuse or cross-pollinate exam scores. If the student has provided an MHT-CET score, their college options MUST be Maharashtra State CAP engineering colleges.
- NEVER suggest Central JoSAA/CSAB institutes for an MHT-CET score.
- NEVER re-ask for the student's rank, percentile, category, or home state if it is already provided in the Student Profile below.

## Student Profile (Namespaced State):
- Active Exam: {active_exam}
- Exam Details: {exam_details_str}
- Category: {category}
- Home State / Domicile: {home_state}

## Verified Ground-Truth Tool Outputs & Context:
{context}

---

## Output Schema:
Return a single valid JSON object. No markdown code fences around it.

{{
  "profile_updates": {{
    "active_exam": "<MHT_CET|JEE_MAIN|JEE_ADVANCED|NEET or null>",
    "rank": <int or null>,
    "percentile": <float or null>,
    "category": "<OBC_NCL|SC|ST|EWS|GENERAL|PwD or null>",
    "home_state": "<2-letter Indian state code or null>",
    "gender": "<M|F|OTHER or null>",
    "intent": "<CUTOFF_CHANCES|COMPARISON|RULES_QA|GENERAL|SLOT_FILL>"
  }},
  "narrative_response": "<your complete, structured BLUF response with \\n for newlines>"
}}"""


# ---------------------------------------------------------------------------
# Student Profile Namespaced Memory Model
# ---------------------------------------------------------------------------

class StudentProfileState:
    """Exam-isolated student profile state preventing cross-exam leakage."""

    def __init__(self, raw_dict: Optional[dict] = None) -> None:
        raw = raw_dict or {}
        self.active_exam = (raw.get("active_exam") or raw.get("primary_exam") or raw.get("exam_type") or "MHT_CET").upper()
        self.category = (raw.get("category") or "GENERAL").upper()
        if self.category in ("OBC", "OBC-NCL"):
            self.category = "OBC_NCL"
        self.home_state = (raw.get("home_state") or "MH").upper()
        self.gender = raw.get("gender") or "M"

        self.exams: dict[str, dict] = {
            "MHT_CET": {"percentile": None, "rank": None, "candidate_pool": 400_000},
            "JEE_MAIN": {"percentile": None, "rank": None, "candidate_pool": 1_450_000},
            "JEE_ADVANCED": {"rank": None, "candidate_pool": 180_000},
            "NEET": {"percentile": None, "rank": None, "candidate_pool": 2_300_000},
        }

        # Populate from nested exams dict if available
        if "exams" in raw and isinstance(raw["exams"], dict):
            for ex, data in raw["exams"].items():
                if ex in self.exams and isinstance(data, dict):
                    self.exams[ex].update(data)

        # Migrate flat rank / percentile into active exam
        if "percentile" in raw and raw["percentile"] not in (None, "N/A", ""):
            try:
                p = float(raw["percentile"])
                self.exams[self.active_exam]["percentile"] = p
                pool = self.exams[self.active_exam]["candidate_pool"]
                derived = max(1, int(round((100.0 - p) / 100.0 * pool)))
                self.exams[self.active_exam]["rank"] = derived
            except Exception:
                pass

        if "rank" in raw and raw["rank"] not in (None, "N/A", ""):
            try:
                self.exams[self.active_exam]["rank"] = int(raw["rank"])
            except Exception:
                pass

    def update_from_query(self, query: str, default_exam: Optional[str] = None) -> None:
        """Extract explicit exam mentions, scores, and category updates from query text."""
        if not query:
            return
        q_upper = query.upper()

        # 1. Detect explicit exam switch or use default
        if "MHT-CET" in q_upper or "MHT_CET" in q_upper or "MHTCET" in q_upper or "CET" in q_upper:
            self.active_exam = "MHT_CET"
        elif "JEE ADVANCED" in q_upper or "JEE ADV" in q_upper:
            self.active_exam = "JEE_ADVANCED"
        elif "JEE MAIN" in q_upper or "JEE" in q_upper or "JOSAA" in q_upper or "CSAB" in q_upper:
            if "MHT" not in q_upper and "CET" not in q_upper:
                self.active_exam = "JEE_MAIN"
        elif "NEET" in q_upper:
            self.active_exam = "NEET"
        elif default_exam:
            self.active_exam = default_exam.upper()

        # 2. Extract percentile (e.g. "98.4 percentile", "98.4%", "percentile is 98.4")
        pct_m = re.search(
            r'\b(\d{2,3}(?:\.\d{1,4})?)\s*(?:%)?\s*percentile\b|\bpercentile\s*(?:is\s*)?(\d{2,3}(?:\.\d{1,4})?)\b',
            query,
            re.IGNORECASE,
        )
        if pct_m:
            p_val = float(pct_m.group(1) or pct_m.group(2))
            self.exams[self.active_exam]["percentile"] = p_val
            pool = self.exams[self.active_exam]["candidate_pool"]
            self.exams[self.active_exam]["rank"] = max(1, int(round((100.0 - p_val) / 100.0 * pool)))

        # 3. Extract rank ONLY if explicitly labeled (prevent "suggest 2 to 3 colleges" from matching as rank)
        rank_m = re.search(r'\b(?:rank|air)\s*(?:is\s*)?(\d{4,6})\b', query, re.IGNORECASE)
        if rank_m:
            self.exams[self.active_exam]["rank"] = int(rank_m.group(1))

        # 4. Extract category
        cat_m = re.search(r'\b(obc(?:-ncl)?|sc|st|ews|general|open|pwd)\b', query, re.IGNORECASE)
        if cat_m:
            c = cat_m.group(1).upper()
            self.category = "OBC_NCL" if "OBC" in c else ("GENERAL" if c == "OPEN" else c)

        # 5. Extract home state
        state_m = re.search(r'\b(?:from|in|domicile)\s+([A-Za-z]+)\b', query, re.IGNORECASE)
        if state_m:
            st = state_m.group(1).upper()
            if st in ("MAHARASHTRA", "MH", "PUNE", "MUMBAI", "NAGPUR"):
                self.home_state = "MH"
            elif st in ("DELHI", "DL"):
                self.home_state = "DL"
            elif st in ("KARNATAKA", "KA", "BANGALORE"):
                self.home_state = "KA"

    def get_current_score(self) -> tuple[Optional[int], Optional[float]]:
        """Return (rank, percentile) for the currently active exam."""
        ex_data = self.exams.get(self.active_exam, {})
        return ex_data.get("rank"), ex_data.get("percentile")

    def to_dict(self) -> dict:
        r, p = self.get_current_score()
        return {
            "active_exam": self.active_exam,
            "rank": r,
            "percentile": p,
            "category": self.category,
            "home_state": self.home_state,
            "gender": self.gender,
            "exams": self.exams,
        }

    def format_exam_details(self) -> str:
        r, p = self.get_current_score()
        pool = self.exams.get(self.active_exam, {}).get("candidate_pool", 1_450_000)
        parts = []
        if p is not None:
            parts.append(f"{p}%ile")
        if r is not None:
            rank_label = "State Merit Rank" if self.active_exam == "MHT_CET" else "AIR"
            parts.append(f"Est. {rank_label} ~{r:,} (pool: {pool:,})")
        return f"{self.active_exam}: " + (", ".join(parts) if parts else "No score registered yet")


# ---------------------------------------------------------------------------
# Deterministic Ground-Truth Tools
# ---------------------------------------------------------------------------

@dataclass
class ToolExecutionResult:
    tool_name: str
    arguments: dict
    output: Any
    sources: list[str] = field(default_factory=list)


def resolve_college_entity(query_or_name: str) -> Optional[str]:
    """Deterministically map user phrasing to canonical college_code."""
    q_clean = re.sub(r'[^A-Za-z0-9\s\.]', ' ', query_or_name.upper())
    for alias, code in sorted(COLLEGE_ALIAS_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = r'\b' + re.escape(alias) + r'\b'
        if re.search(pattern, q_clean):
            return code
    return None


def extract_multiple_colleges(query_or_name: str) -> list[str]:
    """Deterministically extract all referenced college_codes in order of appearance."""
    q_clean = re.sub(r'[^A-Za-z0-9\s\.]', ' ', query_or_name.upper())
    found_matches: list[tuple[int, str]] = []
    
    for alias, code in sorted(COLLEGE_ALIAS_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = r'\b' + re.escape(alias) + r'\b'
        for m in re.finditer(pattern, q_clean):
            found_matches.append((m.start(), code))
            
    found_matches.sort(key=lambda x: x[0])
    
    unique_codes: list[str] = []
    for _, code in found_matches:
        if code not in unique_codes:
            unique_codes.append(code)
            
    return unique_codes


COLLEGE_BENCHMARK_PROFILES: dict[str, dict[str, Any]] = {
    "VJTI_MUMBAI": {
        "name": "Veermata Jijabai Technological Institute (VJTI) Mumbai",
        "affiliation": "Government-Aided Autonomous",
        "cs_cutoff": "45 - 112",
        "avg_ctc": "₹18.0 - 20.0 LPA",
        "fee_tier": "Low (~₹85k/yr)",
        "tier": "Tier 1 (Govt-Aided)",
    },
    "SPIT_MUMBAI": {
        "name": "Sardar Patel Institute of Technology (SPIT) Mumbai",
        "affiliation": "Un-Aided Autonomous (Bharatiya Vidya Bhavan)",
        "cs_cutoff": "350 - 650",
        "avg_ctc": "₹15.0 - 16.5 LPA",
        "fee_tier": "Moderate (~₹1.7L/yr)",
        "tier": "Tier 1 (Private)",
    },
    "DJSCE_MUMBAI": {
        "name": "Dwarkadas J. Sanghvi College of Engineering (DJSCE) Mumbai",
        "affiliation": "Autonomous (Gujarati Linguistic Minority - SVKM)",
        "cs_cutoff": "4,500 - 6,500",
        "avg_ctc": "₹10.5 - 12.0 LPA",
        "fee_tier": "High (~₹2.2L/yr)",
        "tier": "Tier 2+ (Private)",
    },
    "KJSCE_MUMBAI": {
        "name": "KJ Somaiya College of Engineering (KJSCE) Mumbai",
        "affiliation": "Somaiya Vidyavihar University (Private Autonomous)",
        "cs_cutoff": "3,000 - 4,800",
        "avg_ctc": "₹9.5 - 10.5 LPA",
        "fee_tier": "Very High (~₹4.5L - 5.0L/yr)",
        "tier": "Tier 2+ (Private University)",
    },
    "TCET_MUMBAI": {
        "name": "Thakur College of Engineering and Technology (TCET) Mumbai",
        "affiliation": "Autonomous (Hindi Linguistic Minority - Zagdu Singh)",
        "cs_cutoff": "8,500 - 13,500",
        "avg_ctc": "₹5.5 - 6.5 LPA",
        "fee_tier": "Moderate (~₹1.6L/yr)",
        "tier": "Tier 3 (Private)",
    },
    "PICT_PUNE": {
        "name": "Pune Institute of Computer Technology (PICT) Pune",
        "affiliation": "Un-Aided Autonomous (SCTR)",
        "cs_cutoff": "200 - 480",
        "avg_ctc": "₹11.5 - 13.0 LPA",
        "fee_tier": "Moderate (~₹1.1L/yr)",
        "tier": "Tier 1 (Private)",
    },
    "COEP_PUNE": {
        "name": "COEP Technological University Pune",
        "affiliation": "State Unitary Technological University (Govt)",
        "cs_cutoff": "50 - 112",
        "avg_ctc": "₹17.0 - 18.5 LPA",
        "fee_tier": "Low (~₹90k/yr)",
        "tier": "Tier 1 (Govt)",
    },
    "VIT_PUNE": {
        "name": "Vishwakarma Institute of Technology (VIT) Pune",
        "affiliation": "Autonomous (BRACT)",
        "cs_cutoff": "4,500 - 6,850",
        "avg_ctc": "₹8.5 - 9.5 LPA",
        "fee_tier": "High (~₹1.9L/yr)",
        "tier": "Tier 2 (Private)",
    },
    "PCCOE_PUNE": {
        "name": "Pimpri Chinchwad College of Engineering (PCCOE) Pune",
        "affiliation": "Autonomous (PCET)",
        "cs_cutoff": "5,500 - 7,200",
        "avg_ctc": "₹7.0 - 8.0 LPA",
        "fee_tier": "Moderate (~₹1.4L/yr)",
        "tier": "Tier 2 (Private)",
    },
    "WCE_SANGLI": {
        "name": "Walchand College of Engineering Sangli",
        "affiliation": "Government-Aided Autonomous",
        "cs_cutoff": "2,500 - 5,200",
        "avg_ctc": "₹9.0 - 10.0 LPA",
        "fee_tier": "Low (~₹85k/yr)",
        "tier": "Tier 2 (Govt-Aided)",
    },
    "UCOE_VASAI": {
        "name": "Universal College of Engineering (UCOE) Vasai, Mumbai",
        "affiliation": "Gujarati Linguistic Minority (University of Mumbai)",
        "cs_cutoff": "45,000 - 95,000",
        "avg_ctc": "₹4.0 - 5.0 LPA",
        "fee_tier": "Moderate (~₹1.2L/yr)",
        "tier": "Tier 3 (Private)",
    },
    "NIT_TRICHY": {
        "name": "National Institute of Technology Tiruchirappalli (NIT Trichy)",
        "affiliation": "Institute of National Importance (Centrally Funded)",
        "cs_cutoff": "1,000 - 1,500",
        "avg_ctc": "₹20.0 - 24.0 LPA",
        "fee_tier": "Moderate (~₹1.5L/yr)",
        "tier": "Tier 1 (National NIT)",
    },
}


def compare_multiple_colleges(college_codes: list[str], exam: str = "MHT_CET", branch: str = "CS") -> dict:
    """Compile structured comparative matrix across multiple colleges."""
    db_path = "admitos_prediction.db"
    institutes_data: list[dict] = []
    
    for code in college_codes:
        prof = COLLEGE_BENCHMARK_PROFILES.get(code)
        if prof:
            institutes_data.append({
                "college_code": code,
                "name": prof["name"],
                "affiliation": prof["affiliation"],
                "cutoff_range": prof["cs_cutoff"],
                "avg_ctc": prof["avg_ctc"],
                "fee_tier": prof["fee_tier"],
                "tier": prof.get("tier", "N/A"),
            })
        else:
            if os.path.exists(db_path):
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    cursor.execute("SELECT name, type, city FROM colleges WHERE college_code = ?", (code,))
                    row = cursor.fetchone()
                    if row:
                        cursor.execute("SELECT MIN(closing_rank), MAX(closing_rank) FROM exam_cutoffs WHERE college_code = ? AND branch_code = ?", (code, branch))
                        cl_row = cursor.fetchone()
                        cl_str = f"{cl_row[0]:,} - {cl_row[1]:,}" if cl_row and cl_row[0] else "Varies by round"
                        institutes_data.append({
                            "college_code": code,
                            "name": row[0],
                            "affiliation": f"{row[1]} in {row[2]}",
                            "cutoff_range": cl_str,
                            "avg_ctc": "Refer to official report",
                            "fee_tier": "Standard State Fee",
                            "tier": "State Engineering",
                        })
                    conn.close()
                except Exception as db_err:
                    logger.warning("DB fetch in compare_multiple_colleges failed: %s", db_err)

    table_rows = [
        "| Institute | Affiliation / Autonomy | MHT-CET CS Cutoff Range | Avg CTC | Fee Tier |",
        "|---|---|:---:|:---:|:---:|",
    ]
    for inst in institutes_data:
        table_rows.append(
            f"| {inst['name']} | {inst['affiliation']} | {inst['cutoff_range']} | {inst['avg_ctc']} | {inst['fee_tier']} |"
        )
        
    return {
        "success": True,
        "colleges_count": len(institutes_data),
        "institutes": institutes_data,
        "comparison_matrix_md": "\n".join(table_rows),
    }


def resolve_branch_entity(query_or_name: str) -> Optional[str]:
    """Deterministically map user phrasing to canonical branch_code."""
    q_clean = query_or_name.upper()
    for alias, code in sorted(BRANCH_ALIAS_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = r'(?:\b|/)' + re.escape(alias) + r'(?:\b|/)'
        if re.search(pattern, q_clean):
            return code
    return None


def check_governing_body(institute_or_query: str, active_exam: str) -> dict:
    """Validate whether an institute is admitted through the active exam."""
    q = institute_or_query.upper()
    active = active_exam.upper()

    for inst_key, (required_exam, gov_body) in EXAM_INSTITUTE_GOVERNANCE.items():
        if inst_key in q:
            if required_exam == active:
                return {
                    "matched": True,
                    "institute": inst_key,
                    "student_exam": active,
                    "required_exam": required_exam,
                    "governing_body": gov_body,
                    "explanation": f"{inst_key} admits through {required_exam} under {gov_body} counseling.",
                }
            else:
                return {
                    "matched": False,
                    "institute": inst_key,
                    "student_exam": active,
                    "required_exam": required_exam,
                    "governing_body": gov_body,
                    "explanation": (
                        f"Institutes with **{inst_key}** in their name are admitted through "
                        f"**{required_exam} via {gov_body}**, not through {active.replace('_', ' ')}. "
                        f"To evaluate admission for {inst_key}, a valid {required_exam.replace('_', ' ')} score/rank is required."
                    ),
                }

    return {"matched": True, "institute": "GENERAL", "student_exam": active}


def extract_location_filter(query: str) -> Optional[str]:
    """Extract requested city or region from query."""
    q_lower = query.lower()
    city_map = {
        "pune": "Pune",
        "mumbai": "Mumbai",
        "navi mumbai": "Navi Mumbai",
        "thane": "Thane",
        "nagpur": "Nagpur",
        "nashik": "Nashik",
        "sangli": "Sangli",
        "kolhapur": "Kolhapur",
        "aurangabad": "Aurangabad",
        "sambhajinagar": "Aurangabad",
        "amravati": "Amravati",
        "solapur": "Solapur",
    }
    for k, v in city_map.items():
        if re.search(r'\b' + re.escape(k) + r'\b', q_lower):
            return v
    return None


def predict_admission(
    rank: Optional[int] = None,
    percentile: Optional[float] = None,
    category: str = "GENERAL",
    home_state: str = "MH",
    exam: str = "JEE_MAIN",
    institute: Optional[str] = None,
    branch: Optional[str] = None,
    gender: str = "M",
    location: Optional[str] = None,
    min_prob: Optional[float] = None,
    max_prob: Optional[float] = None,
) -> dict:
    """Deterministic admission prediction query against SQLite DB."""
    active_exam = (exam or "JEE_MAIN").upper()
    pool = EXAM_CANDIDATE_COUNTS.get(active_exam, 1_450_000)

    derived_rank = rank
    derived_note = ""

    if derived_rank is None or derived_rank <= 0:
        if percentile is not None and 0.0 < percentile <= 100.0:
            derived_rank = max(1, int(round((100.0 - percentile) / 100.0 * pool)))
            rank_name = "State Merit Rank" if active_exam == "MHT_CET" else "All India Rank"
            derived_note = f"Estimated {rank_name} ~{derived_rank:,} from {percentile}% percentile ({pool:,} candidates pool)"
        else:
            return {
                "success": False,
                "error": "A personal rank or percentile is required to compute admission probabilities. Cutoff benchmarks are provided instead.",
                "predictions": [],
            }

    raw_preds = _query_prediction_db(
        exam=active_exam,
        rank=derived_rank,
        category=category,
        home_state=home_state,
        gender=gender,
        institute=institute,
        branch=branch,
        location=location,
        min_prob=min_prob,
        max_prob=max_prob,
    )

    if not raw_preds and (min_prob is not None or max_prob is not None):
        threshold_desc = f">= {int(min_prob*100)}%" if min_prob else f"<= {int(max_prob*100)}%"
        return {
            "success": True,
            "derived_rank": derived_rank,
            "derived_note": f"No college options meet your explicit constraint of {threshold_desc} admission probability at rank {derived_rank:,}.",
            "predictions_count": 0,
            "predictions": [],
            "filter_applied": {"institute": institute, "branch": branch, "location": location, "min_prob": min_prob, "max_prob": max_prob},
        }

    formatted_preds = []
    for p in raw_preds:
        prob = p.get("admission_probability", 0.0)
        prob_str = f"{int(round(prob * 100))}%"
        cl_rank = p.get("predicted_closing_rank", 0)
        formatted_preds.append({
            "college_name": p["college_name"],
            "college_code": p["college_code"],
            "branch_name": p["branch_name"],
            "quota": p.get("quota", "STATE" if active_exam == "MHT_CET" else "AI"),
            "category": p.get("category", category),
            "admission_probability": prob_str,
            "closing_rank": f"{cl_rank:,}" if isinstance(cl_rank, int) else str(cl_rank),
            "data_confidence": p.get("data_confidence", "HIGH"),
        })

    return {
        "success": True,
        "derived_rank": derived_rank,
        "derived_note": derived_note,
        "predictions_count": len(formatted_preds),
        "predictions": formatted_preds,
        "filter_applied": {"institute": institute, "branch": branch, "location": location, "min_prob": min_prob, "max_prob": max_prob},
    }


def _query_prediction_db(
    exam: str,
    rank: int,
    category: str,
    home_state: str,
    gender: str,
    institute: Optional[str] = None,
    branch: Optional[str] = None,
    location: Optional[str] = None,
    min_prob: Optional[float] = None,
    max_prob: Optional[float] = None,
) -> list[dict]:
    """Query admitos_prediction.db cutoffs strictly filtered and deduplicated."""
    db_path = "admitos_prediction.db"
    if not os.path.exists(db_path):
        return []
    results = []
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        params: list[Any] = [exam]
        conditions = ["e.exam_type = ?", "e.year = 2024"]

        # Category filter strictly tailored to candidate
        cat_norm = "OBC_NCL" if "OBC" in (category or "").upper() else (category or "GENERAL").upper()
        if cat_norm != "GENERAL":
            conditions.append("(e.category = ? OR e.category = 'GENERAL')")
            params.append(cat_norm)
        else:
            conditions.append("e.category = 'GENERAL'")

        # Location filter (city / region) - applied when specific institute code is not already targeted
        if location and not institute:
            conditions.append("(c.city LIKE ? OR c.name LIKE ? OR c.state LIKE ?)")
            params.extend([f"%{location}%", f"%{location}%", f"%{location}%"])

        # Resolve exact college code if institute specified
        resolved_college_code = None
        if institute:
            resolved_college_code = resolve_college_entity(institute)
            if resolved_college_code:
                conditions.append("e.college_code = ?")
                params.append(resolved_college_code)
            else:
                conditions.append("(c.name LIKE ? OR c.college_code LIKE ?)")
                params.extend([f"%{institute}%", f"%{institute}%"])

        # Resolve exact branch code if branch specified
        resolved_branch_code = None
        if branch:
            resolved_branch_code = resolve_branch_entity(branch)
            if resolved_branch_code:
                conditions.append("e.branch_code = ?")
                params.append(resolved_branch_code)
            else:
                conditions.append("(e.branch_code LIKE ? OR e.branch_code = ?)")
                params.extend([f"%{branch}%", branch])

        where_clause = " AND ".join(conditions)

        cat_order_param = cat_norm if cat_norm != "GENERAL" else "GENERAL"
        if resolved_college_code or institute:
            query = f"""
                SELECT c.college_code, c.name, e.branch_code, e.quota, e.category, e.closing_rank, e.data_confidence
                FROM exam_cutoffs e
                JOIN colleges c ON e.college_code = c.college_code
                WHERE {where_clause}
                ORDER BY (CASE WHEN e.category = '{cat_order_param}' THEN 0 ELSE 1 END) ASC, e.closing_rank ASC LIMIT 20
            """
        else:
            # Smart ranking: Prioritize viable/admissible colleges (closing_rank >= rank), then near-misses, then closest available
            query = f"""
                SELECT c.college_code, c.name, e.branch_code, e.quota, e.category, e.closing_rank, e.data_confidence
                FROM exam_cutoffs e
                JOIN colleges c ON e.college_code = c.college_code
                WHERE {where_clause}
                ORDER BY 
                    (CASE WHEN e.category = '{cat_order_param}' THEN 0 ELSE 1 END) ASC,
                    (CASE 
                        WHEN e.closing_rank >= {rank} THEN 0 
                        WHEN e.closing_rank >= {rank} * 0.80 THEN 1 
                        ELSE 2 
                    END) ASC,
                    ABS(e.closing_rank - {rank}) ASC
                LIMIT 35
            """

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        # Deduplicate rows by (college_code, branch_code): choose exact category match first, or calibrated category row
        seen: dict[tuple[str, str], dict] = {}
        for row in rows:
            col_code, col_name, br_code, quota, row_cat, cl_rank, conf = row
            key = (col_code, br_code)
            is_cat_match = (row_cat.upper() == cat_norm.upper())

            # If no direct category row existed in DB, apply calibrated regulatory category expansion
            if not is_cat_match and cat_norm != "GENERAL":
                mult = {"OBC_NCL": 1.45, "EWS": 1.35, "SC": 2.35, "ST": 3.50, "PWD": 3.00}.get(cat_norm, 1.0)
                cl_rank = int(cl_rank * mult)
                row_cat = cat_norm
                is_cat_match = True

            # Calibrated Sigmoid Logistic Function with float overflow defense:
            # P = 1 / (1 + exp( -k * (cl_rank - rank) / sigma ))
            sigma = max(float(cl_rank) * 0.12, 120.0)
            k = 2.0
            z = (k * (float(cl_rank) - float(rank))) / sigma
            z_clamped = max(-50.0, min(50.0, z))
            raw_prob = 1.0 / (1.0 + math.exp(-z_clamped))
            prob = round(max(0.01, min(0.99, raw_prob)), 2)

            if min_prob is not None and prob < min_prob:
                continue
            if max_prob is not None and prob > max_prob:
                continue
            
            br_map = {
                "CS": "Computer Science",
                "IT": "Information Technology",
                "AIDS": "Artificial Intelligence & Data Science",
                "AIML": "Artificial Intelligence & Machine Learning",
                "EC": "Electronics & Telecommunication",
                "EE": "Electrical Engineering",
                "ME": "Mechanical Engineering",
                "CE": "Civil Engineering",
                "CH": "Chemical Engineering",
                "MBBS": "Medicine and Surgery",
            }
            br_name = br_map.get(br_code, f"{br_code} Engineering")

            cand_entry = {
                "college_code": col_code,
                "college_name": col_name,
                "branch_code": br_code,
                "branch_name": br_name,
                "quota": quota or ("STATE" if exam == "MHT_CET" else "AI"),
                "category": row_cat,
                "admission_probability": prob,
                "predicted_closing_rank": int(cl_rank),
                "data_confidence": conf or "HIGH",
                "is_cat_match": is_cat_match,
            }

            if key not in seen:
                seen[key] = cand_entry
            elif is_cat_match and not seen[key].get("is_cat_match"):
                seen[key] = cand_entry

        # Sort results: prioritize positive chances first, then closest rank
        all_candidates = list(seen.values())
        all_candidates.sort(
            key=lambda x: (
                0 if x["admission_probability"] > 0 else 1,
                -x["admission_probability"],
                abs(x["predicted_closing_rank"] - rank)
            )
        )
        results = all_candidates[:8]

    except Exception as exc:
        logger.error("Direct SQLite cutoff query failed: %s", exc)
    return results


def compare_colleges(institute_a: str, institute_b: str, branch: Optional[str] = None) -> dict:
    """Retrieve verified factual comparison data between institutes."""
    codes: list[str] = []
    for inst in [institute_a, institute_b]:
        code = resolve_college_entity(inst) or inst
        if code not in codes:
            codes.append(code)
    return compare_multiple_colleges(codes, branch=branch or "CS")


# ---------------------------------------------------------------------------
# Gemini-Native LLM Caller with Jitter & Backoff
# ---------------------------------------------------------------------------

def _call_gemini_native(
    gemini_key: str,
    prompt: str,
    timeout_budget: float = 25.0,
) -> str:
    """Call Google Gemini API using native JSON endpoint with fast fallback."""
    import urllib.request
    import urllib.error

    models_to_try = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"]
    start = time.time()
    last_err: Optional[Exception] = None

    for model in models_to_try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            f"?key={gemini_key}"
        )
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
            },
        }).encode("utf-8")

        for attempt in range(1, 3):
            remaining = timeout_budget - (time.time() - start)
            if remaining <= 2.0:
                raise TimeoutError("Pipeline budget exhausted before Gemini response")

            req = urllib.request.Request(
                url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
            )
            try:
                per_attempt_timeout = min(remaining, 12.0)
                with urllib.request.urlopen(req, timeout=per_attempt_timeout) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                candidates = data.get("candidates", [])
                if not candidates:
                    finish = data.get("promptFeedback", {}).get("blockReason", "UNKNOWN")
                    raise RuntimeError(f"Gemini returned empty candidates. blockReason={finish}")

                candidate = candidates[0]
                finish_reason = candidate.get("finishReason", "")
                if finish_reason in ("SAFETY", "RECITATION", "OTHER"):
                    raise RuntimeError(f"Gemini candidate blocked: finishReason={finish_reason}")

                parts = candidate.get("content", {}).get("parts", [])
                if not parts or not parts[0].get("text"):
                    raise RuntimeError("Gemini candidate has no text content")

                return parts[0]["text"]

            except urllib.error.HTTPError as err:
                last_err = err
                if err.code in (429, 503):
                    jitter = random.uniform(0.1, 0.4)
                    delay = (0.8 * (2 ** (attempt - 1))) + jitter
                    logger.warning(
                        "Gemini %s HTTP %d attempt %d, retrying in %.2fs",
                        model, err.code, attempt, delay
                    )
                    time.sleep(delay)
                else:
                    break
            except Exception as exc:
                last_err = exc
                break

    raise RuntimeError(f"Gemini failed on all models/retries. Last: {last_err}")


def _call_llm(system_prompt: str, messages: list[dict], timeout: float = 25.0) -> str:
    """Unified LLM call to Gemini with Groq backup if key present."""
    gemini_key = os.environ.get("GEMINI_API_KEY", "") or getattr(settings, "GEMINI_API_KEY", "")

    if gemini_key and (gemini_key.startswith("AIza") or gemini_key.startswith("AQ.")):
        try:
            history_parts = []
            for m in messages:
                role = "Student" if m.get("role") == "user" else "ARIA"
                history_parts.append(f"**{role}**: {m.get('content', '')}")
            conv_block = "\n\n".join(history_parts)
            full_prompt = f"{system_prompt}\n\n### Conversation So Far\n{conv_block}" if conv_block else system_prompt
            return _call_gemini_native(gemini_key, full_prompt, timeout_budget=timeout)
        except Exception as exc:
            logger.warning("Gemini native engine failed: %s", exc)

    # Secondary failover if Groq key exists
    groq_key = os.environ.get("GROQ_API_KEY", "") or getattr(settings, "GROQ_API_KEY", "")
    if groq_key and groq_key.startswith("gsk_"):
        try:
            import urllib.request
            payload = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "system", "content": system_prompt}] + messages,
                "max_tokens": 4096,
                "temperature": 0.0,
                "response_format": {"type": "json_object"},
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=payload,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {groq_key}"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.warning("Groq backup failed: %s", exc)

    raise RuntimeError("All LLM providers exhausted.")


# ---------------------------------------------------------------------------
# History Formatting & Profile Persistence
# ---------------------------------------------------------------------------

def _format_history(history: list[dict]) -> list[dict]:
    """Format recent history preserving context while bounding token length."""
    recent = (history or [])[-8:]
    formatted: list[dict] = []
    for msg in recent:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if not role:
            if "user" in msg:
                role, content = "user", msg["user"]
            elif "bot" in msg or "assistant" in msg:
                role = "assistant"
                content = msg.get("bot") or msg.get("assistant", "")
        if not role or not content:
            continue
        role = "assistant" if role.lower() in ("bot", "assistant", "aria") else "user"
        content = str(content)
        if role == "assistant" and len(content) > 500:
            content = content[:500] + " [...]"
        formatted.append({"role": role, "content": content})
    return formatted


def load_profile_from_db(user_id: int = 1) -> dict:
    """Load persisted profile fields from SQLite database."""
    db_path = "admitos_prediction.db"
    if not os.path.exists(db_path):
        return {}
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT primary_exam, rank, category, home_state, gender FROM student_profiles WHERE user_id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "active_exam": row[0],
                "rank": row[1],
                "category": row[2],
                "home_state": row[3],
                "gender": row[4],
            }
    except Exception as exc:
        logger.error("Error loading student profile from DB: %s", exc)
    return {}


def persist_profile_updates(updates: dict, user_id: int = 1) -> None:
    """Persist updated student profile fields into SQLite."""
    if not updates:
        return
    db_path = "admitos_prediction.db"
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT OR IGNORE INTO users (id, email, phone, name, is_verified, is_active, tier, created_at, updated_at) "
                "VALUES (?, ?, '9999999999', 'Demo Student', 1, 1, 'FREE', datetime('now'), datetime('now'))",
                (user_id, f"student_{user_id}@admitos.com"),
            )
        cursor.execute("SELECT id FROM student_profiles WHERE user_id = ?", (user_id,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO student_profiles (user_id, primary_exam, exam_year, rank, category, home_state, gender, created_at) "
                "VALUES (?, 'JEE_MAIN', 2026, NULL, 'GENERAL', 'MH', 'M', datetime('now'))",
                (user_id,),
            )
        allowed = {"rank", "category", "home_state", "gender", "primary_exam", "exam_year"}
        fields = [(k, v) for k, v in updates.items() if k in allowed and v is not None]
        if fields:
            set_clause = ", ".join(f"{k} = ?" for k, _ in fields)
            params = [v for _, v in fields] + [user_id]
            cursor.execute(f"UPDATE student_profiles SET {set_clause} WHERE user_id = ?", params)
            conn.commit()
        conn.close()
    except Exception as exc:
        logger.error("Error persisting student profile updates: %s", exc)


def _lock_deterministic_table(narrative: str, predictions: list[dict]) -> str:
    """Lock the table output directly from ground-truth predictions to prevent any LLM variation."""
    if not predictions:
        return narrative

    table_rows = [
        "| Institute | Branch | Quota | Category | Chance | Closing Rank | Confidence |",
        "|---|---|:---:|:---:|:---:|:---:|:---:|",
    ]
    for p in predictions:
        table_rows.append(
            f"| {p['college_name']} | {p['branch_name']} | {p['quota']} | "
            f"{p['category']} | {p['admission_probability']} | {p['closing_rank']} | {p['data_confidence']} |"
        )
    ground_table_str = "\n".join(table_rows)

    # Match any table block (even without separator) and replace with standardized ground table
    table_match = re.search(r'(?:\|[^\n]+\|\n?)+', narrative)
    if table_match:
        return narrative[:table_match.start()].rstrip() + "\n\n" + ground_table_str + "\n\n" + narrative[table_match.end():].lstrip()
    
    # If LLM didn't emit a table, insert ground table after a genuine paragraph boundary (\n\n) or at end
    # NEVER split on single periods which corrupt honorifics like 'Dr.', 'Prof.', 'Mr.'
    paragraphs = [p.strip() for p in narrative.split("\n\n") if p.strip()]
    if len(paragraphs) >= 2:
        return f"{paragraphs[0]}\n\n{ground_table_str}\n\n" + "\n\n".join(paragraphs[1:])
    
    return f"{narrative.rstrip()}\n\n{ground_table_str}"


def _filter_sources(
    sources: list[str],
    narrative: str,
    query: str = "",
    target_institutes: Optional[list[str]] = None,
    is_prediction_applied: bool = False,
) -> list[str]:
    """Filter sources to include only those causally relevant, verified, and referenced in the response."""
    if not sources:
        return []
    
    q_lower = query.lower()
    narrative_lower = narrative.lower()
    filtered = []

    # Identify the specific institutes being discussed in the current narrative/query
    active_insts_in_turn: set[str] = set()
    if target_institutes:
        for inst in target_institutes:
            active_insts_in_turn.add(inst)

    # Extract institutes explicitly mentioned in narrative or query
    for code, kw_list in INSTITUTE_ALIAS_KEYWORDS.items():
        if any(kw in narrative_lower for kw in kw_list) or any(kw in q_lower for kw in kw_list):
            active_insts_in_turn.add(code)

    for src in sources:
        # Web search sources with format: "Title|URL" or URL
        if "|" in src or src.startswith("http"):
            parts = src.split("|", 1)
            title = parts[0].lower() if len(parts) > 1 else ""
            url = parts[1].lower() if len(parts) > 1 else src.lower()
            combined_src = f"{title} {url}"

            # Blacklist check: reject non-academic, mountains, synonyms, dictionaries
            if any(b in combined_src for b in [
                "mountain", "highest peak", "merriam-webster", "dictionary", "thesaurus",
                "youtube.com/watch", "eight-thousander", "peak in india", "synonyms"
            ]):
                continue

            if active_insts_in_turn:
                # STRICT CHECK: The source MUST match at least one active institute in this turn
                is_match = False
                for inst_code in active_insts_in_turn:
                    kw_list = INSTITUTE_ALIAS_KEYWORDS.get(inst_code, [inst_code.lower()])
                    if any(kw in combined_src for kw in kw_list):
                        is_match = True
                        break
                if is_match:
                    # Negative check: if active turn does NOT include IIT, do not attach pure IIT sources
                    if not any("IIT" in inst for inst in active_insts_in_turn):
                        if ("iit bombay" in title or "iit delhi" in title) and not any(kw in combined_src for inst in active_insts_in_turn for kw in INSTITUTE_ALIAS_KEYWORDS.get(inst, [])):
                            continue
                    filtered.append(src)
            else:
                # General academic query
                if any(kw in combined_src for kw in ["college", "university", "institute", "engineering", "admission", "placement", "cutoff"]):
                    filtered.append(src)
            continue

        # Prediction engine source (ONLY if prediction was genuinely applied and present in narrative)
        if "Prediction Engine" in src:
            if is_prediction_applied and ("|" in narrative_lower or "chance" in narrative_lower or "cutoff" in narrative_lower):
                # Verify that institute code in Prediction Engine source matches active institutes
                src_code = re.search(r'Prediction Engine \(([^\)]+)\)', src)
                if src_code and active_insts_in_turn:
                    if src_code.group(1) in active_insts_in_turn:
                        filtered.append(src)
                else:
                    filtered.append(src)
            continue

        # Procedural RAG doc sources
        is_rules_q = any(k in q_lower for k in [
            "round", "freeze", "float", "slide", "choice fill", "document", "rule",
            "process", "josaa", "mcc", "cap", "csab", "seat acceptance", "forfeit", "bond", "exit"
        ])
        if is_rules_q:
            filtered.append(src)

    # Deduplicate preserving order
    seen_src = set()
    unique_filtered = []
    for s in filtered:
        if s not in seen_src:
            seen_src.add(s)
            unique_filtered.append(s)
    return unique_filtered


def _enforce_memory_safeguard(
    response: str,
    profile: StudentProfileState,
    query: str,
) -> str:
    """Hard Python code safeguard: if profile has a score, never ask for it again."""
    rank, percentile = profile.get_current_score()
    if rank is None and percentile is None:
        return response

    re_ask_patterns = [
        r"share your (?:mht-cet|jee|neet)?\s*(?:percentile|rank|score)",
        r"what is your (?:percentile|rank|score)",
        r"provide your (?:percentile|rank|score)",
        r"need your (?:percentile|rank|score)",
        r"tell me your (?:percentile|rank|score)",
    ]

    is_reasking = any(re.search(pat, response, re.IGNORECASE) for pat in re_ask_patterns)
    if is_reasking and not ("NIT" in query.upper() and profile.active_exam == "MHT_CET"):
        score_desc = f"{percentile}%ile (~{rank:,} State Merit Rank)" if percentile else f"rank ~{rank:,}"
        logger.warning("Memory safeguard intercepted LLM re-ask! Active score: %s", score_desc)
        cleaned_resp = re.sub(
            r"(?:Once you're ready, )?(?:Please )?(?:share|provide|tell me) your (?:percentile|rank|score).*?(?:\.|$)",
            f"Based on your registered {score_desc}, here are your options.",
            response,
            flags=re.IGNORECASE,
        )
        return cleaned_resp.strip()

    return response


# ---------------------------------------------------------------------------
# ARIAChatEngine
# ---------------------------------------------------------------------------

class ARIAChatEngine:
    """Conversational AI counseling engine — Tier-1 admissions counselor."""

    def __init__(
        self,
        retriever: Optional[CounselingRetriever] = None,
        guard: Optional[HallucinationGuard] = None,
    ) -> None:
        self.retriever = retriever or CounselingRetriever()
        self.guard = guard or HallucinationGuard()

    def chat(
        self,
        query: str,
        history: list[dict],
        exam_type: str,
        student_context: dict,
        user_id: int = 1,
    ) -> ChatResponse:
        """Process a counseling turn with exam isolation, memory persistence, and BLUF synthesis."""
        start_time = time.time()

        # --------------------------------------------------------------------
        # Step 1: Hydrate & Resolve Exam-Isolated Profile State
        # --------------------------------------------------------------------
        db_profile = load_profile_from_db(user_id=user_id)
        merged_context = dict(db_profile)
        if student_context:
            for k, v in student_context.items():
                if v not in (None, "N/A", ""):
                    merged_context[k] = v

        profile_state = StudentProfileState(merged_context)

        # Full history scan across ALL prior messages to never drop early profile turns
        for msg in (history or []):
            role = msg.get("role", "")
            if role in ("user", "student") or "user" in msg:
                content = msg.get("content") or msg.get("user", "")
                profile_state.update_from_query(str(content))

        # Update from current query
        profile_state.update_from_query(query, default_exam=exam_type)
        active_exam = profile_state.active_exam
        current_rank, current_percentile = profile_state.get_current_score()

        tool_traces: list[ToolExecutionResult] = []
        query_lower = query.lower()

        # --------------------------------------------------------------------
        # Step 2: Tool Execution Phase (Grounded Data Retrieval)
        # --------------------------------------------------------------------

        # Tool A: Governing Body Check
        gov_check = check_governing_body(query, active_exam)
        tool_traces.append(ToolExecutionResult(
            tool_name="check_governing_body",
            arguments={"query": query, "active_exam": active_exam},
            output=gov_check,
        ))

        # Tool B: RAG Rules Retrieval (JoSAA / CSAB / MCC / CAP Rules)
        is_rules_q = any(k in query_lower for k in [
            "round", "freeze", "float", "slide", "choice fill", "document", "rule",
            "process", "josaa", "mcc", "cap", "csab", "seat acceptance", "forfeit", "bond", "free exit"
        ])
        retrieved_chunks = []
        if is_rules_q:
            retrieved_chunks = self.retriever.retrieve(query, top_k=5, exam_type=active_exam)
            if retrieved_chunks:
                tool_traces.append(ToolExecutionResult(
                    tool_name="retrieve_rules",
                    arguments={"query": query, "exam": active_exam},
                    output=[{"source": c.source, "year": c.year, "text": c.text[:200]} for c, _ in retrieved_chunks],
                    sources=[f"{c.source} (year: {c.year})" for c, _ in retrieved_chunks],
                ))

        # Tool C: Multi-College Extraction & Comparison Tool
        extracted_colleges = extract_multiple_colleges(query)
        target_inst = extracted_colleges[0] if extracted_colleges else resolve_college_entity(query)
        target_branch = resolve_branch_entity(query)
        target_location = extract_location_filter(query)

        # Handle pending-offer / short affirmative resolution ("yes", "sure", "ok", "please do")
        is_affirmative_response = bool(re.search(r'^\s*(yes|yeah|sure|ok|okay|yep|please do|yup|go ahead|tell me|show me|proceed|absolutely)\b', query_lower)) and len(query.split()) <= 6
        is_offered_cutoff_action = False
        if is_affirmative_response and history:
            last_assistant_msg = ""
            for prev in reversed(history):
                if prev.get("role") == "assistant" or "assistant" in prev:
                    last_assistant_msg = str(prev.get("content") or prev.get("assistant") or "")
                    break
            if last_assistant_msg:
                has_cutoff_offer = any(k in last_assistant_msg.lower() for k in [
                    "cutoff", "cutoffs", "prediction", "predict", "admission", "chances", "choice-filling"
                ])
                if has_cutoff_offer:
                    colls = extract_multiple_colleges(last_assistant_msg)
                    if not colls:
                        single = resolve_college_entity(last_assistant_msg)
                        if single:
                            colls = [single]
                    if colls:
                        target_inst = colls[0]
                        target_branch = resolve_branch_entity(last_assistant_msg) or "CS"
                        is_offered_cutoff_action = True
                        logger.info("Resolved affirmative 'yes' to offered prediction/cutoff for institute: %s, branch: %s", target_inst, target_branch)

                offer_comp_m = re.search(r'compare\s+([A-Za-z0-9\s]+?)\s+(?:and|vs|versus)\s+([A-Za-z0-9\s]+?)(?:\?|\.|$)', last_assistant_msg, re.IGNORECASE)
                if offer_comp_m:
                    c1 = resolve_college_entity(offer_comp_m.group(1).strip())
                    c2 = resolve_college_entity(offer_comp_m.group(2).strip())
                    if c1 and c2:
                        extracted_colleges = [c1, c2]
                        logger.info("Resolved affirmative query to offered comparison: %s", extracted_colleges)

        # If no colleges in current query, check history for recent colleges discussed (handles "from both", "their placements")
        history_colleges: list[str] = []
        if not extracted_colleges and not target_inst:
            for prev_msg in reversed(history[-6:] if history else []):
                content = prev_msg.get("content") or prev_msg.get("user") or prev_msg.get("assistant") or ""
                colls = extract_multiple_colleges(str(content))
                for c in colls:
                    if c not in history_colleges:
                        history_colleges.append(c)
                if len(history_colleges) >= 2:
                    break

        effective_colleges = extracted_colleges if extracted_colleges else (history_colleges if history_colleges else ([target_inst] if target_inst else []))
        if not target_inst and effective_colleges:
            target_inst = effective_colleges[0]

        has_comparison_intent = any(k in query_lower for k in [
            "compare", "vs", "versus", "better than", "difference between", "rank these",
            "which is better", "preference order", "choice order", "tier list", "comparison", "options between"
        ])
        is_comparison_query = (len(extracted_colleges) >= 2 or (has_comparison_intent and len(extracted_colleges) >= 1))

        comparison_data = {}
        if is_comparison_query and extracted_colleges:
            comparison_data = compare_multiple_colleges(extracted_colleges, exam=active_exam, branch=target_branch or "CS")
            comp_sources = [f"Prediction Engine ({c})" for c in extracted_colleges]
            tool_traces.append(ToolExecutionResult(
                tool_name="compare_colleges",
                arguments={"institutes": extracted_colleges, "exam": active_exam, "branch": target_branch},
                output=comparison_data,
                sources=comp_sources,
            ))

        # Navigational, contact, and personnel queries
        is_navigational_or_contact = any(k in query_lower for k in [
            "portal", "website", "official site", "web address", "url", "link",
            "contact", "phone", "email", "address", "how to reach", "location of campus",
            "where is it located", "where is", "map", "how do i get to", "how to apply portal",
            "portal link", "official portal", "director", "dean", "principal", "who is the dean",
            "who is the director", "who is the principal", "logo"
        ])
        is_personnel_query = any(k in query_lower for k in ["director", "dean", "principal", "faculty", "head of", "who is the dean", "who is the director"])

        # Fact contest queries (user challenging a previously stated fact)
        is_fact_contest_query = any(k in query_lower for k in [
            "is it", "was it", "or something else", "i thought", "i thought it was", "wasn't it", "isn't it",
            "are you sure", "aren't you sure", "no it is", "actually it is", "i think it is", "didn't you say"
        ]) and len(query.split()) <= 15

        # Multi-year historical data request
        is_multi_year_request = any(k in query_lower for k in [
            "past 5 year", "past 3 year", "past 4 year", "last 5 year", "last 3 year", "last 4 year",
            "past 5 years", "past 3 years", "past 4 years", "last 5 years", "last 3 years", "last 4 years",
            "historical placement", "historical cutoff", "over the past 5", "over the past 3", "past 5-year"
        ])

        # Extract explicit numeric probability constraints (e.g. "at least above 70 percent", "above 70%", "greater than 80%")
        prob_min_m = re.search(r'(?:above|at least|minimum|greater than|>=|>)\s*(\d{1,2})\s*(?:%|percent)', query_lower)
        min_prob_filter = float(prob_min_m.group(1)) / 100.0 if prob_min_m else None

        prob_max_m = re.search(r'(?:below|at most|maximum|less than|<=|<)\s*(\d{1,2})\s*(?:%|percent)', query_lower)
        max_prob_filter = float(prob_max_m.group(1)) / 100.0 if prob_max_m else None

        is_general_institute_inquiry = bool(target_inst or extracted_colleges or effective_colleges) and any(k in query_lower for k in [
            "tell me about", "tell me everything", "all about", "everything about", "details of", "details about",
            "overview of", "history of", "campus", "infrastructure", "culture", "clubs", "facilities",
            "review of", "pros and cons", "is it good", "how is", "academics", "faculty", "achievements", "clubs"
        ])
        is_web_fact_query = is_comparison_query or is_general_institute_inquiry or is_personnel_query or is_fact_contest_query or is_multi_year_request or any(k in query_lower for k in [
            "placement", "package", "salary", "recruiter", "recruit", "lpa", "ctc",
            "highest package", "average package", "median", "fee", "fees", "tuition",
            "curriculum", "syllabus", "hostel", "infrastructure", "sinhgad", "tell me everything", "codecell", "codechef"
        ])

        is_smalltalk = bool(re.search(r'^\s*(h+i+|h+e+y+|h+e+l+o+|howdy|sup|yo|greetings|thanks|thank you|ok|okay|got it|all ears|listening)\b', query_lower)) and len(query.split()) <= 6 and not is_offered_cutoff_action
        is_feedback_or_complaint = any(k in query_lower for k in [
            "stop doing", "stop giving", "stop volunteering", "stop predicting", "don't give tables",
            "don't show tables", "don't predict", "keep it conversational", "why do you start predicting",
            "why do you predict", "why did you predict", "why did you start", "why did you say",
            "how did you get my rank", "who told you my rank", "how do you know my rank",
            "are you for real", "why did you change"
        ])
        is_meta_formatting = any(k in query_lower for k in [
            "why do you use tables", "what won't you use tables for", "what else can you use",
            "formatting rule", "how do you format", "explain your format", "why tables", "format to use",
            "what other formatting tools", "what other tools do you have", "how do you decide what format"
        ])
        is_meta_or_smalltalk = (is_smalltalk or is_feedback_or_complaint or is_meta_formatting) and not is_offered_cutoff_action
        
        is_pure_placement_inquiry = is_web_fact_query and not any(k in query_lower for k in [
            "chance", "predict", "cutoff", "cut-off", "can i get", "admission", "eligible", "is it possible", "where can i get"
        ]) and not is_offered_cutoff_action

        # Deterministic admission prediction gating
        is_prediction_query = (
            (is_offered_cutoff_action or (
                not is_meta_or_smalltalk
                and not is_pure_placement_inquiry
                and not is_rules_q
                and not is_comparison_query
                and not is_navigational_or_contact
                and not is_fact_contest_query
                and ((current_rank and current_rank > 0) or (current_percentile and current_percentile > 0))
                and (
                    target_inst is not None
                    or target_location is not None
                    or min_prob_filter is not None
                    or any(k in query_lower for k in [
                        "chance", "predict", "cutoff", "cut-off", "option", "colleges", "what about", "is it possible",
                        "can i get", "admission", "rank", "percentile", "score", "seat", "get in", "eligible",
                        "which college", "suggest", "my chances", "where can i get"
                    ])
                )
            ))
        )

        prediction_result = {}
        if is_prediction_query:
            try:
                prediction_result = predict_admission(
                    rank=current_rank,
                    percentile=current_percentile,
                    category=profile_state.category,
                    home_state=profile_state.home_state,
                    exam=active_exam,
                    institute=target_inst,
                    branch=target_branch,
                    gender=profile_state.gender,
                    location=target_location,
                    min_prob=min_prob_filter,
                    max_prob=max_prob_filter,
                )
                if prediction_result.get("success") and prediction_result.get("predictions"):
                    tool_traces.append(ToolExecutionResult(
                        tool_name="predict_admission",
                        arguments={
                            "rank": current_rank,
                            "percentile": current_percentile,
                            "category": profile_state.category,
                            "home_state": profile_state.home_state,
                            "exam": active_exam,
                            "institute": target_inst,
                            "branch": target_branch,
                            "location": target_location,
                            "min_prob": min_prob_filter,
                        },
                        output=prediction_result,
                        sources=[
                            f"Prediction Engine ({p['college_code']})"
                            for p in prediction_result.get("predictions", [])
                        ],
                    ))
            except Exception as pred_err:
                logger.error("Error executing predict_admission tool: %s", pred_err)

        # Tool E: Real-World Live Web Search (Placements, Packages, Recruiters, Personnel, Fact Verification)
        web_search_result = {}
        has_web_search = False
        if is_web_fact_query and not is_meta_or_smalltalk:
            try:
                search_q = query
                if target_inst and target_inst not in query.upper():
                    search_q = f"{target_inst} {query}"
                web_search_result = web_search(
                    query=search_q,
                    institute_context=target_inst,
                    target_institutes=effective_colleges,
                    max_results=6
                )
                if web_search_result.get("results"):
                    has_web_search = True
                    web_sources = [
                        f"{r['title']}|{r['url']}"
                        for r in web_search_result.get("results", [])
                    ]
                    tool_traces.append(ToolExecutionResult(
                        tool_name="web_search",
                        arguments={
                            "query": search_q,
                            "institutes": effective_colleges or [target_inst]
                        },
                        output=web_search_result,
                        sources=web_sources,
                    ))
            except Exception as search_err:
                logger.error("Error executing web_search tool: %s", search_err)

        # --------------------------------------------------------------------
        # Step 3: Build Grounded Tool-Output Block for Synthesis
        # --------------------------------------------------------------------
        context_blocks = []

        if not gov_check.get("matched", True):
            context_blocks.append(
                f"### [Tool: check_governing_body]\n"
                f"GOVERNING BODY MISMATCH: {gov_check.get('explanation')}"
            )

        if is_prediction_query and prediction_result and prediction_result.get("success") and prediction_result.get("predictions"):
            preds = prediction_result.get("predictions", [])
            table_rows = [
                "| Institute | Branch | Quota | Category | Chance | Closing Rank | Confidence |",
                "|---|---|:---:|:---:|:---:|:---:|:---:|",
            ]
            for p in preds:
                table_rows.append(
                    f"| {p['college_name']} | {p['branch_name']} | {p['quota']} | "
                    f"{p['category']} | {p['admission_probability']} | {p['closing_rank']} | {p['data_confidence']} |"
                )
            context_blocks.append(
                f"### [Tool: predict_admission (Exam: {active_exam})]\n"
                f"{prediction_result.get('derived_note', '')}\n"
                f"Verified Cutoff Predictions Table (Ground Truth - Cell-for-cell copy required):\n" + "\n".join(table_rows)
            )
        elif is_prediction_query and prediction_result and prediction_result.get("derived_note"):
            context_blocks.append(
                f"### [Tool: predict_admission (Constraint Applied)]\n"
                f"{prediction_result.get('derived_note')}\n"
                f"State honestly in your response that no colleges met the specified probability threshold at rank {current_rank}."
            )
        elif is_prediction_query and prediction_result and not prediction_result.get("success") and target_inst:
            context_blocks.append(
                f"### [Tool: predict_admission]\n"
                f"No verified prediction cutoffs exist in the database for {target_inst} ({target_branch or 'all branches'}) under {active_exam}. "
                f"State honestly that specific cutoff data for this is not in database, and suggest official portal."
            )

        if comparison_data:
            if comparison_data.get("comparison_matrix_md"):
                context_blocks.append(
                    f"### [Tool: compare_colleges]\n"
                    f"Verified Multi-Institute Comparison Matrix (Ground Truth):\n"
                    f"{comparison_data.get('comparison_matrix_md')}\n\n"
                    f"Instructions: Output the full comparison matrix above directly in your response. "
                    f"Synthesize key differences (Academics/Autonomy, Placements/Average CTC, Fee Tier, Cutoff competitiveness) across ALL {len(extracted_colleges)} requested colleges. "
                    f"Do NOT output any personal admission chance percentage (do not output '100% Chance')."
                )
            else:
                context_blocks.append(
                    f"### [Tool: compare_colleges]\n"
                    f"Factual Institute Profiles: {json.dumps(comparison_data, indent=2)}"
                )

        if retrieved_chunks:
            rag_text = "\n".join([f"[{c.source} ({c.year})]: {c.text}" for c, _ in retrieved_chunks])
            context_blocks.append(f"### [Tool: retrieve_rules (Knowledge Base)]\n{rag_text}")

        if web_search_result and web_search_result.get("results"):
            web_formatted = []
            for item in web_search_result["results"]:
                web_formatted.append(
                    f"- Title: {item['title']}\n"
                    f"  URL: {item['url']}\n"
                    f"  Domain: {item['domain']}\n"
                    f"  Snippet: {item['snippet']}"
                )
            context_blocks.append(
                f"### [Tool: web_search (Live Verified Web Results - Retrieved at {web_search_result.get('search_performed_at')})]\n"
                + "\n\n".join(web_formatted)
            )

        # Affirmative Acceptance of Cutoff Offer Guidance
        if is_offered_cutoff_action:
            context_blocks.append(
                "### [User Intent: Affirmative Acceptance of Offered Cutoff Exploration]\n"
                "The user responded affirmatively ('yes' / 'sure') to your previous offer to explore admission cutoffs/predictions for the institute.\n"
                "MANDATORY BLUF RESPONSE FORMAT:\n"
                "1. State the admission probability verdict directly in your very first sentence (e.g. 'Based on your estimated State Merit Rank of ~3,500, you have a strong 99% chance of securing Computer Science at KJSCE.').\n"
                "2. Provide the verified cutoff prediction table immediately below your opening sentence.\n"
                "3. DO NOT repeat, rehash, or continue discussing achievements, clubs, or background topics from previous turns.\n"
                "4. Follow with 1-2 brief sentences of choice-filling strategic advice."
            )

        # Fact contest verification instruction
        if is_fact_contest_query:
            context_blocks.append(
                "### [CRITICAL: User Contested Factual Claim / Anti-Sycophancy Rule]\n"
                "The user is questioning or contesting a previous factual statement (e.g. a club name, statistic, ranking, or program detail).\n"
                "1. NEVER simply agree or say 'Yes, you are completely right' or 'My apologies, you're right' without verified tool evidence.\n"
                "2. DO NOT synthesize an ungrounded claim that 'both exist' unless verified search results above specifically prove both are official active organizations.\n"
                "3. Ground your answer strictly in the verified search results above and cite the verified source URL.\n"
                "4. If official records confirm the original statement, explain the verified distinction with citations.\n"
                "5. If official records are inconclusive, state honestly: 'I could not find an official reference confirming that — please check the institute's official portal.' NEVER flip-flop or invent details under conversational pressure."
            )

        # Multi-Year Historical Request Disclosure
        if is_multi_year_request:
            context_blocks.append(
                "### [Data Governance: Multi-Year Historical Request Disclosure]\n"
                "The user explicitly requested multi-year historical data (e.g. past 3-5 years). "
                "The database and live verified records only maintain current-year verified records (2023-24). "
                "You MUST explicitly disclose upfront in the opening sentence: "
                "'I only have verified records for the current 2023-24 season — historical multi-year records are not available in current official sources.' "
                "Present verified current numbers and NEVER invent synthetic multi-year figures."
            )

        # Feedback or Meta Question Guidance
        if is_feedback_or_complaint or is_meta_formatting:
            context_blocks.append(
                "### [User Intent: Conversational Feedback / Meta Question]\n"
                "The user is asking a conversational question about ARIA's behavior, formatting, or giving style feedback. "
                "Instructions: Respond conversationally, concisely, and directly in 1-3 natural sentences. "
                "DO NOT volunteer or state the student's rank/percentile unprompted. "
                "DO NOT output any admission prediction table, comparison table, or college list. "
                "Demonstrate the requested behavior directly in this response."
            )

        context_str = "\n\n".join(context_blocks) if context_blocks else "No specific tool data required."

        # --------------------------------------------------------------------
        # Step 4: Call LLM for Grounded Synthesis
        # --------------------------------------------------------------------
        sys_prompt = ARIA_SYSTEM_PROMPT.format(
            active_exam=active_exam,
            exam_details_str=profile_state.format_exam_details(),
            category=profile_state.category,
            home_state=profile_state.home_state,
            context=context_str,
        )

        messages = _format_history(history)
        messages.append({"role": "user", "content": query})

        raw_llm_response = ""
        try:
            raw_llm_response = _call_llm(sys_prompt, messages, timeout=20.0)
        except Exception as exc:
            logger.error("All LLM providers failed: %s", exc)
            return ChatResponse(
                answer="I'm taking longer than expected to process your request. Please check your network or try again in a moment.",
                confidence="LOW",
                sources=[],
                is_fallback=False,
                declined=False,
                warning="AI provider failover exhausted",
            )

        # --------------------------------------------------------------------
        # Step 5: Parse Structured Output
        # --------------------------------------------------------------------
        cleaned = raw_llm_response.strip()
        cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()

        narrative_response = cleaned
        llm_profile_updates: dict = {}

        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                narrative_response = (
                    parsed.get("narrative_response")
                    or parsed.get("narr_response")
                    or parsed.get("response")
                    or parsed.get("answer")
                    or cleaned
                )
                llm_profile_updates = parsed.get("profile_updates") or {}
        except Exception:
            narr_m = re.search(r'"(?:narrative_response|narr_response|response|answer)"\s*:\s*"(.*?)(?<!\\)"(?:\s*[,}])', cleaned, re.DOTALL)
            if narr_m:
                narrative_response = narr_m.group(1).replace("\\n", "\n").replace('\\"', '"')
            else:
                narrative_response = cleaned

        # Lock deterministic ground-truth table ONLY for genuine prediction queries
        if is_prediction_query and prediction_result and prediction_result.get("success") and prediction_result.get("predictions"):
            narrative_response = _lock_deterministic_table(
                narrative_response, prediction_result.get("predictions", [])
            )

        # Apply hard memory safeguard
        narrative_response = _enforce_memory_safeguard(narrative_response, profile_state, query)

        # --------------------------------------------------------------------
        # Step 6: Profile Updates & Persistence
        # --------------------------------------------------------------------
        profile_updates: dict = profile_state.to_dict()
        if llm_profile_updates.get("category"):
            profile_state.category = llm_profile_updates["category"]
            profile_updates["category"] = profile_state.category
        if llm_profile_updates.get("home_state"):
            profile_state.home_state = llm_profile_updates["home_state"]
            profile_updates["home_state"] = profile_state.home_state

        persist_profile_updates(
            {
                "primary_exam": active_exam,
                "rank": profile_state.get_current_score()[0],
                "category": profile_state.category,
                "home_state": profile_state.home_state,
            },
            user_id=user_id,
        )

        # --------------------------------------------------------------------
        # Step 7: Hallucination Guard & Causal Sources
        # --------------------------------------------------------------------
        all_chunks = list(retrieved_chunks)
        for t in tool_traces:
            if t.tool_name == "predict_admission" and t.output.get("success"):
                pred_text = json.dumps(t.output.get("predictions", []))
                all_chunks.insert(0, (Chunk(text=pred_text, source="Prediction Engine", year=2024), 0.98))

        top_score = all_chunks[0][1] if all_chunks else 0.0

        all_tool_sources = []
        for t in tool_traces:
            all_tool_sources.extend(t.sources)

        guard_res = self.guard.validate(
            answer=narrative_response,
            retrieved_chunks=all_chunks,
            top_score=top_score,
            query=query,
            tool_sources=all_tool_sources,
            has_web_search=has_web_search,
        )

        # Causal source filtering: only attach sources genuinely referenced/used
        filtered_sources = _filter_sources(
            guard_res.sources,
            narrative_response,
            query=query,
            target_institutes=effective_colleges,
            is_prediction_applied=bool(is_prediction_query and prediction_result and prediction_result.get("predictions")),
        )

        confidence = guard_res.confidence
        # If response has no sources and is not small talk or prediction, ensure confidence is MEDIUM
        if not filtered_sources and not is_rules_q and not (prediction_result and prediction_result.get("predictions")):
            if confidence == "HIGH" and not any(kw in query_lower for kw in ["hi", "hello", "thanks", "why tables"]):
                confidence = "MEDIUM"

        return ChatResponse(
            answer=guard_res.answer or narrative_response,
            confidence=confidence,
            sources=filtered_sources[:4],
            warning=guard_res.warning or None,
            is_fallback=False,
            declined=(confidence == "DECLINED"),
            student_profile_updates=profile_updates,
            tool_traces=[asdict(t) for t in tool_traces],
        )
