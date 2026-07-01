// 04 · Bar Chart - daily-unique-users, peak highlighted. The one piece of
// business logic the design spec calls out to "port verbatim" is the
// peak-highlight rule (max value bar -> orange, all others navy); the spec's
// hand-rolled `height = value/maxV*100%` math is superseded here because
// Recharts (the project's charting lib, per DESIGN.md) scales bar height from
// `value` itself, so re-deriving a percentage would be dead code no one reads.

import type { DailyUniqueUsers } from "./types";

export interface BarDatum {
  label: string;
  value: number;
  /** Orange for the max datum, navy otherwise - the spec's peak-highlight rule. */
  fill: string;
}

const NAVY = "var(--color-dc-navy)";
const ORANGE = "var(--color-dc-orange)";

/**
 * Formats a `YYYY-MM-DD` day key as a short UTC-anchored label (e.g. "Jun 18").
 * Built from `Date.UTC` + `timeZone: "UTC"` on purpose: `dailyUniqueUsers`
 * buckets days by UTC (`toISOString().slice(0, 10)`), so formatting in the
 * browser's local zone could shift the displayed day by one.
 */
function formatDayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Shapes a raw `dailyUniqueUsers` return into peak-highlighted bar data.
 * @param rows - the typed Convex query return (`DailyUniqueUsers`)
 */
export function toDailyUsersBarData(rows: DailyUniqueUsers): BarDatum[] {
  const maxUsers = Math.max(0, ...rows.map((r) => r.uniqueUsers));

  return rows.map((r) => ({
    label: formatDayLabel(r.day),
    value: r.uniqueUsers,
    // maxUsers === 0 means every day is empty; nothing is "the peak" then.
    fill: maxUsers > 0 && r.uniqueUsers === maxUsers ? ORANGE : NAVY,
  }));
}
