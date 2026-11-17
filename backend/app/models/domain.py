import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, Computed
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.db.session import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    is_demo_preset = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    pipelines = relationship("Pipeline", back_populates="workspace", cascade="all, delete-orphan")
    datasets = relationship("GoldenDataset", back_populates="workspace", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    raw_text = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False)
    metadata_json = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    pipeline_config_hash = Column(String(64), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    fts_tokens = Column(
        TSVECTOR,
        Computed("to_tsvector('english', content)", persisted=True),
    )
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("idx_chunks_embedding_hnsw", "embedding", postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"}),
        Index("idx_chunks_fts_gin", "fts_tokens", postgresql_using="gin"),
    )


class GoldenDataset(Base):
    __tablename__ = "golden_datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="datasets")
    test_cases = relationship("TestCase", back_populates="dataset", cascade="all, delete-orphan")
    runs = relationship("ExperimentRun", back_populates="dataset", cascade="all, delete-orphan")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("golden_datasets.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    ground_truth = Column(Text, nullable=False)
    difficulty_tag = Column(String(32), default="SINGLE_HOP")
    expected_doc_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    dataset = relationship("GoldenDataset", back_populates="test_cases")


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(120), nullable=False)
    chunk_strategy = Column(String(32), default="RECURSIVE")
    chunk_size = Column(Integer, default=512)
    chunk_overlap = Column(Integer, default=64)
    retrieval_mode = Column(String(32), default="HYBRID")
    top_k = Column(Integer, default=5)
    use_reranker = Column(Boolean, default=False)
    model_name = Column(String(64), default="gpt-4o-mini")
    system_prompt = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="pipelines")


class ExperimentRun(Base):
    __tablename__ = "experiment_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("golden_datasets.id", ondelete="CASCADE"), nullable=False)
    pipeline_a_id = Column(UUID(as_uuid=True), ForeignKey("pipelines.id"), nullable=False)
    pipeline_b_id = Column(UUID(as_uuid=True), ForeignKey("pipelines.id"), nullable=False)
    status = Column(String(24), default="PENDING")
    summary_metrics_json = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    dataset = relationship("GoldenDataset", back_populates="runs")
    pipeline_a = relationship("Pipeline", foreign_keys=[pipeline_a_id])
    pipeline_b = relationship("Pipeline", foreign_keys=[pipeline_b_id])
    results = relationship("EvalResult", back_populates="run", cascade="all, delete-orphan")


class EvalResult(Base):
    __tablename__ = "eval_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("experiment_runs.id", ondelete="CASCADE"), nullable=False)
    test_case_id = Column(UUID(as_uuid=True), ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    generated_answer = Column(Text, nullable=False)
    retrieved_chunks_json = Column(JSONB, nullable=False)
    claim_verifications_json = Column(JSONB, nullable=False)
    scores_json = Column(JSONB, nullable=False)
    failure_category = Column(String(32), nullable=False)
    latency_ms = Column(Integer, nullable=False)
    token_usage_json = Column(JSONB, nullable=False)

    run = relationship("ExperimentRun", back_populates="results")
