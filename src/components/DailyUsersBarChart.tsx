// 04 · Bar Chart - daily-unique-users, peak highlighted. Purely
// presentational: it takes already peak-highlighted `BarDatum[]` (see
// `lib/dailyUsersBarChart.ts`'s `toDailyUsersBarData`, the transform off the
// real `dailyUniqueUsers` query return), same split as `StatusBreakdownChart`
// in Phase 1. Standalone-card sizing per the spec (180px tall, 2px navy
// baseline); the same component is reused inline in chat at a shorter height
// via the `height` prop.

import {
  Bar,
  BarChart,
  LabelList,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { BarRectangleItem, XAxisTickContentProps } from "recharts";
import type { BarDatum } from "@/lib/dailyUsersBarChart";

// `Cell` is deprecated as of Recharts 3 (removed in 4); the per-datum
// peak-highlight fill is applied via `shape` instead, per the migration note
// on `Cell`. Exported (not module-private) so its one job - forward the
// datum's already-computed `fill` to the default Rectangle shape - has its
// own direct render test, since the mocked `recharts` in the test file can't
// exercise a real `shape` invocation end to end.
export function PeakHighlightBar(props: BarRectangleItem) {
  const fill = (props.payload as BarDatum | undefined)?.fill;
  return <Rectangle {...props} fill={fill} />;
}

// The spec's day label is `.hd-cond` (condensed/uppercase/bold) even though
// it's SVG text, not a `<span>` - CSS `font-family`/`text-transform` apply to
// SVG `<text>` the same as HTML, so the shared class works unmodified here.
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

interface DailyUsersBarChartProps {
  data: BarDatum[];
  height?: number;
}

export function DailyUsersBarChart({
  data,
  height = 180,
}: DailyUsersBarChartProps) {
  // A 90-day wide-window query (the DESIGN.md convention that keeps the
  // sparse frozen seed non-empty) puts far more bars on screen than the
  // spec's 7-bar demo. Thinning to ~10 labels keeps the axis readable at any
  // window size instead of Recharts stamping a day label under every bar.
  const tickInterval = Math.max(0, Math.floor(data.length / 10) - 1);

  return (
    <div
      data-testid="daily-users-bar-chart"
      className="border-2 border-dc-border-neutral bg-dc-surface p-5"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 4, left: 4, bottom: 4 }}
        >
          <XAxis
            dataKey="label"
            interval={tickInterval}
            axisLine={{ stroke: "var(--color-dc-navy)", strokeWidth: 2 }}
            tickLine={false}
            tick={DayTick}
          />
          <Tooltip />
          <Bar
            dataKey="value"
            isAnimationActive={false}
            shape={PeakHighlightBar}
          >
            <LabelList
              dataKey="value"
              position="top"
              style={{
                fontSize: 11,
                fill: "var(--color-dc-muted)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
