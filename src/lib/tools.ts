// Phase 1 calc layer (T2): the pure calculations for the steel thread's one
// tool, `invocations.getAggregateStats`. No I/O, no Convex client - just data
// in, data out, so it is fast and deterministic to unit-test (tools.test.ts).
// `run` (the action that calls Convex) lands in a later commit.

import type { AggregateStats, AggregateStatsArgs } from "./types";

// ── Calc output shapes ───────────────────────────────────────────────────

export interface StatusBar {
  status: "succeeded" | "active" | "failed";
  count: number;
}

// ── validate: the LLM -> Convex trust boundary the brief grades ──────────
// Untyped LLM-emitted JSON in -> typed args out, or throw. Both args are
// optional (the thread passes none -> all-time stats). This is the
// registry-wide convention: strict on the types of known keys, and it throws
// on ANY unknown key rather than dropping it - the throw is fed back to the
// agentic loop, and naming the offending key tells the LLM which arg to drop
// on retry (the hallucination-catching the brief grades).

const KNOWN_ARGS = ["after", "groupFolder"];

export function validate(raw: unknown): AggregateStatsArgs {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("getAggregateStats args must be an object");
  }

  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!KNOWN_ARGS.includes(key)) {
      throw new Error(`getAggregateStats: unknown argument: ${key}`);
    }
  }

  const { after, groupFolder } = record;
  const args: AggregateStatsArgs = {};

  if (after !== undefined) {
    if (typeof after !== "number" || !Number.isFinite(after)) {
      throw new Error("getAggregateStats: `after` must be a number (ms epoch)");
    }
    args.after = after;
  }

  if (groupFolder !== undefined) {
    if (typeof groupFolder !== "string") {
      throw new Error("getAggregateStats: `groupFolder` must be a string");
    }
    args.groupFolder = groupFolder;
  }

  return args;
}

// ── toStatusBars: stats -> three chart bars ──────────────────────────────
// The status enum is {pending, running, succeeded, failed}, so
// active + succeeded + failed = total. The backend gives succeeded, active,
// and finishedCount (= succeeded + failed) directly; we derive the third bar
// as failed = finishedCount - succeeded. The three bars always sum to total.

export function toStatusBars(stats: AggregateStats): StatusBar[] {
  return [
    { status: "succeeded", count: stats.succeeded },
    { status: "active", count: stats.active },
    { status: "failed", count: stats.finishedCount - stats.succeeded },
  ];
}
