// Phase 1 UI (T4): a pure presentational chart. It receives already-transformed
// bars (`StatusBar[]` from types.ts, never from tools.ts) plus the KPI scalars
// and only draws - the `toStatusBars` transform runs in the shell (App.tsx), so
// this component has no logic and its render test can feed it a fixture directly.

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatusBar } from "../lib/types";

interface StatusBreakdownChartProps {
  bars: StatusBar[];
  total: number;
  avgDuration: number;
}

export function StatusBreakdownChart({
  bars,
  total,
  avgDuration,
}: StatusBreakdownChartProps) {
  return (
    <div data-testid="status-breakdown-chart">
      <div>
        <span>{`Total runs: ${String(total)}`}</span>{" "}
        <span>{`Avg duration: ${String(Math.round(avgDuration))} ms`}</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={bars}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="status" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#4f46e5">
            <LabelList dataKey="count" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
