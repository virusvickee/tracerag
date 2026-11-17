import logging
import re
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile
from openai import AsyncOpenAI
import openai
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limiter import check_demo_rate_limit
from app.core.retry import call_with_retry
from app.db.session import get_db
from app.models.domain import Document, DocumentChunk, ExperimentRun, GoldenDataset, Pipeline, TestCase, Workspace
from app.schemas.eval import (
    DatasetCreate,
    PipelineCreate,
    SyntheticTestCaseList,
    TestCaseCreate,
    WorkspaceCreate,
)
from app.services.ingestion import extract_text_from_bytes

logger = logging.getLogger(__name__)

router = APIRouter(tags=["workspaces"])


def _serialize_pipeline(p: Pipeline) -> dict:
    return {
        "id": str(p.id),
        "workspace_id": str(p.workspace_id),
        "name": p.name,
        "chunk_strategy": p.chunk_strategy,
        "chunk_size": p.chunk_size,
        "chunk_overlap": p.chunk_overlap,
        "retrieval_mode": p.retrieval_mode,
        "top_k": p.top_k,
        "use_reranker": p.use_reranker,
        "model_name": p.model_name,
        "system_prompt": p.system_prompt,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _serialize_document(d: Document) -> dict:
    return {
        "id": str(d.id),
        "workspace_id": str(d.workspace_id),
        "filename": d.filename,
        "token_count": d.token_count,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _serialize_test_case(tc: TestCase) -> dict:
    return {
        "id": str(tc.id),
        "dataset_id": str(tc.dataset_id),
        "question": tc.question,
        "ground_truth": tc.ground_truth,
        "difficulty_tag": tc.difficulty_tag,
        "expected_doc_id": str(tc.expected_doc_id) if tc.expected_doc_id else None,
    }


@router.get("/workspaces")
async def list_workspaces(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Workspace).order_by(Workspace.created_at.desc()))
    workspaces = res.scalars().all()
    out = []
    for ws in workspaces:
        ds_res = await db.execute(select(GoldenDataset).where(GoldenDataset.workspace_id == ws.id))
        datasets = ds_res.scalars().all()
        pipe_res = await db.execute(select(Pipeline).where(Pipeline.workspace_id == ws.id))
        pipelines = pipe_res.scalars().all()
        run_ids = []
        if datasets:
            run_res = await db.execute(
                select(ExperimentRun)
                .where(ExperimentRun.dataset_id.in_([d.id for d in datasets]))
                .order_by(ExperimentRun.created_at.desc())
            )
            run_ids = [str(r.id) for r in run_res.scalars().all()]

        out.append(
            {
                "id": str(ws.id),
                "name": ws.name,
                "is_demo_preset": ws.is_demo_preset,
                "datasets": [{"id": str(d.id), "name": d.name} for d in datasets],
                "pipelines": [_serialize_pipeline(p) for p in pipelines],
                "latest_run_id": run_ids[0] if run_ids else None,
            }
        )
    return out


@router.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: UUID, db: AsyncSession = Depends(get_db)):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    docs_res = await db.execute(select(Document).where(Document.workspace_id == ws.id))
    documents = docs_res.scalars().all()

    pipes_res = await db.execute(select(Pipeline).where(Pipeline.workspace_id == ws.id))
    pipelines = pipes_res.scalars().all()

    ds_res = await db.execute(select(GoldenDataset).where(GoldenDataset.workspace_id == ws.id))
    datasets = ds_res.scalars().all()

    run_ids = []
    if datasets:
        run_res = await db.execute(
            select(ExperimentRun)
            .where(ExperimentRun.dataset_id.in_([d.id for d in datasets]))
            .order_by(ExperimentRun.created_at.desc())
        )
        run_ids = [str(r.id) for r in run_res.scalars().all()]

    return {
        "id": str(ws.id),
        "name": ws.name,
        "is_demo_preset": ws.is_demo_preset,
        "documents": [_serialize_document(d) for d in documents],
        "datasets": [{"id": str(d.id), "name": d.name} for d in datasets],
        "pipelines": [_serialize_pipeline(p) for p in pipelines],
        "latest_run_id": run_ids[0] if run_ids else None,
    }


