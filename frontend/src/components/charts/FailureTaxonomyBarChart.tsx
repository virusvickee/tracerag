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
    color: "#10b981", // Emerald
    desc: "Faithfulness >= 85% & Recall >= 80%",
  },
  RETRIEVAL_MISS: {
    label: "Retrieval Miss",
    color: "#f43f5e", // Rose
    desc: "Gold doc not in top-25 retrieval pool",
  },
  RANKING_DROP: {
    label: "Ranking Drop",
    color: "#f59e0b", // Amber
    desc: "Gold doc in top-25 but pushed out of top-K",
  },
  CONTEXT_DISTRACTION: {
    label: "Context Distraction",
    color: "#6366f1", // Indigo
    desc: "Irrelevant chunks distracted generator",
  },
  HALLUCINATION: {
    label: "Hallucination",
    color: "#ec4899", // Pink
    desc: "Recall >= 80% but generated unsupported claims",
  },
};

export function FailureTaxonomyBarChart({ data }: FailureTaxonomyBarChartProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Failure Taxonomy: Error Attribution
          </h3>
          <p className="text-xs text-slate-400">
            Root-cause breakdown across retrieval vs. generation failures
          </p>
        </div>

        {/* Pass rate pill badges */}
        <div className="flex items-center gap-2 text-[11px]">
          {data.map((item, idx) => {
            const passPct =
              item.total > 0 ? Math.round((item.PASS / item.total) * 100) : 0;
            return (
              <span
                key={idx}
                className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-slate-200"
              >
                <strong className="text-white">{item.pipelineName}:</strong>{" "}
                <span className={passPct >= 70 ? "text-emerald-400" : "text-amber-400"}>
                  {passPct}% Pass
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 20, bottom: 5, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis
              type="number"
              stroke="#94a3b8"
              fontSize={12}
              allowDecimals={false}
              unit=" cases"
            />
            <YAxis
              type="category"
              dataKey="pipelineName"
              stroke="#94a3b8"
              fontSize={12}
              width={110}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const total = payload.reduce(
                  (sum, entry) => sum + (Number(entry.value) || 0),
                  0
                );
                return (
                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs shadow-xl">
                    <div className="font-semibold text-white mb-1.5">{label}</div>
                    <div className="space-y-1">
                      {payload.map((entry: any, index: number) => {
                        const count = Number(entry.value) || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-4 text-slate-300"
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              {entry.name}
                            </span>
                            <span className="font-mono text-slate-100">
                              {count} ({pct}%)
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
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              dataKey="PASS"
              name="PASS"
              stackId="a"
              fill={CATEGORY_CONFIG.PASS.color}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="RETRIEVAL_MISS"
              name="Retrieval Miss"
              stackId="a"
              fill={CATEGORY_CONFIG.RETRIEVAL_MISS.color}
            />
            <Bar
              dataKey="RANKING_DROP"
              name="Ranking Drop"
              stackId="a"
              fill={CATEGORY_CONFIG.RANKING_DROP.color}
            />
            <Bar
              dataKey="CONTEXT_DISTRACTION"
              name="Context Distraction"
              stackId="a"
              fill={CATEGORY_CONFIG.CONTEXT_DISTRACTION.color}
            />
            <Bar
              dataKey="HALLUCINATION"
              name="Hallucination"
              stackId="a"
              fill={CATEGORY_CONFIG.HALLUCINATION.color}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
