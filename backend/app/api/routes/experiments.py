import asyncio
import json
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limiter import check_demo_rate_limit
from app.db.session import get_db
from app.models.domain import EvalResult, ExperimentRun, Pipeline, TestCase
from app.schemas.eval import ExperimentCreate
from app.services.evaluator import execute_experiment_background, run_event_queues

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("")
async def create_experiment(
    payload: ExperimentCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    x_provider_key: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    # Enforce rate limit on Demo Mode runs when no X-Provider-Key header is supplied
    check_demo_rate_limit(request, x_provider_key)

    run = ExperimentRun(
        dataset_id=payload.dataset_id,
        pipeline_a_id=payload.pipeline_a_id,
        pipeline_b_id=payload.pipeline_b_id,
        status="PENDING",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    background_tasks.add_task(execute_experiment_background, run.id, x_provider_key)
    return {"run_id": str(run.id), "status": run.status}


@router.get("/{run_id}/stream")
async def stream_experiment_progress(run_id: UUID):
    key = str(run_id)
    queue: asyncio.Queue = asyncio.Queue()
    run_event_queues.setdefault(key, []).append(queue)

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("completed", "error"):
                    break
        finally:
            if key in run_event_queues and queue in run_event_queues[key]:
                run_event_queues[key].remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{run_id}/results")
async def get_experiment_results(run_id: UUID, db: AsyncSession = Depends(get_db)):
    run = await db.get(ExperimentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Experiment run not found")

    pipe_a = await db.get(Pipeline, run.pipeline_a_id)
    pipe_b = await db.get(Pipeline, run.pipeline_b_id)

    res = await db.execute(select(EvalResult).where(EvalResult.run_id == run_id))
    eval_rows = res.scalars().all()

    tc_res = await db.execute(select(TestCase).where(TestCase.dataset_id == run.dataset_id))
    test_cases = {str(tc.id): tc for tc in tc_res.scalars().all()}

    grouped = {}
    for row in eval_rows:
        tc_id = str(row.test_case_id)
        tc = test_cases.get(tc_id)
        grouped.setdefault(
            tc_id,
            {
                "test_case_id": tc_id,
                "question": tc.question if tc else "",
                "ground_truth": tc.ground_truth if tc else "",
                "difficulty_tag": tc.difficulty_tag if tc else "SINGLE_HOP",
                "traces": {},
            },
        )
        side = "pipeline_a" if row.pipeline_id == run.pipeline_a_id else "pipeline_b"
        pipe_obj = pipe_a if side == "pipeline_a" else pipe_b
        prompt_tok = row.token_usage_json.get("prompt_tokens", 0)
        comp_tok = row.token_usage_json.get("completion_tokens", 0)
        # Approximate gpt-4o-mini cost per 1k queries in INR (₹84/$1)
        est_cost_inr = round(((prompt_tok * 0.15 + comp_tok * 0.60) / 1_000_000) * 1000 * 84, 2)

        grouped[tc_id]["traces"][side] = {
            "pipeline_id": str(row.pipeline_id),
            "pipeline_name": pipe_obj.name if pipe_obj else side,
            "generated_answer": row.generated_answer,
            "failure_category": row.failure_category,
            "scores": row.scores_json,
            "latency_ms": row.latency_ms,
            "estimated_cost_inr": est_cost_inr,
            "token_usage": row.token_usage_json,
            "retrieved_chunks": row.retrieved_chunks_json,
            "claims": row.claim_verifications_json,
        }

    return {
        "run_id": str(run.id),
        "status": run.status,
        "pipeline_a_name": pipe_a.name if pipe_a else "Pipeline A",
        "pipeline_b_name": pipe_b.name if pipe_b else "Pipeline B",
        "cases": list(grouped.values()),
    }
