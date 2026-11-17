"use client";

import React from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";
import { EvalCaseComparison, PipelineTraceResult } from "@/lib/types";
import { useObservatoryStore } from "@/store/useObservatoryStore";

function PipelineColumn({
  side,
  trace,
}: {
  side: "pipeline_a" | "pipeline_b";
  trace?: PipelineTraceResult;
}) {
  const { hoveredClaim, setHoveredClaim } = useObservatoryStore();

  if (!trace) {
    return <div className="p-4 text-sm text-slate-500">No trace available.</div>;
  }

  const isPass = trace.failure_category === "PASS";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            {side === "pipeline_a" ? "Pipeline A" : "Pipeline B"}
          </span>
          <h4 className="text-sm font-semibold text-white">{trace.pipeline_name}</h4>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isPass
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
          }`}
        >
          {isPass ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {trace.failure_category}
        </span>
      </div>

      {/* Sentence-level Grounded Answer */}
      <div>
        <div className="mb-1.5 text-xs font-medium text-slate-400">
          Generated Answer (Hover sentence to inspect grounding)
        </div>
        <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm leading-relaxed">
          {trace.claims.length > 0 ? (
            trace.claims.map((claim, idx) => {
              const supported = claim.verdict === "SUPPORTED";
              return (
                <span
                  key={idx}
                  onMouseEnter={() =>
                    setHoveredClaim({
                      pipelineSide: side,
                      supportingChunkId: claim.supporting_chunk_id,
                      supportingQuote: claim.supporting_quote,
                    })
                  }
                  onMouseLeave={() => setHoveredClaim(null)}
                  className={`mr-1.5 inline cursor-pointer rounded px-1 py-0.5 transition ${
                    supported
                      ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/30"
                      : "bg-rose-500/20 text-rose-200 underline decoration-rose-500"
                  }`}
                >
                  {claim.sentence}
                </span>
              );
            })
          ) : (
            <p className="text-slate-200">{trace.generated_answer}</p>
          )}
        </div>
      </div>

      {/* Retrieved Chunks */}
      <div>
        <div className="mb-1.5 text-xs font-medium text-slate-400">
          Retrieved Context Chunks (Top-{trace.retrieved_chunks.length})
        </div>
        <div className="space-y-2">
          {trace.retrieved_chunks.map((chunk) => {
            const isHighlighted =
              hoveredClaim?.pipelineSide === side &&
              hoveredClaim?.supportingChunkId === chunk.chunk_id;

            return (
              <div
                key={chunk.chunk_id}
                className={`rounded-lg border p-3 text-xs transition ${
                  isHighlighted
                    ? "border-emerald-500 bg-emerald-950/30 shadow-md"
                    : "border-slate-800 bg-slate-900/80"
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200">
                    #{chunk.rank} • {chunk.document_filename}
                  </span>
                  <span>
                    RRF: {chunk.rrf_score?.toFixed(4) ?? "—"} | Rerank:{" "}
                    {chunk.rerank_score?.toFixed(2) ?? "—"}
                  </span>
                </div>
                <p className="leading-relaxed text-slate-300">{chunk.content}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TraceDiffDrawer({
  testCase,
  onClose,
}: {
  testCase: EvalCaseComparison | null;
  onClose: () => void;
}) {
  if (!testCase) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-6xl flex-col border-l border-slate-800 bg-[#090d16] shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div>
            <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
              {testCase.difficulty_tag}
            </span>
            <h2 className="mt-1.5 text-lg font-semibold text-white">{testCase.question}</h2>
            <p className="mt-1 text-xs text-slate-400">
              <strong className="text-slate-300">Ground Truth:</strong> {testCase.ground_truth}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-800 p-2 text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
          <PipelineColumn side="pipeline_a" trace={testCase.traces.pipeline_a} />
          <PipelineColumn side="pipeline_b" trace={testCase.traces.pipeline_b} />
        </div>
      </div>
    </div>
  );
}