@router.post("/workspaces")
async def create_workspace(payload: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    ws = Workspace(name=payload.name, is_demo_preset=False)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return {"id": str(ws.id), "name": ws.name}


@router.delete("/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: UUID, db: AsyncSession = Depends(get_db)):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    await db.delete(ws)
    await db.commit()
    return {"status": "deleted", "id": str(workspace_id)}


@router.post("/workspaces/purge-mock-data")
async def purge_mock_data(db: AsyncSession = Depends(get_db)):
    """Removes all demo presets and mock workspaces from the database."""
    res = await db.execute(select(Workspace).where(Workspace.is_demo_preset == True))
    demo_workspaces = res.scalars().all()
    count = len(demo_workspaces)
    for ws in demo_workspaces:
        await db.delete(ws)
    await db.commit()
    return {
        "status": "purged",
        "deleted_workspaces_count": count,
        "message": f"Successfully purged {count} demo workspace(s) and all associated mock data.",
    }


@router.post("/workspaces/reset-all")
async def reset_all_data(db: AsyncSession = Depends(get_db)):
    """Wipes all workspaces, documents, test cases, and evaluation results for a clean slate."""
    res = await db.execute(select(Workspace))
    all_workspaces = res.scalars().all()
    count = len(all_workspaces)
    for ws in all_workspaces:
        await db.delete(ws)
    await db.commit()
    return {
        "status": "reset",
        "deleted_workspaces_count": count,
        "message": "All workspace data successfully wiped clean.",
    }


# ---------------------------------------------------------
# Documents
# ---------------------------------------------------------
@router.get("/workspaces/{workspace_id}/documents")
async def list_documents(workspace_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Document).where(Document.workspace_id == workspace_id).order_by(Document.created_at.desc())
    )
    docs = res.scalars().all()
    return [_serialize_document(d) for d in docs]


@router.post("/workspaces/{workspace_id}/documents")
async def upload_document(
    workspace_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    raw_bytes = await file.read()
    text_content = extract_text_from_bytes(file.filename or "document.txt", raw_bytes)
    approx_tokens = max(1, int(len(text_content.split()) * 1.3))

    doc = Document(
        workspace_id=workspace_id,
        filename=file.filename or "untitled.txt",
        raw_text=text_content,
        token_count=approx_tokens,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return _serialize_document(doc)


@router.delete("/workspaces/{workspace_id}/documents/{document_id}")
async def delete_document(
    workspace_id: UUID, document_id: UUID, db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, document_id)
    if not doc or doc.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
    return {"status": "deleted", "id": str(document_id)}


# ---------------------------------------------------------
# Pipelines
# ---------------------------------------------------------
@router.get("/workspaces/{workspace_id}/pipelines")
async def list_pipelines(workspace_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Pipeline).where(Pipeline.workspace_id == workspace_id).order_by(Pipeline.created_at.asc())
    )
    pipelines = res.scalars().all()
    return [_serialize_pipeline(p) for p in pipelines]


@router.post("/pipelines")
async def create_pipeline(payload: PipelineCreate, db: AsyncSession = Depends(get_db)):
    pipeline = Pipeline(**payload.model_dump())
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return _serialize_pipeline(pipeline)


@router.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: UUID, db: AsyncSession = Depends(get_db)):
    pipe = await db.get(Pipeline, pipeline_id)
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.delete(pipe)
    await db.commit()
    return {"status": "deleted", "id": str(pipeline_id)}


# ---------------------------------------------------------
# Datasets & Test Cases
# ---------------------------------------------------------
@router.get("/workspaces/{workspace_id}/datasets")
async def list_datasets(workspace_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(GoldenDataset).where(GoldenDataset.workspace_id == workspace_id).order_by(GoldenDataset.created_at.desc())
    )
    datasets = res.scalars().all()
    out = []
    for ds in datasets:
        tc_count_res = await db.execute(
            select(func.count(TestCase.id)).where(TestCase.dataset_id == ds.id)
        )
        count = tc_count_res.scalar() or 0
        out.append(
            {
                "id": str(ds.id),
                "workspace_id": str(ds.workspace_id),
                "name": ds.name,
                "description": ds.description,
                "test_cases_count": count,
                "created_at": ds.created_at.isoformat() if ds.created_at else None,
            }
        )
    return out


@router.post("/workspaces/{workspace_id}/datasets")
async def create_dataset(
    workspace_id: UUID, payload: DatasetCreate, db: AsyncSession = Depends(get_db)
):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ds = GoldenDataset(
        workspace_id=workspace_id,
        name=payload.name,
        description=payload.description,
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return {"id": str(ds.id), "name": ds.name, "description": ds.description}


@router.get("/datasets/{dataset_id}/cases")
async def list_test_cases(dataset_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(TestCase).where(TestCase.dataset_id == dataset_id))
    cases = res.scalars().all()
    return [_serialize_test_case(tc) for tc in cases]


@router.post("/datasets/{dataset_id}/cases")
async def add_test_case(
    dataset_id: UUID, payload: TestCaseCreate, db: AsyncSession = Depends(get_db)
):
    tc = TestCase(dataset_id=dataset_id, **payload.model_dump())
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return _serialize_test_case(tc)


@router.delete("/datasets/{dataset_id}/cases/{case_id}")
async def delete_test_case(
    dataset_id: UUID, case_id: UUID, db: AsyncSession = Depends(get_db)
):
    tc = await db.get(TestCase, case_id)
    if not tc or tc.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail="Test case not found")
    await db.delete(tc)
    await db.commit()
    return {"status": "deleted", "id": str(case_id)}


@router.post("/datasets/{dataset_id}/generate-synthetic")
async def generate_synthetic_cases(
    dataset_id: UUID,
    request: Request,
    count: int = Query(default=5, ge=1, le=20),
    x_provider_key: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    # Enforce rate limit on Demo Mode runs when no X-Provider-Key header is supplied
    check_demo_rate_limit(request, x_provider_key)

    ds = await db.get(GoldenDataset, dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    docs_res = await db.execute(select(Document).where(Document.workspace_id == ds.workspace_id))
    docs = docs_res.scalars().all()
    if not docs:
        raise HTTPException(status_code=400, detail="Upload documents before generating synthetic test cases")

    effective_key = x_provider_key or settings.OPENAI_API_KEY
    has_valid_key = bool(effective_key and not effective_key.startswith("sk-..."))
    created: List[TestCase] = []

    if has_valid_key:
        corpus_sample = "\n\n".join(f"[{d.filename}]\n{d.raw_text[:2500]}" for d in docs[:4])
        client = AsyncOpenAI(api_key=effective_key)

        try:
            resp = await call_with_retry(
                lambda: client.beta.chat.completions.parse(
                    model=settings.DEFAULT_JUDGE_MODEL,
                    temperature=0.2,
                    messages=[
                        {
                            "role": "system",
                            "content": f"Generate {count} diverse RAG evaluation test cases (SINGLE_HOP, MULTI_HOP, and UNANSWERABLE) strictly grounded in the provided documents.",
                        },
                        {"role": "user", "content": corpus_sample},
                    ],
                    response_format=SyntheticTestCaseList,
                ),
                operation_name="Synthetic Test Case Generation",
            )
            parsed: SyntheticTestCaseList = resp.choices[0].message.parsed
            for item in parsed.cases:
                tc = TestCase(
                    dataset_id=dataset_id,
                    question=item.question,
                    ground_truth=item.ground_truth,
                    difficulty_tag=item.difficulty_tag,
                    expected_doc_id=docs[0].id,
                )
                db.add(tc)
                created.append(tc)
        except Exception as exc:
            logger.warning(f"OpenAI call failed during synthetic generation: {exc}. Using heuristic generator.")
            has_valid_key = False

    if not has_valid_key:
        # Heuristic test case synthesizer for Demo Mode without OpenAI API key
        doc_primary = docs[0]
        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+", doc_primary.raw_text)
            if len(s.strip().split()) >= 6
        ]
        synth_templates = [
            ("SINGLE_HOP", "What are the requirements or limits stated in {filename} regarding {topic}?", 0),
            ("MULTI_HOP", "How does the policy outlined in {filename} apply to {topic} under special conditions?", 1),
            ("UNANSWERABLE", "Does {filename} outline regulations for offshore cryptocurrency wire transfers?", -1),
        ]

        for i in range(min(count, 5)):
            tag, q_template, sent_idx = synth_templates[i % len(synth_templates)]
            if sent_idx >= 0 and sent_idx < len(sentences):
                sentence = sentences[sent_idx]
                words = [w for w in sentence.split() if len(w) > 4][:3]
                topic = " ".join(words) if words else "the specified policy"
                question = q_template.format(filename=doc_primary.filename, topic=topic)
                ground_truth = sentence
            else:
                question = q_template.format(filename=doc_primary.filename)
                ground_truth = f"The documents in {doc_primary.filename} do not mention offshore cryptocurrency wire transfers."

            tc = TestCase(
                dataset_id=dataset_id,
                question=question,
                ground_truth=ground_truth,
                difficulty_tag=tag,
                expected_doc_id=doc_primary.id,
            )
            db.add(tc)
            created.append(tc)

    await db.commit()
    return {"generated_count": len(created), "test_cases": [_serialize_test_case(tc) for tc in created]}
