"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Database,
  GitCompareArrows,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { createWorkspace, fetchWorkspaces } from "@/lib/api-client";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkWorkspaces() {
      try {
        const workspaces = await fetchWorkspaces();
        if (workspaces && workspaces.length > 0) {
          router.replace(`/observatory/${workspaces[0].id}`);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        console.error(err);
        setLoading(false);
      }
    }
    checkWorkspaces();
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    setCreating(true);
    setErrorMsg(null);
    try {
      const created = await createWorkspace(workspaceName.trim());
      router.push(`/observatory/${created.id}/datasets`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create workspace");
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        <span className="text-xs font-medium tracking-wide text-slate-400">
          Connecting to TraceRAG Observatory...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Hero Column */}
        <div className="lg:col-span-6 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Production RAG Failure & Hallucination Observatory
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl leading-tight">
            Pinpoint why your RAG fails —{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              retrieval or generation.
            </span>
          </h1>

          <p className="text-sm leading-relaxed text-slate-400">
            Benchmark chunking strategies, Hybrid RRF + Cross-Encoder reranking, and atomic claim grounding side-by-side against your real document corpus.
          </p>

          <div className="space-y-3 pt-2">
            {[
              {
                icon: Database,
                title: "1. Ingest Your Real Corpus",
                desc: "Upload PDFs, Markdown, or text docs and synthesize golden Q&A pairs.",
              },
              {
                icon: Layers,
                title: "2. Configure A/B Pipelines",
                desc: "Compare Fixed vs. Recursive chunking, Dense/Sparse/Hybrid RRF, and Cross-Encoder rerankers.",
              },
              {
                icon: GitCompareArrows,
                title: "3. Inspect Sentence-Level Diffs",
                desc: "Attribute every error to Retrieval Miss, Ranking Drop, Context Distraction, or Hallucination.",
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="flex items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-3.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{step.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Create Workspace Card */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-slate-800 bg-[#0b101d]/90 p-7 shadow-2xl ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                <Plus className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/25">
                <CheckCircle2 className="h-3 w-3" />
                Clean Slate Ready
              </span>
            </div>

            <h2 className="mt-5 text-xl font-bold text-white">Create Your Workspace</h2>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Workspaces isolate your documents, vector indexes, golden datasets, and benchmark runs.
            </p>

            {errorMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. Support Knowledge Base, Legal Contracts RAG"
                  className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                />
              </div>

              <button
                type="submit"
                disabled={creating || !workspaceName.trim()}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Workspace...
                  </>
                ) : (
                  <>
                    Create Workspace & Upload Corpus
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4 text-[11px] text-slate-500">
              <span>PostgreSQL pgvector + HNSW</span>
              <span>Zero Mock Data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
