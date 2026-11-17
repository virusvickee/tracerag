import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ApiKeyDialog } from "@/components/shared/ApiKeyDialog";

export const metadata: Metadata = {
  title: "TraceRAG — Retrieval & Hallucination Observatory",
  description: "A/B RAG Evaluation, Hybrid Retrieval Benchmarking & Hallucination Diagnostics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased">
        <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow">
                TR
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-white">TraceRAG</span>
                <span className="ml-2 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                  RAG Observatory
                </span>
              </div>
            </Link>
            <ApiKeyDialog />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
