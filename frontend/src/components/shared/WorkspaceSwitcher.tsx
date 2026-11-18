"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, FolderKanban, Plus, Check, Loader2 } from "lucide-react";
import { createWorkspace, fetchWorkspaces } from "@/lib/api-client";
import { WorkspaceSummary } from "@/lib/types";

export function WorkspaceSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const match = pathname.match(/^\/observatory\/([^/]+)/);
  const currentWorkspaceId = match ? match[1] : null;

  const loadWorkspaces = async () => {
    try {
      const list = await fetchWorkspaces();
      setWorkspaces(list);
    } catch {
      // Ignore silent header errors if backend is starting
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [pathname]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const activeWs = workspaces.find((w) => w.id === currentWorkspaceId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const created = await createWorkspace(newName.trim());
      setNewName("");
      setCreating(false);
      setOpen(false);
      await loadWorkspaces();
      router.push(`/observatory/${created.id}/datasets`);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (workspaces.length === 0 && !currentWorkspaceId) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-800/80"
      >
        <FolderKanban className="h-3.5 w-3.5 text-indigo-400" />
        <span className="max-w-[160px] truncate">
          {activeWs?.name || "Select Workspace"}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-800 bg-[#0c111d] p-1.5 shadow-2xl ring-1 ring-white/5 z-50">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Workspaces
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {workspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/observatory/${ws.id}`);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    isSelected
                      ? "bg-indigo-500/15 text-indigo-200 font-medium"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  }`}
                >
                  <span className="truncate pr-2">{ws.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 border-t border-slate-800/80 pt-1.5">
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-indigo-400 transition hover:bg-indigo-500/10"
              >
                <Plus className="h-3.5 w-3.5" />
                New Workspace
              </button>
            ) : (
              <form onSubmit={handleCreate} className="p-1.5 space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name..."
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !newName.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Create
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
