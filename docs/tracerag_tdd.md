# System Architecture & Technical Design Document (TDD)
**Project:** EvalLens — RAG Failure & Hallucination Observatory  

## 1. Data Flow & Hybrid Retrieval
1. **Idempotent Chunk Fingerprinting:** Hashes `(chunk_strategy, chunk_size, chunk_overlap, embedding_model)` into `pipeline_config_hash` to avoid redundant embedding API calls.
2. **PostgreSQL Hybrid RRF:** Combines `pgvector` HNSW cosine distance (`<=>`) and `tsvector` BM25 (`ts_rank_cd`) via Reciprocal Rank Fusion ($k=60$), optionally reranked by `cross-encoder/ms-marco-MiniLM-L-6-v2`.
3. **Async Evaluation Harness:** Uses `asyncio.Semaphore(5)` and OpenAI Structured Outputs (`JudgeEvaluationOutput`) with `temperature=0.0`, streaming progress over SSE.
