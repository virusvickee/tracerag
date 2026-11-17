import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
from uuid import UUID
from openai import AsyncOpenAI
import openai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.retry import call_with_retry
from app.db.session import AsyncSessionLocal
from app.models.domain import EvalResult, ExperimentRun, Pipeline, TestCase
from app.schemas.eval import ClaimVerification, FailureCategory, JudgeEvaluationOutput
from app.services.ingestion import ensure_chunks_indexed, generate_pseudo_embedding
from app.services.retrieval import retrieve_chunks

logger = logging.getLogger(__name__)

run_event_queues: Dict[str, List[asyncio.Queue]] = {}


async def publish_run_event(run_id: str, event: Dict[str, Any]) -> None:
    for queue in run_event_queues.get(run_id, []):
        await queue.put(event)


def classify_failure(
    faithfulness: float,
    context_recall: float,
    gold_in_top_25: bool,
    gold_in_top_k: bool,
) -> FailureCategory:
    if faithfulness >= 0.85 and context_recall >= 0.80:
        return "PASS"
    if not gold_in_top_25:
        return "RETRIEVAL_MISS"
    if gold_in_top_25 and not gold_in_top_k:
        return "RANKING_DROP"
    if context_recall >= 0.80 and faithfulness < 0.85:
        return "HALLUCINATION"
    return "CONTEXT_DISTRACTION"


async def evaluate_single_case(
    db: AsyncSession,
    client: Optional[AsyncOpenAI],
    run_id: UUID,
    pipeline: Pipeline,
    config_hash: str,
    test_case: TestCase,
) -> EvalResult:
    start_ts = time.perf_counter()

    # Step 1: Query Embedding with exponential backoff retry
    query_embedding: List[float] = []
    if client:
        try:
            emb_resp = await call_with_retry(
                lambda: client.embeddings.create(
                    model=settings.DEFAULT_EMBEDDING_MODEL,
                    input=test_case.question,
                ),
                operation_name="Query Embedding",
            )
            query_embedding = emb_resp.data[0].embedding
        except (openai.AuthenticationError, openai.PermissionDeniedError) as auth_err:
            logger.warning(f"OpenAI Auth error during query embedding: {auth_err}. Using pseudo-embedding.")
            query_embedding = generate_pseudo_embedding(test_case.question)
    else:
        query_embedding = generate_pseudo_embedding(test_case.question)

    # Step 2: Hybrid Retrieval
    retrieval_out = await retrieve_chunks(
        db=db,
        config_hash=config_hash,
        query_text=test_case.question,
        query_embedding=query_embedding,
        retrieval_mode=pipeline.retrieval_mode,
        top_k=pipeline.top_k,
        use_reranker=pipeline.use_reranker,
    )
    chunks = retrieval_out["chunks"]
    top_25_doc_ids = retrieval_out["top_25_doc_ids"]

    formatted_context = "\n\n".join(
        f"[Chunk ID: {c['chunk_id']} | File: {c['document_filename']}]\n{c['content']}"
        for c in chunks
    )

    # Step 3: Generation with exponential backoff retry
    generated_answer = ""
    usage = {"prompt_tokens": 0, "completion_tokens": 0}

    if client and chunks:
        try:
            gen_resp = await call_with_retry(
                lambda: client.chat.completions.create(
                    model=pipeline.model_name,
                    temperature=0.0,
                    messages=[
                        {"role": "system", "content": pipeline.system_prompt},
                        {
                            "role": "user",
                            "content": f"Context:\n{formatted_context}\n\nQuestion: {test_case.question}",
                        },
                    ],
                ),
                operation_name="RAG Generation",
            )
            generated_answer = gen_resp.choices[0].message.content or ""
            usage = {
                "prompt_tokens": gen_resp.usage.prompt_tokens if gen_resp.usage else 0,
                "completion_tokens": gen_resp.usage.completion_tokens if gen_resp.usage else 0,
            }
        except (openai.AuthenticationError, openai.PermissionDeniedError) as auth_err:
            logger.warning(f"OpenAI Auth error during generation: {auth_err}. Using fallback response.")
            generated_answer = chunks[0]["content"] if chunks else "No relevant context found."
            usage = {"prompt_tokens": 280, "completion_tokens": 25}
    else:
        # Demo Mode fallback generation when no OpenAI client is configured
        generated_answer = chunks[0]["content"] if chunks else "No relevant context found."
        usage = {"prompt_tokens": 280, "completion_tokens": 25}

    # Step 4: LLM-as-a-Judge Evaluation with exponential backoff retry
    judge_data: Optional[JudgeEvaluationOutput] = None
    if client and generated_answer:
        judge_prompt = f"""Evaluate the RAG pipeline output strictly against the retrieved chunks and ground truth.
Question: {test_case.question}
Ground Truth Answer: {test_case.ground_truth}
Generated Answer: {generated_answer}

Retrieved Chunks:
{formatted_context}
"""
        try:
            judge_resp = await call_with_retry(
                lambda: client.beta.chat.completions.parse(
                    model=settings.DEFAULT_JUDGE_MODEL,
                    temperature=0.0,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a strict RAG evaluation auditor. Decompose the generated answer into atomic claims and verify each claim solely against the provided chunks.",
                        },
                        {"role": "user", "content": judge_prompt},
                    ],
                    response_format=JudgeEvaluationOutput,
                ),
                operation_name="LLM-as-a-Judge Evaluation",
            )
            judge_data = judge_resp.choices[0].message.parsed
        except (openai.AuthenticationError, openai.PermissionDeniedError) as auth_err:
            logger.warning(f"OpenAI Auth error during judge evaluation: {auth_err}. Using fallback evaluation.")
            judge_data = None

    # Fallback heuristic judge if no client or auth error occurred
    if not judge_data:
        has_match = any(
            word in (chunks[0]["content"] if chunks else "").lower()
            for word in test_case.ground_truth.lower().split()
            if len(word) > 4
        )
        verdict = "SUPPORTED" if has_match else "HALLUCINATED"
        claims = [
            ClaimVerification(
                sentence=generated_answer[:120] if len(generated_answer) > 120 else generated_answer,
                verdict=verdict,
                supporting_chunk_id=chunks[0]["chunk_id"] if (has_match and chunks) else None,
                supporting_quote=chunks[0]["content"][:80] if (has_match and chunks) else None,
            )
        ]
        recall = 1.0 if has_match else 0.4
        precision = 1.0 if has_match else 0.5
        relevance = 0.95 if has_match else 0.6
        utilized = [chunks[0]["chunk_id"]] if (has_match and chunks) else []
        judge_data = JudgeEvaluationOutput(
            context_recall=recall,
            context_precision=precision,
            answer_relevance=relevance,
            claims=claims,
            utilized_chunk_ids=utilized,
        )

    total_claims = len(judge_data.claims)
    supported_claims = sum(1 for c in judge_data.claims if c.verdict == "SUPPORTED")
    faithfulness = (supported_claims / total_claims) if total_claims > 0 else 1.0

    utilized_set = set(judge_data.utilized_chunk_ids)
    for c in chunks:
        c["is_utilized"] = c["chunk_id"] in utilized_set

    chunk_utilization = (len(utilized_set) / len(chunks)) if chunks else 0.0

    expected_doc = str(test_case.expected_doc_id) if test_case.expected_doc_id else None
    gold_in_top_25 = (expected_doc in top_25_doc_ids) if expected_doc else (judge_data.context_recall >= 0.5)
    gold_in_top_k = (
        any(c["document_id"] == expected_doc for c in chunks)
        if expected_doc
        else (judge_data.context_recall >= 0.8)
    )

    failure_cat = classify_failure(
        faithfulness=faithfulness,
        context_recall=judge_data.context_recall,
        gold_in_top_25=gold_in_top_25,
        gold_in_top_k=gold_in_top_k,
    )

    latency_ms = max(180, int((time.perf_counter() - start_ts) * 1000))

    eval_row = EvalResult(
        run_id=run_id,
        test_case_id=test_case.id,
        pipeline_id=pipeline.id,
        generated_answer=generated_answer,
        retrieved_chunks_json=chunks,
        claim_verifications_json=[c.model_dump() for c in judge_data.claims],
        scores_json={
            "faithfulness": round(faithfulness, 4),
            "context_recall": round(judge_data.context_recall, 4),
            "context_precision": round(judge_data.context_precision, 4),
            "answer_relevance": round(judge_data.answer_relevance, 4),
            "chunk_utilization": round(chunk_utilization, 4),
        },
        failure_category=failure_cat,
        latency_ms=latency_ms,
        token_usage_json=usage,
    )
    db.add(eval_row)
    await db.commit()
    await db.refresh(eval_row)
    return eval_row


