import uuid
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.domain import (
    Document,
    EvalResult,
    ExperimentRun,
    GoldenDataset,
    Pipeline,
    TestCase,
    Workspace,
)

DEMO_WORKSPACE_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEMO_RUN_ID = uuid.UUID("99999999-9999-9999-9999-999999999999")


async def seed_demo_workspace() -> None:
    """
    Seeds a zero-setup Demo Workspace with pre-computed A/B RAG traces so recruiters
    and developers can immediately inspect failure diffs without providing an API key.
    """
    async with AsyncSessionLocal() as db:
        existing = await db.get(Workspace, DEMO_WORKSPACE_ID)
        if existing:
            return

        ws = Workspace(
            id=DEMO_WORKSPACE_ID,
            name="AcmeCloud Billing & API Docs (Demo)",
            is_demo_preset=True,
        )
        db.add(ws)

        doc_billing = Document(
            id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
            workspace_id=ws.id,
            filename="enterprise_billing_policy_v2.md",
            raw_text=(
                "# Enterprise Annual Plan Refund Policy\n"
                "Annual Enterprise contracts cancelled mid-term are eligible for a prorated refund "
                "for all unused full calendar months, minus a 5% administrative processing fee. "
                "Monthly self-serve plans are non-refundable once the billing cycle starts."
            ),
            token_count=64,
        )
        doc_rate = Document(
            id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
            workspace_id=ws.id,
            filename="api_rate_limits_2026.md",
            raw_text=(
                "# API Rate Limits & Burst Quotas\n"
                "Standard tier workspaces allow 120 requests/minute. Enterprise tier workspaces "
                "receive 1,500 requests/minute with a 10-second burst allowance up to 3,000 RPM."
            ),
            token_count=48,
        )
        pipe_a = Pipeline(
            id=uuid.UUID("44444444-4444-4444-4444-444444444444"),
            workspace_id=ws.id,
            name="Pipeline A: Fixed 512 + Dense Only",
            chunk_strategy="FIXED",
            chunk_size=512,
            chunk_overlap=0,
            retrieval_mode="DENSE",
            top_k=3,
            use_reranker=False,
            model_name="gpt-4o-mini",
            system_prompt="Answer using the retrieved context.",
        )
        pipe_b = Pipeline(
            id=uuid.UUID("55555555-5555-5555-5555-555555555555"),
            workspace_id=ws.id,
            name="Pipeline B: Recursive + Hybrid RRF + Reranker",
            chunk_strategy="RECURSIVE",
            chunk_size=256,
            chunk_overlap=32,
            retrieval_mode="HYBRID",
            top_k=3,
            use_reranker=True,
            model_name="gpt-4o-mini",
            system_prompt="Answer strictly using the retrieved context.",
        )
        dataset = GoldenDataset(
            id=uuid.UUID("66666666-6666-6666-6666-666666666666"),
            workspace_id=ws.id,
            name="SaaS Policy & Quota Golden Set",
            description="Benchmark suite testing multi-hop billing rules and exact rate limits.",
        )
        db.add_all([doc_billing, doc_rate, pipe_a, pipe_b, dataset])
        await db.flush()

        tc1 = TestCase(
            id=uuid.UUID("77777777-7777-7777-7777-777777777771"),
            dataset_id=dataset.id,
            question="How are prorated refunds calculated on cancelled Enterprise annual plans?",
            ground_truth="Unused full calendar months are refunded minus a 5% administrative processing fee.",
            difficulty_tag="MULTI_HOP",
            expected_doc_id=doc_billing.id,
        )
        tc2 = TestCase(
            id=uuid.UUID("77777777-7777-7777-7777-777777777772"),
            dataset_id=dataset.id,
            question="What is the burst RPM limit for Enterprise workspaces?",
            ground_truth="Enterprise tier workspaces have a 10-second burst allowance up to 3,000 RPM.",
            difficulty_tag="SINGLE_HOP",
            expected_doc_id=doc_rate.id,
        )
        db.add_all([tc1, tc2])
        await db.flush()

        run = ExperimentRun(
            id=DEMO_RUN_ID,
            dataset_id=dataset.id,
            pipeline_a_id=pipe_a.id,
            pipeline_b_id=pipe_b.id,
            status="COMPLETED",
            summary_metrics_json={"seeded": True},
        )
        db.add(run)
        await db.flush()

        chunk_wrong = {
            "chunk_id": "chk-a1",
            "document_id": str(doc_billing.id),
            "document_filename": "self_serve_faq.md",
            "rank": 1,
            "dense_rank": 1,
            "sparse_rank": None,
            "rrf_score": 0.74,
            "rerank_score": None,
            "content": "Monthly self-serve plans are non-refundable once the billing cycle starts.",
            "is_utilized": True,
        }
        chunk_right = {
            "chunk_id": "chk-b1",
            "document_id": str(doc_billing.id),
            "document_filename": "enterprise_billing_policy_v2.md",
            "rank": 1,
            "dense_rank": 2,
            "sparse_rank": 1,
            "rrf_score": 0.0325,
            "rerank_score": 8.92,
            "content": "Annual Enterprise contracts cancelled mid-term are eligible for a prorated refund for all unused full calendar months, minus a 5% administrative processing fee.",
            "is_utilized": True,
        }
        chunk_rate = {
            "chunk_id": "chk-r1",
            "document_id": str(doc_rate.id),
            "document_filename": "api_rate_limits_2026.md",
            "rank": 1,
            "dense_rank": 1,
            "sparse_rank": 1,
            "rrf_score": 0.0328,
            "rerank_score": 9.41,
            "content": "Standard tier workspaces allow 120 requests/minute. Enterprise tier workspaces receive 1,500 requests/minute with a 10-second burst allowance up to 3,000 RPM.",
            "is_utilized": True,
        }

        results = [
            EvalResult(
                run_id=run.id,
                test_case_id=tc1.id,
                pipeline_id=pipe_a.id,
                generated_answer="Annual plans are non-refundable once the billing cycle starts, though a 10% fee may apply.",
                retrieved_chunks_json=[chunk_wrong],
                claim_verifications_json=[
                    {
                        "sentence": "Annual plans are non-refundable once the billing cycle starts.",
                        "verdict": "HALLUCINATED",
                        "supporting_chunk_id": None,
                        "supporting_quote": None,
                    },
                    {
                        "sentence": "A 10% fee may apply.",
                        "verdict": "HALLUCINATED",
                        "supporting_chunk_id": None,
                        "supporting_quote": None,
                    },
                ],
                scores_json={
                    "faithfulness": 0.0,
                    "context_recall": 0.2,
                    "context_precision": 0.3,
                    "answer_relevance": 0.65,
                    "chunk_utilization": 1.0,
                },
                failure_category="RANKING_DROP",
                latency_ms=610,
                token_usage_json={"prompt_tokens": 310, "completion_tokens": 24},
            ),
            EvalResult(
                run_id=run.id,
                test_case_id=tc1.id,
                pipeline_id=pipe_b.id,
                generated_answer="Cancelled Enterprise annual contracts receive a prorated refund for unused full calendar months, minus a 5% administrative processing fee.",
                retrieved_chunks_json=[chunk_right],
                claim_verifications_json=[
                    {
                        "sentence": "Cancelled Enterprise annual contracts receive a prorated refund for unused full calendar months, minus a 5% administrative processing fee.",
                        "verdict": "SUPPORTED",
                        "supporting_chunk_id": "chk-b1",
                        "supporting_quote": "eligible for a prorated refund for all unused full calendar months, minus a 5% administrative processing fee.",
                    }
                ],
                scores_json={
                    "faithfulness": 1.0,
                    "context_recall": 1.0,
                    "context_precision": 1.0,
                    "answer_relevance": 0.98,
                    "chunk_utilization": 1.0,
                },
                failure_category="PASS",
                latency_ms=880,
                token_usage_json={"prompt_tokens": 420, "completion_tokens": 26},
            ),
            EvalResult(
                run_id=run.id,
                test_case_id=tc2.id,
                pipeline_id=pipe_a.id,
                generated_answer="Enterprise workspaces are limited to 1,500 requests per minute.",
                retrieved_chunks_json=[chunk_rate],
                claim_verifications_json=[
                    {
                        "sentence": "Enterprise workspaces are limited to 1,500 requests per minute.",
                        "verdict": "SUPPORTED",
                        "supporting_chunk_id": "chk-r1",
                        "supporting_quote": "Enterprise tier workspaces receive 1,500 requests/minute",
                    }
                ],
                scores_json={
                    "faithfulness": 1.0,
                    "context_recall": 0.5,
                    "context_precision": 1.0,
                    "answer_relevance": 0.7,
                    "chunk_utilization": 1.0,
                },
                failure_category="CONTEXT_DISTRACTION",
                latency_ms=590,
                token_usage_json={"prompt_tokens": 295, "completion_tokens": 14},
            ),
            EvalResult(
                run_id=run.id,
                test_case_id=tc2.id,
                pipeline_id=pipe_b.id,
                generated_answer="Enterprise workspaces have a 10-second burst allowance of up to 3,000 RPM.",
                retrieved_chunks_json=[chunk_rate],
                claim_verifications_json=[
                    {
                        "sentence": "Enterprise workspaces have a 10-second burst allowance of up to 3,000 RPM.",
                        "verdict": "SUPPORTED",
                        "supporting_chunk_id": "chk-r1",
                        "supporting_quote": "with a 10-second burst allowance up to 3,000 RPM.",
                    }
                ],
                scores_json={
                    "faithfulness": 1.0,
                    "context_recall": 1.0,
                    "context_precision": 1.0,
                    "answer_relevance": 1.0,
                    "chunk_utilization": 1.0,
                },
                failure_category="PASS",
                latency_ms=840,
                token_usage_json={"prompt_tokens": 390, "completion_tokens": 18},
            ),
        ]
        db.add_all(results)
        await db.commit()
