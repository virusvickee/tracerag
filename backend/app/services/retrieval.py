import hashlib
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sentence_transformers import CrossEncoder

_reranker_instance: Optional[CrossEncoder] = None


def get_reranker() -> CrossEncoder:
    global _reranker_instance
    if _reranker_instance is None:
        _reranker_instance = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _reranker_instance


def compute_pipeline_config_hash(
    chunk_strategy: str, chunk_size: int, chunk_overlap: int, embedding_model: str
) -> str:
    raw = f"{chunk_strategy}:{chunk_size}:{chunk_overlap}:{embedding_model}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def retrieve_chunks(
    db: AsyncSession,
    config_hash: str,
    query_text: str,
    query_embedding: List[float],
    retrieval_mode: str = "HYBRID",
    top_k: int = 5,
    use_reranker: bool = False,
) -> Dict[str, Any]:
    candidate_limit = 25
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    if retrieval_mode == "DENSE":
        sql = text("""
            SELECT
                dc.id::text AS chunk_id,
                dc.document_id::text AS document_id,
                d.filename AS document_filename,
                dc.content,
                ROW_NUMBER() OVER (ORDER BY dc.embedding <=> CAST(:emb AS vector)) AS dense_rank,
                NULL::int AS sparse_rank,
                (1.0 - (dc.embedding <=> CAST(:emb AS vector))) AS rrf_score
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.pipeline_config_hash = :config_hash
            ORDER BY dc.embedding <=> CAST(:emb AS vector)
            LIMIT :limit
        """)
        params = {"emb": embedding_str, "config_hash": config_hash, "limit": candidate_limit}
    elif retrieval_mode == "SPARSE":
        sql = text("""
            SELECT
                dc.id::text AS chunk_id,
                dc.document_id::text AS document_id,
                d.filename AS document_filename,
                dc.content,
                NULL::int AS dense_rank,
                ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.fts_tokens, plainto_tsquery('english', :q)) DESC) AS sparse_rank,
                ts_rank_cd(dc.fts_tokens, plainto_tsquery('english', :q)) AS rrf_score
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.pipeline_config_hash = :config_hash
              AND dc.fts_tokens @@ plainto_tsquery('english', :q)
            ORDER BY rrf_score DESC
            LIMIT :limit
        """)
        params = {"q": query_text, "config_hash": config_hash, "limit": candidate_limit}
    else:
        sql = text("""
            WITH semantic_search AS (
                SELECT
                    id,
                    document_id,
                    content,
                    ROW_NUMBER() OVER (ORDER BY embedding <=> CAST(:emb AS vector)) AS dense_rank
                FROM document_chunks
                WHERE pipeline_config_hash = :config_hash
                ORDER BY embedding <=> CAST(:emb AS vector)
                LIMIT 25
            ),
            keyword_search AS (
                SELECT
                    id,
                    document_id,
                    content,
                    ROW_NUMBER() OVER (ORDER BY ts_rank_cd(fts_tokens, plainto_tsquery('english', :q)) DESC) AS sparse_rank
                FROM document_chunks
                WHERE pipeline_config_hash = :config_hash
                  AND fts_tokens @@ plainto_tsquery('english', :q)
                LIMIT 25
            )
            SELECT
                COALESCE(s.id, k.id)::text AS chunk_id,
                COALESCE(s.document_id, k.document_id)::text AS document_id,
                d.filename AS document_filename,
                COALESCE(s.content, k.content) AS content,
                s.dense_rank,
                k.sparse_rank,
                (
                    COALESCE(1.0 / (60 + s.dense_rank), 0.0) +
                    COALESCE(1.0 / (60 + k.sparse_rank), 0.0)
                ) AS rrf_score
            FROM semantic_search s
            FULL OUTER JOIN keyword_search k ON s.id = k.id
            JOIN documents d ON d.id = COALESCE(s.document_id, k.document_id)
            ORDER BY rrf_score DESC
            LIMIT :limit
        """)
        params = {"emb": embedding_str, "q": query_text, "config_hash": config_hash, "limit": candidate_limit}

    result = await db.execute(sql, params)
    rows = [dict(r._mapping) for r in result.fetchall()]
    for item in rows:
        if item.get("rrf_score") is not None:
            item["rrf_score"] = float(item["rrf_score"])
        if item.get("dense_rank") is not None:
            item["dense_rank"] = int(item["dense_rank"])
        if item.get("sparse_rank") is not None:
            item["sparse_rank"] = int(item["sparse_rank"])
    top_25_doc_ids = {r["document_id"] for r in rows}

    if use_reranker and rows:
        reranker = get_reranker()
        rerank_pool = rows[:15]
        pairs = [(query_text, item["content"]) for item in rerank_pool]
        scores = reranker.predict(pairs)
        for item, score in zip(rerank_pool, scores):
            item["rerank_score"] = float(score)
        rerank_pool.sort(key=lambda x: x["rerank_score"], reverse=True)
        final_chunks = rerank_pool[:top_k]
    else:
        for item in rows:
            item["rerank_score"] = None
        final_chunks = rows[:top_k]

    for idx, chunk in enumerate(final_chunks, start=1):
        chunk["rank"] = idx

    return {
        "chunks": final_chunks,
        "top_25_doc_ids": top_25_doc_ids,
    }
