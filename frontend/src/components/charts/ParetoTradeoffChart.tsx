"use client";

import React from "react";
import {
  CartesianGrid,
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

export function ParetoTradeoffChart({ data }: { data: ParetoPoint[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-100">
          Pareto Trade-Off: Cost / 1k Queries vs. Faithfulness
        </h3>
        <p className="text-xs text-slate-400">Top-left indicates higher grounded accuracy at lower spend</p>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 15, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              type="number"
              dataKey="costInr"
              name="Cost / 1k"
              unit=" ₹"
              stroke="#94a3b8"
              fontSize={12}
            />
            <YAxis
              type="number"
              dataKey="faithfulnessPct"
              name="Faithfulness"
              unit="%"
              domain={[0, 100]}
              stroke="#94a3b8"
              fontSize={12}
            />
            <ZAxis type="number" dataKey="latencyMs" range={[120, 320]} name="Latency (ms)" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Scatter name="Pipelines" data={data} fill="#818cf8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
