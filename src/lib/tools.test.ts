import { describe, expect, it } from "vitest";
import type { AggregateStats } from "./types";
import {
  toStatusBars,
  validateAggregateStats,
  validateTokenUsage,
} from "./tools";

// A stable, all-time stats fixture mirroring the seeded deployment:
// 39 invocations = 24 succeeded + 8 active + 7 failed; finished = 24 + 7 = 31.
const seededStats: AggregateStats = {
  total: 39,
  active: 8,
  succeeded: 24,
  finishedCount: 31,
  avgDuration: 1234,
};

describe("validateAggregateStats (getAggregateStats args)", () => {
  it("returns empty args when the LLM passes none", () => {
    expect(validateAggregateStats({})).toEqual({});
    expect(validateAggregateStats(undefined)).toEqual({});
  });

  it("passes through a valid after timestamp", () => {
    expect(validateAggregateStats({ after: 1000 })).toEqual({ after: 1000 });
  });

  it("passes through a valid groupFolder", () => {
    expect(validateAggregateStats({ groupFolder: "maya-web" })).toEqual({
      groupFolder: "maya-web",
    });
  });

  it("throws when after is not a number", () => {
    expect(() => validateAggregateStats({ after: "soon" })).toThrow();
  });

  it("throws when groupFolder is not a string", () => {
    expect(() => validateAggregateStats({ groupFolder: 5 })).toThrow();
  });

  it("throws when given a non-object", () => {
    expect(() => validateAggregateStats("nope")).toThrow();
    expect(() => validateAggregateStats([])).toThrow();
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() => validateAggregateStats({ days: 7 })).toThrow(/days/);
  });
});

describe("validateTokenUsage (getAggregateTokenUsage args)", () => {
  it("defaults after to 0 (all-time) when the model passes none", () => {
    expect(validateTokenUsage({})).toEqual({ after: 0 });
    expect(validateTokenUsage(undefined)).toEqual({ after: 0 });
  });

  it("passes through a valid after window", () => {
    expect(validateTokenUsage({ after: 1000 })).toEqual({ after: 1000 });
  });

  it("throws when after is not a number", () => {
    expect(() => validateTokenUsage({ after: "soon" })).toThrow();
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() => validateTokenUsage({ days: 7 })).toThrow(/days/);
  });
});

describe("toStatusBars", () => {
  it("derives succeeded, active, and failed bars (failed = finishedCount - succeeded)", () => {
    expect(toStatusBars(seededStats)).toEqual([
      { status: "succeeded", count: 24 },
      { status: "active", count: 8 },
      { status: "failed", count: 7 },
    ]);
  });

  it("produces three bars that sum to total", () => {
    const sum = toStatusBars(seededStats).reduce((n, b) => n + b.count, 0);
    expect(sum).toBe(seededStats.total);
  });
});
