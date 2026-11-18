"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FailureCategory } from "@/lib/types";

export interface FailureDistributionItem {
  pipelineName: string;
  PASS: number;
  RETRIEVAL_MISS: number;
  RANKING_DROP: number;
  CONTEXT_DISTRACTION: number;
  HALLUCINATION: number;
  total: number;
}

interface FailureTaxonomyBarChartProps {
  data: FailureDistributionItem[];
}

const CATEGORY_CONFIG: Record<
  FailureCategory,
  { label: string; color: string; desc: string }
> = {
  PASS: {
    label: "PASS",
    color: "#10b981",
    desc: "Faithfulness >= 85% & Recall >= 80%",
  },
  RETRIEVAL_MISS: {
    label: "Retrieval Miss",
    color: "#f43f5e",
    desc: "Gold doc not in top-25 retrieval pool",
  },
  RANKING_DROP: {
    label: "Ranking Drop",
    color: "#f59e0b",
    desc: "Gold doc in top-25 but pushed out of top-K",
  },
  CONTEXT_DISTRACTION: {
    label: "Context Distraction",
    color: "#6366f1",
    desc: "Irrelevant chunks distracted generator",
  },
  HALLUCINATION: {
    label: "Hallucination",
    color: "#ec4899",
    desc: "Recall >= 80% but generated unsupported claims",
  },
};

export function FailureTaxonomyBarChart({ data }: FailureTaxonomyBarChartProps) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0b101d]/80 p-5 shadow-lg ring-1 ring-white/[0.03]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Failure Taxonomy: Error Attribution
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Root-cause breakdown across retrieval vs. generation failures
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {data.map((item, idx) => {
            const passPct =
              item.total > 0 ? Math.round((item.PASS / item.total) * 100) : 0;
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-0.5 text-slate-300"
              >
                <span className="max-w-[100px] truncate font-medium text-slate-200">
                  {item.pipelineName}
                </span>
                <span
                  className={`font-mono font-semibold ${
                    passPct >= 75
                      ? "text-emerald-400"
                      : passPct >= 45
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {passPct}%
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 20, bottom: 5, left: 6 }}
            barSize={26}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeOpacity={0.7} horizontal={false} />
            <XAxis
              type="number"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              allowDecimals={false}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
            />
            <YAxis
              type="category"
              dataKey="pipelineName"
              stroke="#64748b"
              tick={{ fill: "#cbd5e1", fontSize: 11 }}
              width={118}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const total = payload.reduce(
                  (sum, entry) => sum + (Number(entry.value) || 0),
                  0
                );
                return (
                  <div className="rounded-xl border border-slate-700/80 bg-[#0c111d]/95 p-3 text-xs shadow-2xl backdrop-blur">
                    <div className="font-semibold text-white mb-2 border-b border-slate-800 pb-1.5">
                      {label}
                    </div>
                    <div className="space-y-1.5">
                      {payload.map((entry: any, index: number) => {
                        const count = Number(entry.value) || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-5 text-slate-300"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              {entry.name}
                            </span>
                            <span className="font-mono text-slate-100">
                              {count} <span className="text-slate-500">({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#94a3b8" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="PASS" name="PASS" stackId="a" fill={CATEGORY_CONFIG.PASS.color} />
            <Bar dataKey="RETRIEVAL_MISS" name="Retrieval Miss" stackId="a" fill={CATEGORY_CONFIG.RETRIEVAL_MISS.color} />
            <Bar dataKey="RANKING_DROP" name="Ranking Drop" stackId="a" fill={CATEGORY_CONFIG.RANKING_DROP.color} />
            <Bar dataKey="CONTEXT_DISTRACTION" name="Context Distraction" stackId="a" fill={CATEGORY_CONFIG.CONTEXT_DISTRACTION.color} />
            <Bar
              dataKey="HALLUCINATION"
              name="Hallucination"
              stackId="a"
              fill={CATEGORY_CONFIG.HALLUCINATION.color}
              radius={[0, 5, 5, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
