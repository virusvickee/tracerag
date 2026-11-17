"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Play, Activity, CheckCircle2, AlertTriangle, Layers, Database } from "lucide-react";
import Link from "next/link";
import { fetchExperimentResults, fetchWorkspaces, triggerExperimentRun } from "@/lib/api-client";
import { ExperimentResultsResponse, FailureCategory } from "@/lib/types";
import { useObservatoryStore } from "@/store/useObservatoryStore";
import { ParetoTradeoffChart } from "@/components/charts/ParetoTradeoffChart";
import { FailureTaxonomyBarChart, FailureDistributionItem } from "@/components/charts/FailureTaxonomyBarChart";
import { TraceDiffDrawer } from "@/components/inspector/TraceDiffDrawer";

export default function ObservatoryDashboardPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const [workspace, setWorkspace] = useState<any>(null);
  const [results, setResults] = useState<ExperimentResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningStatus, setRunningStatus] = useState<string | null>(null);

  const { selectedTestCaseId, setSelectedTestCaseId } = useObservatoryStore();

  const loadData = async () => {
    setLoading(true);
    try {
      const workspaces = await fetchWorkspaces();
      const activeWs =
        workspaces.find((w: any) => w.id === params.workspaceId) || workspaces[0];
      setWorkspace(activeWs);

      if (activeWs?.latest_run_id) {
        const expData = await fetchExperimentResults(activeWs.latest_run_id);
        setResults(expData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.workspaceId]);

  const handleRunLiveEval = async () => {
    if (!workspace?.datasets?.[0] || workspace?.pipelines?.length < 2) return;
    setRunningStatus("Starting batch evaluation...");
    try {
      const { run_id } = await triggerExperimentRun(
        workspace.datasets[0].id,
        workspace.pipelines[0].id,
        workspace.pipelines[1].id
      );
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const evtSource = new EventSource(`${apiBase}/experiments/${run_id}/stream`);
      evtSource.onmessage = async (event) => {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "progress") {
          setRunningStatus(`Evaluating: ${parsed.completed} / ${parsed.total} traces graded`);
        } else if (parsed.type === "completed") {
          evtSource.close();
          setRunningStatus(null);
          const updated = await fetchExperimentResults(run_id);
          setResults(updated);
        } else if (parsed.type === "error") {
          evtSource.close();
          setRunningStatus(`Error: ${parsed.message}`);
        }
      };
    } catch (e: any) {
      setRunningStatus(`Failed: ${e.message}`);
    }
  };

  const summary = useMemo(() => {
    if (!results || results.cases.length === 0) return null;
    const calcAvg = (side: "pipeline_a" | "pipeline_b") => {
      const items = results.cases
        .map((c) => c.traces[side])
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
      if (!items.length) return { faith: 0, recall: 0, latency: 0, cost: 0 };
      const sum = items.reduce(
        (acc, t) => ({
          faith: acc.faith + t.scores.faithfulness,
          recall: acc.recall + t.scores.context_recall,
          latency: acc.latency + t.latency_ms,
          cost: acc.cost + t.estimated_cost_inr,
        }),
        { faith: 0, recall: 0, latency: 0, cost: 0 }
      );
      return {
        faith: Math.round((sum.faith / items.length) * 1000) / 10,
        recall: Math.round((sum.recall / items.length) * 1000) / 10,
        latency: Math.round(sum.latency / items.length),
        cost: Math.round((sum.cost / items.length) * 100) / 100,
      };
    };
    return { a: calcAvg("pipeline_a"), b: calcAvg("pipeline_b") };
  }, [results]);

  const taxonomyData: FailureDistributionItem[] | null = useMemo(() => {
    if (!results || results.cases.length === 0) return null;

    const countCategories = (
      side: "pipeline_a" | "pipeline_b",
      pipelineName: string
    ): FailureDistributionItem => {
      const counts: Record<FailureCategory, number> = {
        PASS: 0,
        RETRIEVAL_MISS: 0,
        RANKING_DROP: 0,
        CONTEXT_DISTRACTION: 0,
        HALLUCINATION: 0,
      };
      let total = 0;
      for (const c of results.cases) {
        const trace = c.traces[side];
        if (trace && trace.failure_category) {
          const cat = trace.failure_category;
          if (counts[cat] !== undefined) {
            counts[cat]++;
            total++;
          }
        }
      }
      return {
        pipelineName,
        PASS: counts.PASS,
        RETRIEVAL_MISS: counts.RETRIEVAL_MISS,
        RANKING_DROP: counts.RANKING_DROP,
        CONTEXT_DISTRACTION: counts.CONTEXT_DISTRACTION,
        HALLUCINATION: counts.HALLUCINATION,
        total,
      };
    };

    return [
      countCategories("pipeline_a", results.pipeline_a_name || "Pipeline A"),
      countCategories("pipeline_b", results.pipeline_b_name || "Pipeline B"),
    ];
  }, [results]);

  const activeCase = useMemo(
    () => results?.cases.find((c) => c.test_case_id === selectedTestCaseId) || null,
    [results, selectedTestCaseId]
  );

  if (loading) {
    return <div className="py-20 text-center text-sm text-slate-400">Loading RAG Observatory...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            {workspace?.name || "RAG Evaluation Workspace"}
          </h1>
          <p className="text-xs text-slate-400">
            Comparing <span className="font-semibold text-slate-200">{results?.pipeline_a_name || "Pipeline A"}</span> vs.{" "}
            <span className="font-semibold text-slate-200">{results?.pipeline_b_name || "Pipeline B"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/observatory/${params.workspaceId}/pipelines`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-indigo-500"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            Pipelines
          </Link>
          <Link
            href={`/observatory/${params.workspaceId}/datasets`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-indigo-500"
          >
            <Database className="h-3.5 w-3.5 text-indigo-400" />
            Datasets & Corpus
          </Link>
          <button
            onClick={handleRunLiveEval}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500"
          >
            <Play className="h-3.5 w-3.5" />
            Run Live A/B Evaluation
          </button>
        </div>
      </div>

      {runningStatus && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-4 py-2.5 text-xs text-indigo-200">
          <Activity className="h-4 w-4 animate-spin text-indigo-400" />
          {runningStatus}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Faithfulness (Pipe B vs A)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{summary.b.faith}%</span>
              <span className="text-xs font-medium text-emerald-400">
                ({summary.b.faith - summary.a.faith >= 0 ? "+" : ""}
                {(summary.b.faith - summary.a.faith).toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Context Recall (Pipe B vs A)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{summary.b.recall}%</span>
              <span className="text-xs font-medium text-emerald-400">
                ({summary.b.recall - summary.a.recall >= 0 ? "+" : ""}
                {(summary.b.recall - summary.a.recall).toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Avg End-to-End Latency</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{summary.b.latency} ms</span>
              <span className="text-xs text-slate-400">vs {summary.a.latency} ms</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">Est. Cost / 1k Queries</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">₹{summary.b.cost}</span>
              <span className="text-xs text-slate-400">vs ₹{summary.a.cost}</span>
            </div>
          </div>
        </div>
      )}

      {/* Dual Analytics: Pareto Trade-off & Failure Taxonomy Stacked Bar Chart */}
      {summary && results && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ParetoTradeoffChart
            data={[
              {
                name: results.pipeline_a_name,
                costInr: summary.a.cost || 38,
                faithfulnessPct: summary.a.faith,
                latencyMs: summary.a.latency,
              },
              {
                name: results.pipeline_b_name,
                costInr: summary.b.cost || 52,
                faithfulnessPct: summary.b.faith,
                latencyMs: summary.b.latency,
              },
            ]}
          />
          {taxonomyData && <FailureTaxonomyBarChart data={taxonomyData} />}
        </div>
      )}

      {/* Test Cases Comparison Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            Golden Dataset Traces (Click any row to open Split-Screen Grounding Diff)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
              <tr>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Test Question</th>
                <th className="px-4 py-3">Pipeline A Verdict</th>
                <th className="px-4 py-3">Pipeline B Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {results?.cases.map((tc) => {
                const catA = tc.traces.pipeline_a?.failure_category || "PENDING";
                const catB = tc.traces.pipeline_b?.failure_category || "PENDING";
                return (
                  <tr
                    key={tc.test_case_id}
                    onClick={() => setSelectedTestCaseId(tc.test_case_id)}
                    className="cursor-pointer transition hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-indigo-300">
                      {tc.difficulty_tag}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-100">{tc.question}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          catA === "PASS"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-rose-500/15 text-rose-400"
                        }`}
                      >
                        {catA === "PASS" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {catA}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          catB === "PASS"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-rose-500/15 text-rose-400"
                        }`}
                      >
                        {catB === "PASS" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {catB}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Split-Screen Trace Inspector Drawer */}
      <TraceDiffDrawer testCase={activeCase} onClose={() => setSelectedTestCaseId(null)} />
    </div>
  );
}
