"use client";

import React, { useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Sparkles,
  Quote,
} from "lucide-react";
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
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/50 p-8 text-xs text-slate-500">
        No trace available for this pipeline.
      </div>
    );
  }

  const isPass = trace.failure_category === "PASS";
  const faithPct = Math.round((trace.scores.faithfulness ?? 0) * 100);
  const recallPct = Math.round((trace.scores.context_recall ?? 0) * 100);
  const utilPct = Math.round((trace.scores.chunk_utilization ?? 0) * 100);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-[#0b101d]/90 p-5 ring-1 ring-white/[0.03]">
      {/* Column Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                side === "pipeline_a"
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {side === "pipeline_a" ? "Pipeline A" : "Pipeline B"}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
              <Clock className="h-3 w-3 text-slate-500" />
              {trace.latency_ms}ms
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              ₹{trace.estimated_cost_inr.toFixed(2)}/1k
            </span>
          </div>
          <h4 className="mt-1 truncate text-sm font-semibold text-white">
            {trace.pipeline_name}
          </h4>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isPass
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30"
          }`}
        >
          {isPass ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {trace.failure_category}
        </span>
      </div>

      {/* Compact Metric Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Faithfulness
          </div>
          <div
            className={`mt-0.5 font-mono text-sm font-bold ${
              faithPct >= 85
                ? "text-emerald-400"
                : faithPct >= 60
                ? "text-amber-400"
                : "text-rose-400"
            }`}
          >
            {faithPct}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Context Recall
          </div>
          <div
            className={`mt-0.5 font-mono text-sm font-bold ${
              recallPct >= 80
                ? "text-emerald-400"
                : recallPct >= 50
                ? "text-amber-400"
                : "text-rose-400"
            }`}
          >
            {recallPct}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Utilization
          </div>
          <div className="mt-0.5 font-mono text-sm font-bold text-indigo-300">
            {utilPct}%
          </div>
        </div>
      </div>

      {/* Sentence-level Grounded Answer */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Generated Answer
          </span>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Supported
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Hallucinated
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-sm leading-relaxed">
          {trace.claims.length > 0 ? (
            <div className="space-y-1">
              {trace.claims.map((claim, idx) => {
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
                    className={`mr-1.5 inline cursor-pointer rounded-md px-1.5 py-0.5 transition ${
                      supported
                        ? "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/30 ring-1 ring-transparent hover:ring-emerald-400/40"
                        : "bg-rose-500/20 text-rose-100 underline decoration-rose-400 decoration-wavy underline-offset-4 hover:bg-rose-500/30"
                    }`}
                  >
                    {claim.sentence}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-200">{trace.generated_answer}</p>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">
          Hover any highlighted claim to locate its supporting source chunk below.
        </p>
      </div>

      {/* Retrieved Chunks */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            Retrieved Context Chunks (Top-{trace.retrieved_chunks.length})
          </span>
        </div>

        <div className="space-y-2.5">
          {trace.retrieved_chunks.map((chunk) => {
            const isHighlighted =
              hoveredClaim?.pipelineSide === side &&
              hoveredClaim?.supportingChunkId === chunk.chunk_id;

            return (
              <div
                key={chunk.chunk_id}
                className={`rounded-xl border p-3.5 text-xs transition-all duration-150 ${
                  isHighlighted
                    ? "border-emerald-400/80 bg-emerald-950/40 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-400/30"
                    : "border-slate-800/80 bg-slate-900/60 hover:border-slate-700"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-300">
                      #{chunk.rank}
                    </span>
                    <span className="truncate font-medium text-slate-200">
                      {chunk.document_filename}
                    </span>
                    {chunk.is_utilized ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        Utilized
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        Unused
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-[10px] text-slate-400">
                    RRF: <strong className="text-slate-200">{chunk.rrf_score?.toFixed(4) ?? "—"}</strong>
                    {" · "}
                    Rerank:{" "}
                    <strong className="text-slate-200">
                      {chunk.rerank_score?.toFixed(2) ?? "—"}
                    </strong>
                  </span>
                </div>

                <p className="leading-relaxed text-slate-300">{chunk.content}</p>

                {isHighlighted && hoveredClaim?.supportingQuote && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-200">
                    <Quote className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                    <span className="italic">&ldquo;{hoveredClaim.supportingQuote}&rdquo;</span>
                  </div>
                )}
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
  useEffect(() => {
    if (!testCase) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [testCase, onClose]);

  if (!testCase) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-slide-in-right flex h-full w-full max-w-6xl flex-col border-l border-slate-800 bg-[#060912] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 bg-[#0b101d]/90 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                {testCase.difficulty_tag}
              </span>
              <span className="text-[11px] text-slate-500">Split-Screen Trace Diff Inspector</span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-white leading-snug">
              {testCase.question}
            </h2>
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-slate-400 mr-1.5">Ground Truth:</span>
              {testCase.ground_truth}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-2">
          <PipelineColumn side="pipeline_a" trace={testCase.traces.pipeline_a} />
          <PipelineColumn side="pipeline_b" trace={testCase.traces.pipeline_b} />
        </div>
      </div>
    </div>
  );
}
