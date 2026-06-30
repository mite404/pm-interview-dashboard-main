// The steel thread's one tool, `invocations.getAggregateStats`, built leaf to
// root: the pure calculations first (`validate`, `toStatusBars` - data in, data
// out, unit-tested in tools.test.ts), then the one action at the bottom (`run`,
// the Convex call). The action is dependency-injected, so the calcs above never
// touch the network and stay deterministic to test.

import { api } from "../../convex/_generated/api";
import type {
  AggregateStats,
  AggregateStatsArgs,
  StatusBar,
  ToolDeps,
} from "./types";

// ── validate: the LLM -> Convex trust boundary the brief grades ──────────
const KNOWN_ARGS = ["after", "groupFolder"];

/**
 * Narrows untyped LLM-emitted JSON into typed `getAggregateStats` args.
 *
 * The registry-wide boundary convention: strict on the types of known keys
 * (`after`, `groupFolder`, both optional - the thread passes none for all-time
 * stats), and it throws on ANY unknown key rather than dropping it.
 *
 * @param raw - the LLM's emitted args (untrusted; `undefined`/`null` -> `{}`)
 * @returns the typed, validated args
 * @throws if `raw` is not an object, carries an unknown key, or gives `after` /
 *   `groupFolder` the wrong type - the throw feeds the agentic loop, and naming
 *   the offending key tells the LLM which arg to drop on retry
 */
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
/**
 * Derives the three status bars the chart renders from the raw stats.
 *
 * The status enum is {pending, running, succeeded, failed}, so
 * active + succeeded + failed = total. The backend gives succeeded, active, and
 * finishedCount (= succeeded + failed) directly; the third bar is derived as
 * failed = finishedCount - succeeded. The three bars always sum to total.
 *
 * @param stats - the raw `getAggregateStats` return
 * @returns the succeeded / active / failed bars, in render order
 */
export function toStatusBars(stats: AggregateStats): StatusBar[] {
  return [
    { status: "succeeded", count: stats.succeeded },
    { status: "active", count: stats.active },
    { status: "failed", count: stats.finishedCount - stats.succeeded },
  ];
}

// ── run: the action - call the real Convex query (T3) ────────────────────
/**
 * The tool's one side effect: calls `invocations.getAggregateStats` over Convex.
 *
 * Dependency-injected - `deps.convex` is the real ConvexHttpClient in the app
 * (convexClient.ts) and a fake in tests, so the pure calcs above never reach the
 * network. getAggregateStats is a plain query (not an action), so `.query()`.
 * The live wire is proven by commit 0's probe, so this seam is covered by the
 * loop integration test (commit 6) and the e2e (commit 9), not a unit test.
 *
 * @param args - validated args from {@link validate}
 * @param deps - injected dependencies (the Convex client)
 * @returns the aggregate stats from the backend
 */
export function run(
  args: AggregateStatsArgs,
  deps: ToolDeps,
): Promise<AggregateStats> {
  return deps.convex.query(api.invocations.getAggregateStats, args);
}
