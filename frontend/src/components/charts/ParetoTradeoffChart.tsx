"use client";

import React from "react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

interface ParetoPoint {
  name: string;
  costInr: number;
  faithfulnessPct: number;
  latencyMs: number;
}

const POINT_COLORS = ["#818cf8", "#34d399", "#f59e0b", "#38bdf8"];

export function ParetoTradeoffChart({ data }: { data: ParetoPoint[] }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0b101d]/80 p-5 shadow-lg ring-1 ring-white/[0.03]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Pareto Frontier: Spend vs. Grounded Faithfulness
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Top-left is optimal (higher faithfulness at lower cost; bubble size = latency)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {data.map((pt, idx) => (
            <span
              key={pt.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-0.5 text-slate-200"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: POINT_COLORS[idx % POINT_COLORS.length] }}
              />
              <span className="max-w-[130px] truncate">{pt.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeOpacity={0.7} />
            <XAxis
              type="number"
              dataKey="costInr"
              name="Cost / 1k"
              unit=" ₹"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
            />
            <YAxis
              type="number"
              dataKey="faithfulnessPct"
              name="Faithfulness"
              unit="%"
              domain={[0, 100]}
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
            />
            <ZAxis type="number" dataKey="latencyMs" range={[180, 420]} name="Latency" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "#475569" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const pt = payload[0].payload as ParetoPoint;
                return (
                  <div className="rounded-xl border border-slate-700/80 bg-[#0c111d]/95 p-3 text-xs shadow-2xl backdrop-blur">
                    <div className="font-semibold text-white mb-2 border-b border-slate-800 pb-1.5">
                      {pt.name}
                    </div>
                    <div className="space-y-1 text-slate-300">
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-slate-400">Faithfulness</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {pt.faithfulnessPct}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-slate-400">Cost / 1k</span>
                        <span className="font-mono font-semibold text-slate-100">
                          ₹{pt.costInr}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-slate-400">Avg Latency</span>
                        <span className="font-mono font-semibold text-indigo-300">
                          {pt.latencyMs} ms
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter name="Pipelines" data={data}>
              {data.map((entry, idx) => (
                <Cell
                  key={entry.name}
                  fill={POINT_COLORS[idx % POINT_COLORS.length]}
                  fillOpacity={0.9}
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
