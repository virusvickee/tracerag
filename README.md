# TraceRAG — Retrieval & Hallucination Observatory

**TraceRAG** is a production-grade RAG evaluation, failure analysis, and A/B experimentation observatory built for AI engineers. Instead of treating RAG like a black-box chat interface over PDFs, TraceRAG enables developers to benchmark retrieval architectures side-by-side against a locked golden dataset, compute grounded RAG Triad metrics, and systematically isolate whether an issue was caused by **retrieval**, **ranking**, **context distraction**, or **generation hallucination**.

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Next.js 14 Observatory UI                          │
│  • Pareto Trade-Off Chart        • Failure Taxonomy Stacked Bar Chart       │
│  • Pipelines A/B Configurator    • Corpus Upload & Synthetic Q&A Generator   │
│  • Split-Screen Trace Inspector (Sentence-Level Claim Grounding Diffs)       │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ REST + Server-Sent Events (SSE)
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                           FastAPI Evaluation Engine                          │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ Ingestion & Chunking │  │ Hybrid Retriever │  │ Pydantic LLM-as-a-Judge│  │
│  │ (Fixed / Recursive)  │  │ (Dense+BM25 RRF) │  │ (Async Semaphore=5)    │  │
│  └──────────┬───────────┘  └────────┬─────────┘  └───────────┬────────────┘  │
│             │                       │                        │               │
│  ┌──────────▼───────────────────────▼────────────────────────▼────────────┐  │
│  │ Production Hardening: Exponential Backoff (Jitter) + Demo Rate Limiting│  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                           PostgreSQL 16 + pgvector                           │
│  • vector(1536) HNSW Cosine Index (<=>)   • tsvector GIN Keyword Rank Index  │
│  • Idempotent Chunk Fingerprint Hashes   • Eval Trace Comparisons & Results │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Capabilities & Interactive Views

### 1. Observatory Dashboard (`/observatory/[workspaceId]`)
- **KPI Delta Cards**: Faithfulness, Context Recall, Average Latency, and Estimated Cost per 1,000 queries in INR (₹) comparing Pipeline B vs. Pipeline A.
- **Pareto Trade-Off Chart**: Cost vs. Faithfulness scatter plot with latency bubbles identifying optimal price-to-accuracy frontiers.
- **Failure Taxonomy Stacked Bar Chart**: Visual breakdown of evaluation outcomes into:
  - `PASS`: Grounded, faithful response with high context recall.
  - `RETRIEVAL_MISS`: Target document chunk not present in the top-25 candidate pool.
  - `RANKING_DROP`: Target chunk found in candidate pool but displaced out of top-K.
  - `CONTEXT_DISTRACTION`: Extraneous retrieved chunks distracted the generator into a wrong answer.
  - `HALLUCINATION`: High recall but generated claims contradictory or unsupported by retrieved context.
- **Split-Screen Trace Inspector Drawer**: Side-by-side claim verification highlighting supported claims in **emerald** and hallucinated claims in **rose**, linked to exact source context chunks.

### 2. Pipelines A/B Configurator (`/observatory/[workspaceId]/pipelines`)
- **Chunking Strategies**: Toggle between `RECURSIVE` (semantic paragraph and sentence boundary splitting) and `FIXED` (word-count sliding window).
- **Chunk Size & Overlap**: Fine-tune token targets (128–1024 tokens) and overlap buffers.
- **Retrieval Architecture**:
  - `HYBRID`: Reciprocal Rank Fusion ($k=60$) combining `pgvector` HNSW cosine similarity + PostgreSQL `tsvector` BM25 keyword matching.
  - `DENSE`: Vector-only cosine distance search (`<=>`) over 1536-dim embeddings.
  - `SPARSE`: Full-Text Search via PostgreSQL `ts_rank_cd` and GIN index.
- **Top-K Chunks**: Select how many chunks are injected into the context window.
- **Cross-Encoder Reranker**: Toggle `cross-encoder/ms-marco-MiniLM-L-6-v2` re-scoring to eliminate ranking drops.
- **Quick A/B Run Launcher**: Designate any two pipelines as Pipeline A and Pipeline B and trigger evaluation.

