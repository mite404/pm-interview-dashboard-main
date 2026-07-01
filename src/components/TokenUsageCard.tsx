// 03 · Token Usage - the stacked-bar card. Purely presentational: it takes
// already-shaped `TokenUsageSegment[]` (see `lib/tokenUsage.ts`'s
// `toTokenUsageSegments`, the transform off the real `getAggregateTokenUsage`
// action return), so the component has no Convex/formatting logic of its own
// and its render test can feed it a fixture directly - same split as
// `StatusBreakdownChart`/`toStatusBars` in Phase 1.
//
// Label note: the design spec's demo copy says "This month", but a literal
// calendar-month window is 0 on the frozen late-June seed (today is exactly
// month-start on a fresh clock) while a rolling 30-day window still spans the
// seeded data - hence the caller passes `period="Last 30 days"` and computes
// `after` as `Date.now() - 30 days`, not a calendar-month boundary.

import { cn } from "@/lib/utils";
import type { TokenUsageCardData, TokenUsageSegment } from "@/lib/tokenUsage";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ROADMAP_TOOLTIP = "Roadmap - not backed by the demo data";

const SEGMENT_COLOR: Record<TokenUsageSegment["key"], string> = {
  input: "var(--color-dc-navy)",
  output: "var(--color-dc-orange)",
  cacheRead: "var(--color-dc-chart-secondary)",
};

interface TokenUsageCardProps extends TokenUsageCardData {
  /** e.g. "Last 30 days" - see the module comment for why not "This month". */
  period: string;
}

function LegendRow({ segment }: { segment: TokenUsageSegment }) {
  const row = (
    <div
      className={cn(
        "flex items-center gap-[9px] text-[13px]",
        segment.disabled && "cursor-not-allowed opacity-50",
      )}
      aria-disabled={segment.disabled}
    >
      <span
        className="size-3 shrink-0"
        style={{ backgroundColor: SEGMENT_COLOR[segment.key] }}
      />
      <span
        className={cn(
          "font-semibold",
          segment.disabled ? "text-dc-faint" : "text-dc-navy",
        )}
      >
        {segment.label}
      </span>
      <span className="ml-auto font-mono text-dc-muted">{segment.value}</span>
    </div>
  );

  if (!segment.disabled) return row;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent>{ROADMAP_TOOLTIP}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TokenUsageCard({
  period,
  total,
  segments,
}: TokenUsageCardProps) {
  return (
    <Card className="gap-0 rounded-none border-2 border-dc-border-neutral bg-dc-surface p-0 ring-0">
      <CardHeader className="flex flex-row items-baseline justify-between px-[18px] pt-[18px] pb-[14px]">
        <span className="text-[13px] text-dc-muted">{period}</span>
        <span className="font-mono text-2xl font-bold text-dc-navy normal-case">
          {total}
        </span>
      </CardHeader>
      <CardContent className="px-[18px] pb-[18px]">
        <div className="flex h-[22px] border-2 border-dc-navy">
          {segments.map((segment) => (
            <div
              key={segment.key}
              style={{
                width: `${String(segment.pct)}%`,
                backgroundColor: SEGMENT_COLOR[segment.key],
              }}
            />
          ))}
        </div>
        <div className="mt-[14px] flex flex-col gap-2">
          {segments.map((segment) => (
            <LegendRow key={segment.key} segment={segment} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
