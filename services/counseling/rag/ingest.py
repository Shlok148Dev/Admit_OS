"""KnowledgeBaseIngestor — services/counseling/rag/ingest.py.

Parses seed documents, creates semantic chunks, generates embeddings,
and saves a FAISS index for retrieval.
"""

from __future__ import annotations

import logging
import pickle
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

logger = logging.getLogger("rag.ingest")

SEED_DOCS_DIR = Path(__file__).parent / "seed_docs"
INDEX_PATH = Path(__file__).parent / "faiss_index.pkl"

MIN_CHUNK_TOKENS = 150
MAX_CHUNK_TOKENS = 600


@dataclass
class Chunk:
    """A single text chunk with metadata."""

    text: str
    source: str
    year: int = 2024
    chunk_id: int = 0
    embedding: List[float] = field(default_factory=list)


def _count_tokens(text: str) -> int:
    """Approximate token count using word count (1.3 words per token heuristic)."""
    return max(1, int(len(text.split()) / 1.3))


def _split_into_chunks(text: str, source: str) -> List[Chunk]:
    """Split text into semantic chunks respecting min/max token limits."""
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks: List[Chunk] = []
    buffer = ""
    chunk_id = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        combined = (buffer + "\n\n" + para).strip() if buffer else para
        if _count_tokens(combined) > MAX_CHUNK_TOKENS and buffer:
            if _count_tokens(buffer) >= MIN_CHUNK_TOKENS:
                chunks.append(Chunk(text=buffer, source=source, chunk_id=chunk_id))
                chunk_id += 1
            buffer = para
        else:
            buffer = combined

    if buffer and _count_tokens(buffer) >= MIN_CHUNK_TOKENS:
        chunks.append(Chunk(text=buffer, source=source, chunk_id=chunk_id))

    return chunks


_CACHED_EMBEDDER = None


def _load_embedder():  # type: ignore[return]
    """Load sentence-transformers model (all-MiniLM-L6-v2) with singleton caching."""
    global _CACHED_EMBEDDER
    if _CACHED_EMBEDDER is not None:
        return _CACHED_EMBEDDER
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore[import]

        _CACHED_EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        return _CACHED_EMBEDDER
    except Exception:
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore[import]

            _CACHED_EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
            return _CACHED_EMBEDDER
        except Exception as e:
            logger.warning(f"sentence-transformers unavailable: {e}")
            return None


class KnowledgeBaseIngestor:
    """Ingests seed documents into a FAISS vector store."""

    def __init__(self, seed_dir: Path = SEED_DOCS_DIR) -> None:
        self.seed_dir = seed_dir
        self.chunks: List[Chunk] = []

    def load_documents(self) -> List[Chunk]:
        """Read all .txt seed documents and split into chunks."""
        all_chunks: List[Chunk] = []
        for txt_path in sorted(self.seed_dir.glob("*.txt")):
            content = txt_path.read_text(encoding="utf-8", errors="ignore")
            chunks = _split_into_chunks(content, source=txt_path.name)
            logger.info(f"Loaded {len(chunks)} chunks from {txt_path.name}")
            all_chunks.extend(chunks)
        self.chunks = all_chunks
        return all_chunks

    def embed_chunks(self) -> None:
        """Generate embeddings for all chunks using sentence-transformers."""
        model = _load_embedder()
        if model is None:
            logger.warning("Embedder unavailable — using zero vectors")
            for chunk in self.chunks:
                chunk.embedding = [0.0] * 384
            return
        texts = [c.text for c in self.chunks]
        embeddings = model.encode(texts, show_progress_bar=False)
        for chunk, emb in zip(self.chunks, embeddings):
            chunk.embedding = emb.tolist()

    def save_index(self, index_path: Path = INDEX_PATH) -> None:
        """Persist chunks with embeddings to disk as pickle (FAISS-ready)."""
        index_path.parent.mkdir(parents=True, exist_ok=True)
        with open(index_path, "wb") as f:
            pickle.dump(self.chunks, f)
        logger.info(f"Saved {len(self.chunks)} chunks to {index_path}")

    def run(self) -> List[Chunk]:
        """Full ingestion pipeline: load → embed → save."""
        self.load_documents()
        self.embed_chunks()
        self.save_index()
        return self.chunks


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ingestor = KnowledgeBaseIngestor()
    ingestor.run()
