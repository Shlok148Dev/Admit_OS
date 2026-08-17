"""RAG Retriever — services/counseling/rag/retriever.py.

Loads the FAISS index and performs hybrid similarity + keyword retrieval
with recency re-ranking for counseling Q&A.
"""

from __future__ import annotations

import logging
import math
import pickle
import re
from pathlib import Path
from typing import List, Optional, Tuple

from .ingest import Chunk, INDEX_PATH, _load_embedder

logger = logging.getLogger("rag.retriever")

# Recency weights per year (more recent = higher weight)
RECENCY_WEIGHTS: dict[int, float] = {2024: 1.0, 2023: 0.9, 2022: 0.8, 2021: 0.7}
DEFAULT_RECENCY_WEIGHT = 0.6
KEYWORD_BOOST = 0.15


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0.0 or mag_b == 0.0:
        return 0.0
    return dot / (mag_a * mag_b)


def _keyword_boost(query: str, chunk_text: str) -> float:
    """Return KEYWORD_BOOST if any significant query words appear in chunk."""
    query_words = set(w.lower() for w in re.findall(r"\w+", query) if len(w) > 3)
    chunk_lower = chunk_text.lower()
    if any(w in chunk_lower for w in query_words):
        return KEYWORD_BOOST
    return 0.0


class CounselingRetriever:
    """Hybrid cosine + keyword retriever with recency re-ranking."""

    def __init__(self, index_path: Path = INDEX_PATH) -> None:
        self.index_path = index_path
        self.chunks: List[Chunk] = []
        self._embedder = None
        self._loaded = False

    def _ensure_loaded(self) -> None:
        """Lazy-load chunks and embedder."""
        if self._loaded:
            return
        if self.index_path.exists():
            with open(self.index_path, "rb") as f:
                self.chunks = pickle.load(f)
            logger.info(f"Loaded {len(self.chunks)} chunks from index")
        else:
            logger.warning("No FAISS index found — running live ingest")
            from .ingest import KnowledgeBaseIngestor

            ingestor = KnowledgeBaseIngestor()
            self.chunks = ingestor.run()
        self._embedder = _load_embedder()
        self._loaded = True

    def _embed_query(self, query: str) -> List[float]:
        """Generate query embedding."""
        if self._embedder is None:
            return [0.0] * 384
        emb = self._embedder.encode([query], show_progress_bar=False)
        val = emb[0]
        return val.tolist() if hasattr(val, "tolist") else list(val)

    def _score_chunk(self, chunk: Chunk, query_emb: List[float], query: str) -> float:
        """Compute final score: cosine + keyword boost + recency weight."""
        cosine = _cosine_similarity(query_emb, chunk.embedding)
        boost = _keyword_boost(query, chunk.text)
        recency = RECENCY_WEIGHTS.get(chunk.year, DEFAULT_RECENCY_WEIGHT)
        return (cosine + boost) * recency

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.0,
        exam_type: Optional[str] = None,
    ) -> List[Tuple[Chunk, float]]:
        """Retrieve top-k chunks by hybrid score, filtered by min_score and quality rules."""
        self._ensure_loaded()
        query_emb = self._embed_query(query)
        scored = []
        q_lower = query.lower()

        # Specific procedural keywords to boost relevant rule chunks
        procedural_keywords = ["float", "freeze", "slide", "deposit", "refund", "mop-up", "mop up", "stray", "round 2", "round 3", "upgrade", "cancel"]
        has_procedural = any(kw in q_lower for kw in procedural_keywords)

        for chunk in self.chunks:
            # Filter out unhelpful generic PDF introductory headers
            text_lower = chunk.text.lower()
            if "section 1: introduction and general overview" in text_lower or "table of contents" in text_lower:
                continue

            score = self._score_chunk(chunk, query_emb, query)

            # Boost chunk if query asks about procedural rules and chunk contains matching procedural keywords
            if has_procedural:
                matches = sum(1 for kw in procedural_keywords if kw in q_lower and kw in text_lower)
                if matches > 0:
                    score += 0.25 * matches

            if exam_type and _should_boost_exam(chunk.source, exam_type):
                score += 0.20
            scored.append((chunk, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [(c, s) for c, s in scored[:top_k] if s >= min_score]

    def get_confidence_tier(self, retrieved_chunks: List[Tuple[Chunk, float]]) -> str:
        """Determine confidence tier based on similarity scores."""
        if not retrieved_chunks:
            return "DECLINED"
        top_score = retrieved_chunks[0][1]
        try:
            from sentence_transformers import SentenceTransformer

            is_embedder_available = True
        except Exception:
            is_embedder_available = False

        if is_embedder_available:
            if top_score >= 0.80:
                return "HIGH"
            elif top_score >= 0.65:
                return "MEDIUM"
            elif top_score >= 0.60:
                return "LOW"
            else:
                return "DECLINED"
        else:
            return "HIGH" if top_score >= 0.10 else "LOW"


def _should_boost_exam(source: str, exam_type: str) -> bool:
    """Check if the source file matches the exam type keywords for boosting."""
    if not source or not exam_type:
        return False
    source_lower = source.lower()
    exam_upper = exam_type.upper()
    if "NEET" in exam_upper:
        return "neet" in source_lower or "mcc" in source_lower
    elif "JEE" in exam_upper or "JOSAA" in exam_upper or "CSAB" in exam_upper:
        return "josaa" in source_lower or "jee" in source_lower
    elif "MHT" in exam_upper:
        return "mht" in source_lower
    elif "KCET" in exam_upper or "KEA" in exam_upper:
        return "kcet" in source_lower or "kea" in source_lower
    elif "BITS" in exam_upper:
        return "bits" in source_lower
    return False
