// Cost breakdown by Go Deep run, ordered data -> calc -> action. The backend
// splits the truth in two: `listCostRollups` gives each run's metadata but ZEROED
// usage, and `getRunUsage` carries the real per-run token totals. So the tool's
// action fans out - list the runs, then fetch each run's real usage - and a pure
// calc merges the two into the rows the UI renders. `validate` is the same
// LLM -> Convex trust boundary the other tools use.

import { api } from "../../convex/_generated/api";
import type {
  CostBreakdownRow,
  CostRollup,
  CostRollupsArgs,
  RunUsage,
  ToolDeps,
} from "./types";

// ── validate: LLM args -> typed CostRollupsArgs ──────────────────────────
const KNOWN_ARGS = ["after", "groupFolder", "limit"];

/**
 * Narrows untyped LLM-emitted JSON into typed `listCostRollups` args.
 *
 * Same convention as the other tools: throws on any unknown key. `after`
 * defaults to 0 (all-time) when omitted - the usual case; `groupFolder` scopes
 * to one group; `limit` caps the run list (and therefore the fan-out).
 *
 * @param raw - the LLM's emitted args (untrusted; `undefined`/`null` -> all-time)
 * @returns the typed, validated args
 * @throws if `raw` is not an object, carries an unknown key, or gives a known
 *   key the wrong type - the throw feeds the loop so the model can self-correct
 */
export function validateCostRollups(raw: unknown): CostRollupsArgs {
  if (raw === undefined || raw === null) return { after: 0 };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("listCostRollups args must be an object");
  }

  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!KNOWN_ARGS.includes(key)) {
      throw new Error(`listCostRollups: unknown argument: ${key}`);
    }
  }

  const { after, groupFolder, limit } = record;
  const args: CostRollupsArgs = { after: 0 };

  if (after !== undefined) {
    if (typeof after !== "number" || !Number.isFinite(after)) {
      throw new Error("listCostRollups: `after` must be a number (ms epoch)");
    }
    args.after = after;
  }
  if (groupFolder !== undefined) {
    if (typeof groupFolder !== "string") {
      throw new Error("listCostRollups: `groupFolder` must be a string");
    }
    args.groupFolder = groupFolder;
  }
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || (limit as number) <= 0) {
      throw new Error("listCostRollups: `limit` must be a positive integer");
    }
    args.limit = limit as number;
  }
  return args;
}

// ── toCostBreakdown: merge rollup metadata + real usage (pure) ───────────
/**
 * Zips each run's rollup metadata with its real usage into render rows.
 *
 * `rollups[i]` and `usages[i]` must describe the same run (the action fetches
 * them in the same order). The rollup's own `totalUsage` is ignored here - it is
 * zeroed in this backend; the real totals come from `usages[i].totalUsage`.
 *
 * @param rollups - the run metadata from `listCostRollups`
 * @param usages - each run's real usage from `getRunUsage`, same order
 * @returns one merged row per run, ready to render
 */
export function toCostBreakdown(
  rollups: CostRollup[],
  usages: RunUsage[],
): CostBreakdownRow[] {
  return rollups.map((rollup, index) => ({
    briefRunId: rollup.briefRunId,
    runKey: rollup.runKey,
    taskName: rollup.taskName,
    groupFolder: rollup.groupFolder,
    createdAt: rollup.createdAt,
    usage: usages[index].totalUsage,
  }));
}

// ── run: the action - list runs, then fan out for real usage ─────────────
// ponytail: the fan-out is one getRunUsage query per run, so it is bounded by
// MAX_FANOUT rather than the raw run count. Bump it (or page) if the cost view
// ever needs more than the most recent 20 runs.
const MAX_FANOUT = 20;

/**
 * The tool's action: lists Go Deep runs (`listCostRollups`), then fetches each
 * run's real usage (`getRunUsage`) and merges them. The list query's usage is
 * zeroed, so the fan-out is what makes the totals real.
 *
 * @param args - validated args from {@link validateCostRollups}
 * @param deps - injected dependencies (the Convex client)
 * @returns the merged per-run cost rows, most recent run first
 */
export async function runCostBreakdown(
  args: CostRollupsArgs,
  deps: ToolDeps,
): Promise<CostBreakdownRow[]> {
  const rollups = await deps.convex.query(
    api.overnightBriefRuns.listCostRollups,
    args,
  );
  const capped = rollups.slice(0, MAX_FANOUT);
  const usages = await Promise.all(
    capped.map((rollup) =>
      deps.convex.query(api.overnightBriefRuns.getRunUsage, {
        briefRunId: rollup.briefRunId,
      }),
    ),
  );
  return toCostBreakdown(capped, usages);
}
