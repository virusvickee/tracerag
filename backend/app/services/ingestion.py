import hashlib
import logging
import math
import re
from typing import List, Optional
from uuid import UUID
import fitz  # PyMuPDF
from openai import AsyncOpenAI
import openai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.retry import call_with_retry
from app.models.domain import Document, DocumentChunk
from app.services.retrieval import compute_pipeline_config_hash

logger = logging.getLogger(__name__)


def generate_pseudo_embedding(text: str, dim: int = 1536) -> List[float]:
    """
    Generates a deterministic 1536-dimensional unit vector from text hash
    for zero-config Demo Mode runs when no valid OpenAI key is supplied.
    """
    h = hashlib.sha256(text.encode("utf-8")).digest()
    vec: List[float] = []
    for i in range(dim):
        byte_val = h[i % len(h)]
        val = ((byte_val ^ (i & 0xFF)) / 255.0) - 0.5
        vec.append(val)
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def extract_text_from_bytes(filename: str, file_bytes: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = [page.get_text("text") for page in doc]
        return "\n\n".join(pages).strip()
    return file_bytes.decode("utf-8", errors="replace").strip()


def split_text_chunks(
    text: str,
    strategy: str = "RECURSIVE",
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """
    Word-approximate token chunker supporting FIXED sliding windows and
    RECURSIVE paragraph/sentence boundary splitting.
    """
    words_per_chunk = max(32, int(chunk_size * 0.75))
    overlap_words = max(0, int(chunk_overlap * 0.75))

    if strategy == "FIXED":
        words = text.split()
        if not words:
            return []
        chunks = []
        step = max(1, words_per_chunk - overlap_words)
        for i in range(0, len(words), step):
            chunk = " ".join(words[i : i + words_per_chunk])
            if chunk:
                chunks.append(chunk)
        return chunks

    # RECURSIVE paragraph-aware splitting
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: List[str] = []
    current_words: List[str] = []

    for para in paragraphs:
        p_words = para.split()
        if len(current_words) + len(p_words) <= words_per_chunk:
            current_words.extend(p_words)
        else:
            if current_words:
                chunks.append(" ".join(current_words))
                current_words = current_words[-overlap_words:] if overlap_words > 0 else []
            if len(p_words) > words_per_chunk:
                step = max(1, words_per_chunk - overlap_words)
                for i in range(0, len(p_words), step):
                    chunks.append(" ".join(p_words[i : i + words_per_chunk]))
                current_words = []
            else:
                current_words.extend(p_words)

    if current_words:
        chunks.append(" ".join(current_words))

    return chunks


async def ensure_chunks_indexed(
    db: AsyncSession,
    workspace_id: UUID,
    chunk_strategy: str,
    chunk_size: int,
    chunk_overlap: int,
    api_key: Optional[str] = None,
) -> str:
    """
    Idempotently chunks and embeds all workspace documents for a given pipeline configuration.
    Includes exponential backoff retries for OpenAI embeddings calls and graceful Demo Mode fallback.
    """
    config_hash = compute_pipeline_config_hash(
        chunk_strategy, chunk_size, chunk_overlap, settings.DEFAULT_EMBEDDING_MODEL
    )

    docs_res = await db.execute(select(Document).where(Document.workspace_id == workspace_id))
    documents = docs_res.scalars().all()
    if not documents:
        return config_hash

    effective_key = api_key or settings.OPENAI_API_KEY
    has_valid_key = bool(effective_key and not effective_key.startswith("sk-..."))
    client = AsyncOpenAI(api_key=effective_key) if has_valid_key else None

    for doc in documents:
        existing = await db.execute(
            select(DocumentChunk.id)
            .where(
                DocumentChunk.document_id == doc.id,
                DocumentChunk.pipeline_config_hash == config_hash,
            )
            .limit(1)
        )
        if existing.scalar_one_or_none():
            continue

        raw_chunks = split_text_chunks(doc.raw_text, chunk_strategy, chunk_size, chunk_overlap)
        if not raw_chunks:
            continue

        # Ingest in batches to avoid rate limits or token overruns
        batch_size = 64
        for batch_start in range(0, len(raw_chunks), batch_size):
            batch_chunks = raw_chunks[batch_start : batch_start + batch_size]
            embeddings: List[List[float]] = []

            if client:
                try:
                    emb_resp = await call_with_retry(
                        lambda: client.embeddings.create(
                            model=settings.DEFAULT_EMBEDDING_MODEL,
                            input=batch_chunks,
                        ),
                        operation_name="Ingestion Embeddings",
                    )
                    embeddings = [item.embedding for item in emb_resp.data]
                except (openai.AuthenticationError, openai.PermissionDeniedError) as auth_err:
                    logger.warning(
                        f"OpenAI Auth error during ingestion: {auth_err}. Falling back to deterministic embeddings."
                    )
                    embeddings = [generate_pseudo_embedding(c) for c in batch_chunks]
            else:
                embeddings = [generate_pseudo_embedding(c) for c in batch_chunks]

            for offset, (chunk_text, emb_vector) in enumerate(zip(batch_chunks, embeddings)):
                chunk_idx = batch_start + offset
                db.add(
                    DocumentChunk(
                        document_id=doc.id,
                        pipeline_config_hash=config_hash,
                        chunk_index=chunk_idx,
                        content=chunk_text,
                        embedding=emb_vector,
                    )
                )

    await db.commit()
    return config_hash