### 3. Corpus & Golden Datasets (`/observatory/[workspaceId]/datasets`)
- **Document Management**: Upload `.pdf`, `.md`, or `.txt` files (`POST /api/v1/workspaces/{id}/documents`) with automatic token estimation and text extraction.
- **1-Click Synthetic Q&A Generator**: Automatically generate grounded `SINGLE_HOP`, `MULTI_HOP`, and `UNANSWERABLE` test cases with locked ground truths (`POST /api/v1/datasets/{id}/generate-synthetic`).
- **Manual Test Case Creator**: Add custom test cases with difficulty tags and expected document bindings.
- **Filtered Test Case Browser**: Filter benchmark cases by difficulty tag or search query.

---

## Production Hardening Features

- **Exponential Backoff with Jitter**: Robust retries for all OpenAI embeddings, completions, and judge calls (`app.core.retry.call_with_retry`) protecting against HTTP 429 rate limits, timeouts, and transient network drops.
- **Demo Mode Sliding Window Rate Limiting**: In-memory rate limiter enforcing a maximum of 5 runs per 10 minutes when no `X-Provider-Key` header is supplied, preventing abuse of shared demo credentials.
- **Zero-Setup Demo Workspace**: Pre-seeded with AcmeCloud Enterprise billing policies, API rate limit rules, and pre-computed evaluation diffs ready to inspect on initial startup.
- **Client-Side BYOK Security**: API keys are stored strictly in browser `sessionStorage` and transmitted solely in request headers (`X-Provider-Key`).

---

## Quickstart (Docker Compose)

1. **Clone & configure environment:**
   ```bash
   cp .env.example .env
   # Add your OPENAI_API_KEY (or explore Demo Mode without keys)
   ```

2. **Start the full stack:**
   ```bash
   docker-compose up --build
   ```

3. **Access endpoints:**
   - **Observatory UI**: [http://localhost:3000](http://localhost:3000)
   - **FastAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **PostgreSQL Vector DB**: `localhost:5432` (User: `evallens`, DB: `evallens`)

---

## API Reference Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/workspaces` | List all workspaces with pipelines, datasets, and latest run IDs |
| `GET` | `/api/v1/workspaces/{id}` | Detailed workspace summary with documents and datasets |
| `POST` | `/api/v1/workspaces` | Create a new workspace |
| `GET` | `/api/v1/workspaces/{id}/documents` | List uploaded documents in a workspace |
| `POST` | `/api/v1/workspaces/{id}/documents` | Upload a PDF/MD/TXT document |
| `DELETE` | `/api/v1/workspaces/{id}/documents/{doc_id}` | Delete a document |
| `GET` | `/api/v1/workspaces/{id}/pipelines` | List configured pipeline profiles |
| `POST` | `/api/v1/pipelines` | Create a custom pipeline profile |
| `DELETE` | `/api/v1/pipelines/{id}` | Delete a pipeline profile |
| `GET` | `/api/v1/workspaces/{id}/datasets` | List golden datasets in a workspace |
| `POST` | `/api/v1/workspaces/{id}/datasets` | Create a new golden dataset |
| `GET` | `/api/v1/datasets/{id}/cases` | List test cases for a golden dataset |
| `POST` | `/api/v1/datasets/{id}/cases` | Add a manual test case |
| `DELETE` | `/api/v1/datasets/{id}/cases/{case_id}` | Delete a test case |
| `POST` | `/api/v1/datasets/{id}/generate-synthetic` | 1-Click synthetic Q&A generation from corpus |
| `POST` | `/api/v1/experiments` | Launch an A/B evaluation experiment run |
| `GET` | `/api/v1/experiments/{id}/stream` | Stream live SSE progress events (`data: {...}`) |
| `GET` | `/api/v1/experiments/{id}/results` | Fetch complete evaluation comparison results |
