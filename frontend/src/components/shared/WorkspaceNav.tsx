"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Layers, Database } from "lucide-react";

export function WorkspaceNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Observatory Dashboard",
      href: `/observatory/${workspaceId}`,
      icon: BarChart3,
      exact: true,
    },
    {
      label: "Pipelines A/B Config",
      href: `/observatory/${workspaceId}/pipelines`,
      icon: Layers,
      exact: false,
    },
    {
      label: "Corpus & Golden Datasets",
      href: `/observatory/${workspaceId}/datasets`,
      icon: Database,
      exact: false,
    },
  ];

  return (
    <nav className="mb-6 flex border-b border-slate-800">
      <div className="flex gap-2">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
                isActive
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5 font-semibold"
                  : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
