from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field

FailureCategory = Literal[
    "PASS",
    "RETRIEVAL_MISS",
    "RANKING_DROP",
    "CONTEXT_DISTRACTION",
    "HALLUCINATION",
]


class WorkspaceCreate(BaseModel):
    name: str


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PipelineCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    workspace_id: UUID
    name: str
    chunk_strategy: Literal["FIXED", "RECURSIVE"] = "RECURSIVE"
    chunk_size: int = Field(512, ge=128, le=2048)
    chunk_overlap: int = Field(64, ge=0, le=512)
    retrieval_mode: Literal["DENSE", "SPARSE", "HYBRID"] = "HYBRID"
    top_k: int = Field(5, ge=1, le=20)
    use_reranker: bool = False
    model_name: str = "gpt-4o-mini"
    system_prompt: str = (
        "Answer the user question strictly using the provided context. "
        "If the context does not contain the answer, state that clearly."
    )


class TestCaseCreate(BaseModel):
    question: str
    ground_truth: str
    difficulty_tag: Literal["SINGLE_HOP", "MULTI_HOP", "UNANSWERABLE"] = "SINGLE_HOP"
    expected_doc_id: Optional[UUID] = None


class ClaimVerification(BaseModel):
    sentence: str = Field(..., description="Atomic factual claim extracted from the generated answer.")
    verdict: Literal["SUPPORTED", "HALLUCINATED", "IRRELEVANT"]
    supporting_chunk_id: Optional[str] = Field(None, description="ID of the retrieved chunk supporting this claim.")
    supporting_quote: Optional[str] = Field(None, description="Exact substring quote from the supporting chunk.")


class JudgeEvaluationOutput(BaseModel):
    context_recall: float = Field(..., ge=0.0, le=1.0)
    context_precision: float = Field(..., ge=0.0, le=1.0)
    answer_relevance: float = Field(..., ge=0.0, le=1.0)
    claims: List[ClaimVerification]
    utilized_chunk_ids: List[str] = Field(default_factory=list)


class SyntheticTestCaseList(BaseModel):
    cases: List[TestCaseCreate]


class ExperimentCreate(BaseModel):
    dataset_id: UUID
    pipeline_a_id: UUID
    pipeline_b_id: UUID
