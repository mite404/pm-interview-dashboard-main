// Daily unique users - the pure calc feeding the read-only line chart (the
// second chart TYPE, alongside the Phase 1 bar chart). Shapes the raw
// `dailyUniqueUsers` query return into flat {label, value} points so the
// component stays presentational (same data/calc split as `toStatusBars`).

import type { DailyUniqueUsers } from "./types";

export interface LineDatum {
  /** Short UTC-anchored day label, e.g. "Jun 18". */
  label: string;
  value: number;
}

// UTC-anchored on purpose: `dailyUniqueUsers` buckets days by UTC
// (`toISOString().slice(0, 10)`), so formatting in the browser's local zone
// could shift a point by one day.
function formatDayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Shapes a raw `dailyUniqueUsers` return into line-chart points, in order.
 * @param rows - the typed Convex query return (`DailyUniqueUsers`)
 */
export function toDailyUsersLineData(rows: DailyUniqueUsers): LineDatum[] {
  return rows.map((r) => ({
    label: formatDayLabel(r.day),
    value: r.uniqueUsers,
  }));
}
