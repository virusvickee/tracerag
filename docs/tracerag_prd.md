# Product Requirements Document (PRD)
**Project Name:** EvalLens — RAG Failure & Hallucination Observatory  
**Core Stack:** Next.js 14+ (App Router, TypeScript), FastAPI (Python), PostgreSQL (`pgvector`), Docker  

## 1. Problem & Solution
Most RAG portfolio projects stop at a chat interface over a PDF. EvalLens is a developer-first RAG observability and A/B experimentation workbench that lets engineers compare retrieval pipelines side-by-side against a locked golden dataset, compute RAG Triad metrics (Faithfulness, Context Recall, Answer Relevance), and isolate retrieval vs. generation failures.

## 2. Core Capabilities
- **Corpus & Golden Dataset Management:** Upload PDF/MD/TXT documents, build manual or synthetic test cases (`SINGLE_HOP`, `MULTI_HOP`, `UNANSWERABLE`).
- **Modular Pipeline Profiles:** Configure chunking (`FIXED` vs `RECURSIVE`), retrieval (`DENSE`, `SPARSE`, `HYBRID` RRF), optional Cross-Encoder reranking, and generation prompts.
- **Automated Failure Taxonomy:** Categorizes failed test cases into `RETRIEVAL_MISS`, `RANKING_DROP`, `CONTEXT_DISTRACTION`, or `HALLUCINATION`.
- **Zero-Setup Demo Workspace:** Ships pre-seeded with a SaaS Billing & API policy dataset and pre-run A/B traces.
