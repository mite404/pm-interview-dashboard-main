import { describe, expect, it } from "vitest";
import type { CostRollup, RunUsage } from "./types";
import { toCostBreakdown, validateCostRollups } from "./cost";

describe("validateCostRollups (listCostRollups args)", () => {
  it("defaults to all-time when the LLM passes none", () => {
    expect(validateCostRollups(undefined)).toEqual({ after: 0 });
    expect(validateCostRollups({})).toEqual({ after: 0 });
  });

  it("passes through a valid after / groupFolder / limit", () => {
    expect(
      validateCostRollups({ after: 1000, groupFolder: "maya-web", limit: 5 }),
    ).toEqual({ after: 1000, groupFolder: "maya-web", limit: 5 });
  });

  it("throws when after is not a finite number", () => {
    expect(() => validateCostRollups({ after: "soon" })).toThrow(/after/);
  });

  it("throws when limit is not a positive integer", () => {
    expect(() => validateCostRollups({ limit: 0 })).toThrow(/limit/);
    expect(() => validateCostRollups({ limit: 2.5 })).toThrow(/limit/);
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() => validateCostRollups({ before: 10 })).toThrow(/before/);
  });
});

// A run's usage buckets. Only `totalUsage` is read by the merge; the others are
// present because getRunUsage returns them.
function usage(total: number, input: number, output: number): RunUsage {
  const totals = {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: total - input - output,
  };
  const zero = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
  return {
    parentUsage: zero,
    childUsage: zero,
    retryUsage: zero,
    composerUsage: zero,
    totalUsage: totals,
  };
}

// A rollup row carrying the design's ZEROED usage - proving the merge takes the
// real totals from `usages`, not from the rollup.
function rollup(id: string, task: string): CostRollup {
  const zero = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
  return {
    briefRunId: id as CostRollup["briefRunId"],
    runKey: `key-${id}`,
    createdAt: 1000,
    groupFolder: "maya-web",
    taskName: task,
    userJid: "u@c.us",
    status: "succeeded",
    outputArtifact: undefined,
    parentUsage: zero,
    childUsage: zero,
    retryUsage: zero,
    composerUsage: zero,
    totalUsage: zero,
    invocationCounts: { parent: 1, child: 0, retry: 0, composer: 0 },
  };
}

describe("toCostBreakdown", () => {
  it("merges rollup metadata with the REAL per-run usage (not the zeroed rollup)", () => {
    const rollups = [
      rollup("r1", "Weekly Lead Revival"),
      rollup("r2", "Daily"),
    ];
    const usages = [usage(37700, 26200, 11500), usage(29200, 20600, 8600)];

    expect(toCostBreakdown(rollups, usages)).toEqual([
      {
        briefRunId: "r1",
        runKey: "key-r1",
        taskName: "Weekly Lead Revival",
        groupFolder: "maya-web",
        createdAt: 1000,
        usage: usages[0].totalUsage,
      },
      {
        briefRunId: "r2",
        runKey: "key-r2",
        taskName: "Daily",
        groupFolder: "maya-web",
        createdAt: 1000,
        usage: usages[1].totalUsage,
      },
    ]);
  });

  it("returns an empty breakdown for no runs", () => {
    expect(toCostBreakdown([], [])).toEqual([]);
  });
});
