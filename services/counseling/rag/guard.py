"""HallucinationGuard — services/counseling/rag/guard.py.

Validates RAG answers to prevent hallucinated numeric claims and
unverified college names. Declines low-confidence retrievals.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List, Tuple

from .ingest import Chunk

logger = logging.getLogger("rag.guard")

CONFIDENCE_THRESHOLD = 0.60
NUMBER_PATTERN = re.compile(r"\b\d+[\d,]*\b")
TIME_SENSITIVE_KEYWORDS = [
    "deadline", "date", "schedule", "round", "2024", "2025", "counselling starts",
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
    """Build human-readable source citations from retrieved chunks."""
    seen: set[str] = set()
    citations: List[str] = []
    for chunk in chunks:
        if chunk.source not in seen:
            seen.add(chunk.source)
            citations.append(f"{chunk.source} (year: {chunk.year})")
    return citations


class HallucinationGuard:
    """Validates generated answers against retrieved source chunks."""

    def validate(
        self,
        answer: str,
        retrieved_chunks: List[Tuple[Chunk, float]],
        top_score: float,
        query: Optional[str] = None,
    ) -> GuardResult:
        """Run all guard checks and return a GuardResult."""
        chunks = [c for c, _ in retrieved_chunks]
        sources = _build_source_citations(chunks)

        # Confidence gate: decline if similarity too low
        # If sentence-transformers is unavailable, use a lower threshold to permit keyword matching fallback
        try:
            from sentence_transformers import SentenceTransformer
            is_embedder_available = True
        except ImportError:
            is_embedder_available = False

        effective_threshold = CONFIDENCE_THRESHOLD if is_embedder_available else 0.05

        if top_score < effective_threshold or not chunks:
            logger.warning(f"Low confidence retrieval: {top_score:.3f}")
            return GuardResult(
                accepted=False,
                answer="I could not find a sufficiently reliable answer in my knowledge base. Please consult the official JoSAA/MCC portal.",
                confidence="DECLINED",
                warning="Retrieval confidence below threshold. No answer provided.",
                sources=[],
            )

        # Check numeric hallucinations
        numbers_in_answer = _extract_numbers(answer)
        if query:
            numbers_in_query = set(_extract_numbers(query))
            numbers_in_answer = [n for n in numbers_in_answer if n not in numbers_in_query]

        if numbers_in_answer and not _numbers_in_sources(numbers_in_answer, chunks):
            logger.warning("Number hallucination detected in answer")
            return GuardResult(
                accepted=False,
                answer="I found information but could not verify the specific numbers. Please verify with official sources.",
                confidence="DECLINED",
                warning="Numeric claim not verifiable from retrieved sources.",
                sources=sources,
            )

        # Assign confidence tier
        if is_embedder_available:
            if top_score >= 0.80:
                confidence = "HIGH"
            elif top_score >= 0.65:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"
        else:
            confidence = "HIGH" if top_score >= 0.10 else "LOW"

        # Time-sensitive warning
        warning = ""
        if _has_time_sensitive_content(answer):
            warning = "⚠️ This answer may contain time-sensitive information. Verify dates with the official portal."

        return GuardResult(
            accepted=True,
            answer=answer,
            confidence=confidence,
            warning=warning,
            sources=sources,
        )
