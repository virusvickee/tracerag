"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Layers, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          Loading Observatory...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl backdrop-blur">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400">
          <Layers className="h-6 w-6" />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-white">
          Welcome to TraceRAG
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          A clean workspace is ready. Create your first workspace to start uploading documents, configuring chunking & retrieval pipelines, and benchmarking RAG failure modes.
        </p>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3.5 py-2 text-xs text-rose-300">
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
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Legal Contracts RAG, Technical Docs Bench"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={creating || !workspaceName.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {creating ? (
              "Creating Workspace..."
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Workspace & Upload Documents
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
          <p className="text-[11px] text-slate-500">
            Zero mock data. All evaluations, chunk embeddings, and traces run strictly against your uploaded documents.
          </p>
        </div>
      </div>
    </div>
  );
}
