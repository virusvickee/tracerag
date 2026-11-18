"use client";

import React, { useEffect, useState } from "react";
import {
  Layers,
  Plus,
  Play,
  CheckCircle2,
  Trash2,
  Cpu,
  Sparkles,
  ArrowRight,
  Sliders,
  FileCode,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createPipeline,
  deletePipeline,
  fetchDatasets,
  fetchPipelines,
  fetchWorkspaces,
  triggerExperimentRun,
} from "@/lib/api-client";
import { GoldenDataset, Pipeline } from "@/lib/types";

export default function PipelinesManagementPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [datasets, setDatasets] = useState<GoldenDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick Run state
  const [selectedPipelineA, setSelectedPipelineA] = useState<string>("");
  const [selectedPipelineB, setSelectedPipelineB] = useState<string>("");
  const [launchingEval, setLaunchingEval] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [chunkStrategy, setChunkStrategy] = useState<"FIXED" | "RECURSIVE">("RECURSIVE");
  const [chunkSize, setChunkSize] = useState<number>(512);
  const [chunkOverlap, setChunkOverlap] = useState<number>(64);
  const [retrievalMode, setRetrievalMode] = useState<"DENSE" | "SPARSE" | "HYBRID">("HYBRID");
  const [topK, setTopK] = useState<number>(5);
  const [useReranker, setUseReranker] = useState<boolean>(true);
  const [modelName, setModelName] = useState<string>("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState<string>(
    "Answer the user question strictly using the provided context. If the context does not contain the answer, state that clearly."
  );

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [pipes, dsets] = await Promise.all([
        fetchPipelines(params.workspaceId),
        fetchDatasets(params.workspaceId),
      ]);
      setPipelines(pipes);
      setDatasets(dsets);

      if (pipes.length >= 2) {
        setSelectedPipelineA(pipes[0].id);
        setSelectedPipelineB(pipes[1].id);
      } else if (pipes.length === 1) {
        setSelectedPipelineA(pipes[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.workspaceId]);

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please provide a name for the pipeline profile.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await createPipeline({
        workspace_id: params.workspaceId,
        name: name.trim(),
        chunk_strategy: chunkStrategy,
        chunk_size: Number(chunkSize),
        chunk_overlap: Number(chunkOverlap),
        retrieval_mode: retrievalMode,
        top_k: Number(topK),
        use_reranker: useReranker,
        model_name: modelName.trim() || "gpt-4o-mini",
        system_prompt: systemPrompt.trim(),
      });

      setSuccessMsg(`Pipeline "${name}" created successfully!`);
      setName("");
      setShowCreateForm(false);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create pipeline");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePipeline = async (id: string, pipeName: string) => {
    if (!confirm(`Are you sure you want to delete pipeline "${pipeName}"?`)) return;
    try {
      await deletePipeline(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete pipeline");
    }
  };

  const handleStartABRun = async () => {
    if (!selectedPipelineA || !selectedPipelineB) {
      setErrorMsg("Please select two distinct pipelines for comparison.");
      return;
    }
    if (selectedPipelineA === selectedPipelineB) {
      setErrorMsg("Pipeline A and Pipeline B must be different profiles.");
      return;
    }
    if (!datasets.length) {
      setErrorMsg("No dataset available in this workspace. Upload documents or generate test cases first.");
      return;
    }

    setLaunchingEval(true);
    setErrorMsg(null);
    try {
      const res = await triggerExperimentRun(
        datasets[0].id,
        selectedPipelineA,
        selectedPipelineB
      );
      // Redirect to Observatory dashboard to view live streaming results
      router.push(`/observatory/${params.workspaceId}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to trigger evaluation run");
      setLaunchingEval(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="text-xs font-medium">Loading pipeline configurations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">RAG Pipeline Profiles</h1>
          <p className="mt-1 text-xs text-slate-400">
            Configure chunking strategies, vector & keyword retrieval, and Cross-Encoder reranking for A/B testing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-violet-500 transition"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Close Form" : "New Pipeline"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          {successMsg}
        </div>
      )}

      {/* A/B Quick Run Bar */}
      {pipelines.length >= 2 && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/35 to-violet-950/25 p-4 shadow-lg ring-1 ring-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5" /> Quick A/B Run:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">A:</span>
                <select
                  value={selectedPipelineA}
                  onChange={(e) => setSelectedPipelineA(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-500 font-bold">vs</span>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">B:</span>
                <select
                  value={selectedPipelineB}
                  onChange={(e) => setSelectedPipelineB(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleStartABRun}
              disabled={launchingEval || selectedPipelineA === selectedPipelineB}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow"
            >
              <Play className="h-3.5 w-3.5" />
              {launchingEval ? "Launching..." : "Run A/B Benchmarking"}
            </button>
          </div>
        </div>
      )}

      {/* Create Pipeline Form Card */}
      {showCreateForm && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0b101d]/95 p-6 shadow-2xl ring-1 ring-white/[0.04]">
          <div className="mb-4 border-b border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-white">Create Custom RAG Pipeline</h2>
            <p className="text-xs text-slate-400">
              Customize chunk boundary rules, retrieval fusion mode, and Cross-Encoder reranking.
            </p>
          </div>

          <form onSubmit={handleCreatePipeline} className="space-y-5">
            {/* Pipeline Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300">Pipeline Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Recursive 256 + Hybrid RRF + Cross-Encoder"
                required
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Chunk Strategy & Parameters */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Chunking Strategy
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChunkStrategy("RECURSIVE")}
                    className={`rounded-lg border p-2 text-center text-xs transition ${
                      chunkStrategy === "RECURSIVE"
                        ? "border-indigo-500 bg-indigo-950/40 text-indigo-200 font-semibold"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    Recursive
                  </button>
                  <button
                    type="button"
                    onClick={() => setChunkStrategy("FIXED")}
                    className={`rounded-lg border p-2 text-center text-xs transition ${
                      chunkStrategy === "FIXED"
                        ? "border-indigo-500 bg-indigo-950/40 text-indigo-200 font-semibold"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    Fixed
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {chunkStrategy === "RECURSIVE"
                    ? "Paragraph-aware splitting respecting sentence boundaries"
                    : "Fixed word-count sliding window"}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Chunk Size</label>
                  <span className="font-mono text-xs text-indigo-300">{chunkSize} tokens</span>
                </div>
                <input
                  type="range"
                  min="128"
                  max="1024"
                  step="32"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="mt-2 w-full accent-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Target chunk size (128 - 1024 tokens)
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Chunk Overlap</label>
                  <span className="font-mono text-xs text-indigo-300">{chunkOverlap} tokens</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="256"
                  step="16"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="mt-2 w-full accent-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Sliding window context buffer between chunks
                </p>
              </div>
            </div>

            {/* Retrieval Mode Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Retrieval Architecture
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div
                  onClick={() => setRetrievalMode("HYBRID")}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    retrievalMode === "HYBRID"
                      ? "border-indigo-500 bg-indigo-950/40 text-white"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-indigo-300">HYBRID RRF</span>
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Reciprocal Rank Fusion (k=60) combining pgvector HNSW cosine + PostgreSQL BM25 FTS.
                  </p>
                </div>

                <div
                  onClick={() => setRetrievalMode("DENSE")}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    retrievalMode === "DENSE"
                      ? "border-indigo-500 bg-indigo-950/40 text-white"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-purple-300">DENSE ONLY</span>
                    <Cpu className="h-4 w-4 text-purple-400" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    pgvector HNSW Cosine Distance (&lt;=&gt;) over 1536-dimensional OpenAI embeddings.
                  </p>
                </div>

                <div
                  onClick={() => setRetrievalMode("SPARSE")}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    retrievalMode === "SPARSE"
                      ? "border-indigo-500 bg-indigo-950/40 text-white"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-emerald-300">SPARSE ONLY</span>
                    <FileCode className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    PostgreSQL Full-Text Search using tsvector, ts_rank_cd, and GIN inverted index.
                  </p>
                </div>
              </div>
            </div>

            {/* Top-K and Reranker */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Top-K Retrieved Chunks</label>
                  <span className="font-mono text-xs text-indigo-300">{topK} chunks</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="mt-2 w-full accent-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Number of chunks injected into generation context window
                </p>
              </div>

              <div className="flex flex-col justify-center rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-200">
                      Cross-Encoder Reranking
                    </span>
                    <p className="text-[11px] text-slate-400">
                      ms-marco-MiniLM-L-6-v2 (eliminates ranking drops)
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={useReranker}
                      onChange={(e) => setUseReranker(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-800 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-focus:outline-none" />
                  </label>
                </div>
              </div>
            </div>

            {/* System Prompt & Model */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300">LLM Model</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">Default: gpt-4o-mini</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300">System Prompt</label>
                <textarea
                  rows={2}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Create Pipeline Profile"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Empty State when no pipelines exist */}
      {pipelines.length === 0 && !showCreateForm && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-white">No Pipelines Created Yet</h3>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            Create at least two RAG pipelines (such as Recursive Chunking + Hybrid Retrieval vs. Fixed Chunking + Dense Retrieval) to run comparative A/B evaluations.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Create First Pipeline
          </button>
        </div>
      )}

      {/* Existing Pipelines Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pipelines.map((pipe) => {
          const isHybrid = pipe.retrieval_mode === "HYBRID";
          const isDense = pipe.retrieval_mode === "DENSE";

          return (
            <div
              key={pipe.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-[#0b101d]/80 p-5 shadow-md ring-1 ring-white/[0.03] transition hover:border-indigo-500/40"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{pipe.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isHybrid
                            ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                            : isDense
                            ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                            : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {pipe.retrieval_mode}
                      </span>
                      {pipe.use_reranker && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                          Cross-Encoder Active
                        </span>
                      )}
                    </div>
                  </div>

                  {pipelines.length > 2 && (
                    <button
                      onClick={() => handleDeletePipeline(pipe.id, pipe.name)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                      title="Delete pipeline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Configuration Specs */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-950/60 p-2.5">
                    <span className="text-[11px] text-slate-400">Chunk Strategy</span>
                    <div className="mt-0.5 font-semibold text-slate-200">
                      {pipe.chunk_strategy} ({pipe.chunk_size} / {pipe.chunk_overlap} tokens)
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950/60 p-2.5">
                    <span className="text-[11px] text-slate-400">Top-K Injected</span>
                    <div className="mt-0.5 font-semibold text-slate-200">
                      Top-{pipe.top_k} Chunks
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">System Prompt: </span>
                  <span className="italic line-clamp-2">{pipe.system_prompt}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-500">
                <span>Model: {pipe.model_name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedPipelineA(pipe.id);
                      setSuccessMsg(`Set "${pipe.name}" as Pipeline A.`);
                    }}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                      selectedPipelineA === pipe.id
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Select as A
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPipelineB(pipe.id);
                      setSuccessMsg(`Set "${pipe.name}" as Pipeline B.`);
                    }}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                      selectedPipelineB === pipe.id
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Select as B
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
