import { describe, expect, it } from "vitest";
import type { AggregateStats } from "./types";
import { toStatusBars, validate } from "./tools";

// A stable, all-time stats fixture mirroring the seeded deployment:
// 39 invocations = 24 succeeded + 8 active + 7 failed; finished = 24 + 7 = 31.
const seededStats: AggregateStats = {
  total: 39,
  active: 8,
  succeeded: 24,
  finishedCount: 31,
  avgDuration: 1234,
};

describe("validate (getAggregateStats args)", () => {
  it("returns empty args when the LLM passes none", () => {
    expect(validate({})).toEqual({});
    expect(validate(undefined)).toEqual({});
  });

  it("passes through a valid after timestamp", () => {
    expect(validate({ after: 1000 })).toEqual({ after: 1000 });
  });

  it("passes through a valid groupFolder", () => {
    expect(validate({ groupFolder: "maya-web" })).toEqual({
      groupFolder: "maya-web",
    });
  });

  it("throws when after is not a number", () => {
    expect(() => validate({ after: "soon" })).toThrow();
  });

  it("throws when groupFolder is not a string", () => {
    expect(() => validate({ groupFolder: 5 })).toThrow();
  });

  it("throws when given a non-object", () => {
    expect(() => validate("nope")).toThrow();
    expect(() => validate([])).toThrow();
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() => validate({ days: 7 })).toThrow(/days/);
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
