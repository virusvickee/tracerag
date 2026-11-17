"use client";

import React, { useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";

export function ApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const saved =
      sessionStorage.getItem("tracerag_provider_key") ||
      sessionStorage.getItem("evallens_provider_key") ||
      "";
    setApiKey(saved);
    setHasKey(Boolean(saved));
  }, []);

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-indigo-500"
      >
        <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
        {hasKey ? "BYOK Key Active" : "Demo Mode (Add API Key)"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Bring Your Own API Key</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Your OpenAI API key is stored strictly in browser <code>sessionStorage</code> and sent only via request headers for live batch runs.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Save to Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
