import { describe, expect, it } from "vitest";
import type { AggregateTokenUsage } from "./types";
import { formatTokenCount, toTokenUsageSegments } from "./tokenUsage";

describe("formatTokenCount", () => {
  it("renders 0 plainly regardless of unit", () => {
    expect(formatTokenCount(0, "M")).toBe("0");
    expect(formatTokenCount(0, "K")).toBe("0");
  });

  it("renders the design spec's demo figures in M", () => {
    expect(formatTokenCount(6_390_000, "M")).toBe("6.39M");
    expect(formatTokenCount(890_000, "M")).toBe("0.89M");
  });

  it("renders sub-million figures in K", () => {
    expect(formatTokenCount(157_400, "K")).toBe("157.4K");
  });
});

describe("toTokenUsageSegments", () => {
  it("matches the design spec's demo figures (M unit, summing to ~100%)", () => {
    const usage: AggregateTokenUsage = {
      inputTokens: 2_430_000,
      outputTokens: 890_000,
      totalTokens: 6_390_000,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 3_070_000,
    };

    const { total, segments } = toTokenUsageSegments(usage);

    expect(total).toBe("6.39M");
    expect(segments).toEqual([
      {
        key: "input",
        label: "Input",
        value: "2.43M",
        pct: 38,
        disabled: false,
      },
      {
        key: "output",
        label: "Output",
        value: "0.89M",
        pct: 14,
        disabled: false,
      },
      {
        key: "cacheRead",
        label: "Cache read",
        value: "3.07M",
        pct: 48,
        disabled: false,
      },
    ]);
  });

  it("marks cache-read disabled when zero, matching the frozen seed", () => {
    // Real live-deployment figures (docs/REPO_TOUR.md): the seed never
    // populates cacheReadInputTokens.
    const usage: AggregateTokenUsage = {
      inputTokens: 157_400,
      outputTokens: 65_200,
      totalTokens: 222_600,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    const { segments } = toTokenUsageSegments(usage);
    const cacheRead = segments.find((s) => s.key === "cacheRead");

    expect(cacheRead?.value).toBe("0");
    expect(cacheRead?.disabled).toBe(true);
    expect(segments.find((s) => s.key === "input")?.disabled).toBe(false);
  });

  it("does not divide by zero when total is zero", () => {
    const usage: AggregateTokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    const { total, segments } = toTokenUsageSegments(usage);
    expect(total).toBe("0");
    expect(segments.every((s) => s.pct === 0)).toBe(true);
  });
});