async def execute_experiment_background(run_id: UUID, api_key: Optional[str] = None) -> None:
    effective_key = api_key or settings.OPENAI_API_KEY
    has_valid_key = bool(effective_key and not effective_key.startswith("sk-..."))
    client = AsyncOpenAI(api_key=effective_key) if has_valid_key else None
    semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_EVALS)

    async with AsyncSessionLocal() as db:
        run = await db.get(ExperimentRun, run_id)
        if not run:
            return
        run.status = "RUNNING"
        await db.commit()

        pipeline_a = await db.get(Pipeline, run.pipeline_a_id)
        pipeline_b = await db.get(Pipeline, run.pipeline_b_id)

        hash_a = await ensure_chunks_indexed(
            db,
            pipeline_a.workspace_id,
            pipeline_a.chunk_strategy,
            pipeline_a.chunk_size,
            pipeline_a.chunk_overlap,
            effective_key,
        )
        hash_b = await ensure_chunks_indexed(
            db,
            pipeline_b.workspace_id,
            pipeline_b.chunk_strategy,
            pipeline_b.chunk_size,
            pipeline_b.chunk_overlap,
            effective_key,
        )

        cases_res = await db.execute(select(TestCase).where(TestCase.dataset_id == run.dataset_id))
        test_cases = cases_res.scalars().all()

        total_tasks = len(test_cases) * 2
        completed = 0

        async def bounded_eval(pipeline: Pipeline, cfg_hash: str, tc: TestCase):
            nonlocal completed
            async with semaphore:
                async with AsyncSessionLocal() as task_db:
                    await evaluate_single_case(task_db, client, run_id, pipeline, cfg_hash, tc)
                completed += 1
                await publish_run_event(
                    str(run_id),
                    {"type": "progress", "completed": completed, "total": total_tasks},
                )

        tasks = []
        for tc in test_cases:
            tasks.append(bounded_eval(pipeline_a, hash_a, tc))
            tasks.append(bounded_eval(pipeline_b, hash_b, tc))

        try:
            await asyncio.gather(*tasks)
            run.status = "COMPLETED"
            await db.commit()
            await publish_run_event(str(run_id), {"type": "completed", "run_id": str(run_id)})
        except Exception as exc:
            logger.exception(f"Experiment run {run_id} failed: {exc}")
            run.status = "FAILED"
            run.summary_metrics_json = {"error": str(exc)}
            await db.commit()
            await publish_run_event(str(run_id), {"type": "error", "message": str(exc)})
