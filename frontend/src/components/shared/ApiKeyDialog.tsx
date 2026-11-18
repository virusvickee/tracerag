"use client";

import React, { useEffect, useState } from "react";
import { KeyRound, X, Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react";

export function ApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const saved =
      sessionStorage.getItem("tracerag_provider_key") ||
      sessionStorage.getItem("evallens_provider_key") ||
      "";
    setApiKey(saved);
    setHasKey(Boolean(saved));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleSave = () => {
    if (apiKey.trim()) {
      sessionStorage.setItem("tracerag_provider_key", apiKey.trim());
      sessionStorage.setItem("evallens_provider_key", apiKey.trim());
      setHasKey(true);
    } else {
      sessionStorage.removeItem("tracerag_provider_key");
      sessionStorage.removeItem("evallens_provider_key");
      setHasKey(false);
    }
    setOpen(false);
  };

  const handleClear = () => {
    setApiKey("");
    sessionStorage.removeItem("tracerag_provider_key");
    sessionStorage.removeItem("evallens_provider_key");
    setHasKey(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          hasKey
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/50 hover:bg-emerald-500/15"
            : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-indigo-500/50 hover:text-white"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            hasKey
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              : "bg-indigo-400/70"
          }`}
        />
        <KeyRound className="h-3.5 w-3.5 opacity-80" />
        <span>{hasKey ? "BYOK Active" : "Provider Key"}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl ring-1 ring-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Bring Your Own API Key</h3>
                  <p className="text-[11px] text-slate-400">Override server OpenAI credentials per session</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>
                Stored strictly in browser <code className="text-slate-200">sessionStorage</code> and passed via{" "}
                <code className="text-slate-200">X-Provider-Key</code> header. Cleared automatically when you close this tab.
              </span>
            </div>

            <div className="mt-4">
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950 py-2.5 pl-3.5 pr-10 font-mono text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              {hasKey ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Key
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Save to Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
