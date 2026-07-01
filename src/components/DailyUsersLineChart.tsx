// Daily unique users - line chart (the second chart TYPE, alongside the Phase 1
// bar `StatusBreakdownChart`). Purely presentational: it takes already-shaped
// `LineDatum[]` (see `lib/dailyUsersLineChart.ts`'s `toDailyUsersLineData`), the
// same data/calc split as `StatusBreakdownChart`. Reused inline in chat; a
// standalone-card height is available via the `height` prop.

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { XAxisTickContentProps } from "recharts";
import type { LineDatum } from "@/lib/dailyUsersLineChart";

// The day label is `.hd-cond` (condensed) even though it's SVG text - CSS
// font-family/text-transform apply to SVG `<text>` the same as HTML, so the
// shared class works unmodified here (same as the old bar chart's tick).
function DayTick({ x, y, payload }: XAxisTickContentProps) {
  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor="middle"
      className="hd-cond"
      fontSize={11}
      fill="var(--color-dc-muted)"
    >
      {payload.value}
    </text>
  );
}

interface DailyUsersLineChartProps {
  data: LineDatum[];
  height?: number;
}

export function DailyUsersLineChart({
  data,
  height = 180,
}: DailyUsersLineChartProps) {
  // Thin day labels to ~10 so a wide (up to 90-day) window stays readable
  // instead of Recharts stamping a label under every point.
  const tickInterval = Math.max(0, Math.floor(data.length / 10) - 1);

  return (
    <div
      data-testid="daily-users-line-chart"
      className="border-2 border-dc-border-neutral bg-dc-surface p-5"
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 16, right: 8, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            stroke="var(--color-dc-border-hairline)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            interval={tickInterval}
            axisLine={{ stroke: "var(--color-dc-navy)", strokeWidth: 2 }}
            tickLine={false}
            tick={DayTick}
          />
          <YAxis
            width={28}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--color-dc-muted)" }}
          />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-dc-orange)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
