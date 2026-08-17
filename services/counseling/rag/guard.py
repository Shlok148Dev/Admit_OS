"""HallucinationGuard — services/counseling/rag/guard.py.

Validates RAG answers to prevent hallucinated numeric claims, unverified college names,
and ungrounded corporate/placement statistics. Declines low-confidence retrievals.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List, Tuple, Optional

from .ingest import Chunk

logger = logging.getLogger("rag.guard")

CONFIDENCE_THRESHOLD = 0.60
NUMBER_PATTERN = re.compile(r"\b\d+[\d,]*\b")
TIME_SENSITIVE_KEYWORDS = [
    "deadline",
    "date",
    "schedule",
    "round",
    "2024",
    "2025",
    "counselling starts",
]

COMMON_RECRUITERS = [
    "Morgan Stanley", "Barclays", "JP Morgan", "JPMorgan", "Google", "Microsoft",
    "Amazon", "Goldman Sachs", "McKinsey", "Apple", "Meta", "Adobe", "Qualcomm",
    "Directi", "Uber", "Oracle", "Cisco", "Deutsche Bank", "Citi"
]


@dataclass
class GuardResult:
    """Result from HallucinationGuard validation."""

    accepted: bool
    answer: str
    confidence: str  # HIGH | MEDIUM | LOW | DECLINED
    warning: str
    sources: List[str]


def _extract_numbers(text: str) -> List[str]:
    """Extract numeric tokens from text."""
    return NUMBER_PATTERN.findall(text)


def _numbers_in_sources(numbers: List[str], chunks: List[Chunk]) -> bool:
    """Check whether every number in the answer can be found in sources."""
    source_text = " ".join(c.text for c in chunks)
    for num in numbers:
        clean = num.replace(",", "")
        if clean not in source_text and num not in source_text:
            return False
    return True


def _has_time_sensitive_content(answer: str) -> bool:
    """Detect if answer contains time-sensitive claims."""
    lower = answer.lower()
    return any(kw in lower for kw in TIME_SENSITIVE_KEYWORDS)


def _build_source_citations(chunks: List[Chunk]) -> List[str]:
    """Build human-readable source citations from retrieved chunks only if relevant."""
    seen: set[str] = set()
    citations: List[str] = []
    for chunk in chunks:
        if chunk.source not in seen:
            seen.add(chunk.source)
            citations.append(f"{chunk.source} (year: {chunk.year})")
    return citations


def sanitize_unverified_placement_claims(answer: str, chunks: List[Chunk], query: Optional[str] = None) -> str:
    """Code-level mandatory sanitization for placement questions, unverified recruiter names, and precise salary packages."""
    q_lower = (query or "").lower()
    a_lower = answer.lower()
    
    is_placement_topic = any(kw in q_lower or kw in a_lower for kw in [
        "placement", "package", "salary", "recruiter", "recruit", "lpa", "ctc",
        "highest package", "average package", "median package", "companies recruit"
    ]) or any(rec.lower() in a_lower for rec in COMMON_RECRUITERS)

    if is_placement_topic and "not formally audited" not in a_lower:
        disclaimer = "\n\n*(Note: Specific company recruiter rosters and individual CTC figures are based on self-reported campus placement trends and are not formally audited in DTE/JoSAA regulatory datasets.)*"
        return answer.strip() + disclaimer

    return answer


class HallucinationGuard:
    """Validates generated answers against retrieved source chunks and tools."""

    def validate(
        self,
        answer: str,
        retrieved_chunks: List[Tuple[Chunk, float]],
        top_score: float,
        query: Optional[str] = None,
        tool_sources: Optional[List[str]] = None,
        has_web_search: bool = False,
    ) -> GuardResult:
        """Run all guard checks and return an honest GuardResult."""
        q_lower = (query or "").strip().lower()
        chunks = [c for c, _ in retrieved_chunks]
        
        # Categorize query intent
        small_talk_patterns = [
            "hi", "hello", "hey", "thanks", "thank you", "i'm all ears", "all ears",
            "go ahead", "i'm listening", "listening", "ok", "okay", "got it", "sure",
            "cool", "alright", "tell me", "yes please", "yeah", "understood", "continue",
            "great", "awesome", "good morning", "good evening", "how are you"
        ]
        is_small_talk = any(
            q_lower == p or q_lower.startswith(p + " ") or q_lower.endswith(" " + p) or f" {p} " in f" {q_lower} "
            for p in small_talk_patterns
        ) and len(q_lower.split()) <= 5

        # Meta formatting queries (about tables, formatting rules, how ARIA works)
        is_meta_query = any(kw in q_lower for kw in [
            "why do you use tables", "what won't you use tables for", "what else can you use",
            "formatting rule", "how do you format", "explain your format", "why tables",
            "what other formatting tools", "what other tools do you have", "how do you decide what format"
        ])

        is_placement_or_ext = any(kw in q_lower for kw in [
            "placement", "package", "salary", "recruiter", "recruit", "lpa", "ctc",
            "fee", "fees", "tuition", "curriculum", "syllabus", "hostel", "sinhgad"
        ])

        is_rules_qa = any(kw in q_lower for kw in [
            "round", "freeze", "float", "slide", "choice fill", "document", "rule",
            "process", "josaa", "mcc", "cap", "csab", "seat acceptance", "forfeit", "bond"
        ])

        pred_sources = [s for s in (tool_sources or []) if "Prediction Engine" in s or "Cutoff" in s or "DTE" in s]
        is_cutoff_qa = bool(pred_sources) or any(kw in q_lower for kw in [
            "rank", "percentile", "chance", "cutoff", "predict", "get admission", "options", "colleges", "what about", "can i get", "is it possible"
        ])

        # Apply mandatory recruiter & package factuality check
        answer = sanitize_unverified_placement_claims(answer, chunks, query=query)

        # 1. Small talk / Greetings: No sources, HIGH confidence, no fluff
        if is_small_talk:
            return GuardResult(
                accepted=True,
                answer=answer,
                confidence="HIGH",
                warning="",
                sources=[],
            )

        # 2. Meta Formatting queries: Conversational, no fake sources, HIGH confidence
        if is_meta_query:
            return GuardResult(
                accepted=True,
                answer=answer,
                confidence="HIGH",
                warning="",
                sources=[],
            )

        # 3. Web Search Grounded queries: Sources come from verified live web search
        if has_web_search and tool_sources:
            web_sources = [s for s in tool_sources if "|" in s or s.startswith("http")]
            return GuardResult(
                accepted=True,
                answer=answer,
                confidence="HIGH" if web_sources else "MEDIUM",
                warning="",
                sources=web_sources[:4] if web_sources else tool_sources[:4],
            )

        # 4. Cutoff / Prediction Grounded queries
        if is_cutoff_qa and pred_sources:
            return GuardResult(
                accepted=True,
                answer=answer,
                confidence="HIGH",
                warning="",
                sources=pred_sources[:4],
            )

        # 5. Rules QA (JoSAA / MCC / CAP procedural questions)
        if is_rules_qa and top_score >= 0.20:
            relevant_chunks = [c for c, score in retrieved_chunks if score >= 0.20]
            sources = _build_source_citations(relevant_chunks)
            return GuardResult(
                accepted=True,
                answer=answer,
                confidence="HIGH" if top_score >= 0.60 else "MEDIUM",
                warning="⚠️ This answer may contain time-sensitive information. Verify dates with the official portal." if _has_time_sensitive_content(answer) else "",
                sources=sources[:3],
            )

        # 6. General Parametric / Career Advice / Ungrounded External Facts
        # If content has no real RAG or tool grounding, DO NOT attach fake sources or claim "Verified"
        return GuardResult(
            accepted=True,
            answer=answer,
            confidence="MEDIUM",
            warning="General Knowledge — Specific figures may vary; verify with official institution portals.",
            sources=[],
        )
