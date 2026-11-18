"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Layers, Database } from "lucide-react";

export function WorkspaceNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Observatory",
      sublabel: "A/B Analytics & Diffs",
      href: `/observatory/${workspaceId}`,
      icon: BarChart3,
      exact: true,
    },
    {
      label: "Pipelines",
      sublabel: "Chunking & Retrieval",
      href: `/observatory/${workspaceId}/pipelines`,
      icon: Layers,
      exact: false,
    },
    {
      label: "Datasets & Corpus",
      sublabel: "Docs & Golden Q&A",
      href: `/observatory/${workspaceId}/datasets`,
      icon: Database,
      exact: false,
    },
  ];

  return (
    <div className="mb-7 flex items-center justify-between border-b border-slate-800/70 pb-4">
      <nav className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-800/80 bg-slate-950/70 p-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-200 shadow-sm ring-1 ring-indigo-500/35 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
