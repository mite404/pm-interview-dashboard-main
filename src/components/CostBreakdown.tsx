// Cost breakdown by Go Deep run - the render side of the listCostRollups tool.
// Presentational: it takes the already-merged rows (metadata + real per-run
// usage from the list -> getRunUsage fan-out in lib/cost.ts) and paints a cost
// panel. Sheet border idiom (2px navy, radius 0), matching the other cards -
// distinct from the sidebar's shadcn 8px idiom.

import { formatTokenCount, pickUnit } from "@/lib/tokenUsage";
import type { CostBreakdownRow } from "@/lib/types";

// One run's totals, formatted with a single M/K unit picked from its own total
// so the three figures read consistently (design: shared-unit rule).
function RunRow({ row }: { row: CostBreakdownRow }) {
  const { usage } = row;
  const unit = pickUnit(usage.totalTokens);
  const fmt = (n: number) => formatTokenCount(n, unit);
  return (
    <div className="flex items-center gap-4 border-b border-dc-border-hairline px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-dc-navy">
          {row.taskName}
        </div>
        <div className="mono truncate text-[11.5px] text-dc-faint">
          {row.runKey}
        </div>
      </div>
      <div className="text-right">
        <div className="mono text-[15px] font-bold text-dc-navy">
          {fmt(usage.totalTokens)}
        </div>
        <div className="mono text-[11px] text-dc-muted">
          in {fmt(usage.inputTokens)} · out {fmt(usage.outputTokens)} · cache{" "}
          {fmt(usage.cacheReadInputTokens)}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders per-run Go Deep token costs. Purely presentational - the caller
 * supplies rows already merged with real usage.
 *
 * @param rows - the merged cost rows (see {@link CostBreakdownRow})
 */
export function CostBreakdown({ rows }: { rows: CostBreakdownRow[] }) {
  return (
    <div className="border-2 border-dc-navy bg-dc-surface">
      <div className="flex items-baseline justify-between border-b-2 border-dc-navy bg-dc-card px-4 py-3">
        <span className="hd-cond text-[15px] font-bold tracking-[0.02em] text-dc-navy">
          Cost by Go Deep run
        </span>
        <span className="mono text-[11px] text-dc-faint">
          overnightBriefRuns.listCostRollups
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[13px] text-dc-muted">
          No Go Deep runs in range.
        </div>
      ) : (
        rows.map((row) => <RunRow key={row.briefRunId} row={row} />)
      )}
    </div>
  );
}
