import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ApiKeyDialog } from "@/components/shared/ApiKeyDialog";
import { WorkspaceSwitcher } from "@/components/shared/WorkspaceSwitcher";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TraceRAG — Retrieval & Hallucination Observatory",
  description: "A/B RAG Evaluation, Hybrid Retrieval Benchmarking & Hallucination Diagnostics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-[#060912]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-3.5">
              <Link href="/" className="group flex items-center gap-2.5 transition">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-xs tracking-tight text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/15 transition group-hover:scale-105">
                  TR
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-white">TraceRAG</span>
                  <span className="hidden sm:inline-flex items-center rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                    Observatory
                  </span>
                </div>
              </Link>

              <span className="hidden sm:block h-4 w-px bg-slate-800" />
              <WorkspaceSwitcher />
            </div>

            <div className="flex items-center gap-2.5">
              <ApiKeyDialog />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-7">{children}</main>
      </body>
    </html>
  );
}
