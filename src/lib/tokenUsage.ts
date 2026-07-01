// 03 · Token Usage - the pure calc feeding the stacked-bar card. Built leaf to
// root: a formatter, then the segment table, with the one non-obvious rule
// (cache-read has no backing data on the frozen seed) called out where it's
// decided, not left implicit in the component.

import type { AggregateTokenUsage } from "./types";

export type TokenUsageSegmentKey = "input" | "output" | "cacheRead";

export interface TokenUsageSegment {
  key: TokenUsageSegmentKey;
  label: string;
  /** Pre-formatted for display, e.g. "2.43M" or "157.4K" - see `formatTokenCount`. */
  value: string;
  /** Rounded share of the total, 0-100; the three segments sum to ~100. */
  pct: number;
  /**
   * True when this segment has no live backing on the demo/seed data (cache
   * reads are never populated by the seeded invocation events, per
   * docs/PLAN.md's "wide window, always non-zero" convention - cache read is
   * the one figure that convention can't manufacture). Rendered inert with a
   * "Roadmap - not backed by the demo data" tooltip rather than silently
   * showing a misleading 0.
   */
  disabled: boolean;
}

export interface TokenUsageCardData {
  total: string;
  segments: TokenUsageSegment[];
}

/**
 * Formats a token count the way the design spec does: one shared unit (M or
 * K) picked from the total's own magnitude, applied to every segment so the
 * legend stays visually consistent (e.g. "0.89M" next to "6.39M", not "890K").
 * @param n - the raw token count
 * @param unit - the unit to render in, from `pickUnit(total)`
 */
export function formatTokenCount(n: number, unit: "M" | "K" | "none"): string {
  if (n === 0) return "0";
  if (unit === "M") return `${(n / 1_000_000).toFixed(2)}M`;
  if (unit === "K") return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function pickUnit(total: number): "M" | "K" | "none" {
  if (total >= 1_000_000) return "M";
  if (total >= 1_000) return "K";
  return "none";
}

/**
 * Shapes a raw `getAggregateTokenUsage` return into the card's segments.
 * @param usage - the typed Convex action return (`AggregateTokenUsage`)
 */
export function toTokenUsageSegments(
  usage: AggregateTokenUsage,
): TokenUsageCardData {
  const unit = pickUnit(usage.totalTokens);
  const pct = (n: number) =>
    usage.totalTokens === 0 ? 0 : Math.round((n / usage.totalTokens) * 100);

  return {
    total: formatTokenCount(usage.totalTokens, unit),
    segments: [
      {
        key: "input",
        label: "Input",
        value: formatTokenCount(usage.inputTokens, unit),
        pct: pct(usage.inputTokens),
        disabled: false,
      },
      {
        key: "output",
        label: "Output",
        value: formatTokenCount(usage.outputTokens, unit),
        pct: pct(usage.outputTokens),
        disabled: false,
      },
      {
        key: "cacheRead",
        label: "Cache read",
        value: formatTokenCount(usage.cacheReadInputTokens, unit),
        pct: pct(usage.cacheReadInputTokens),
        // Structural, not incidental: cache reads are never seeded, so a zero
        // here means "not tracked in this demo", unlike input/output where a
        // zero would be a real (if uneventful) window.
        disabled: usage.cacheReadInputTokens === 0,
      },
    ],
  };
}
