import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";

describe("buildSystemPrompt", () => {
  it("injects the given date so relative time windows resolve against it", () => {
    const prompt = buildSystemPrompt({ now: new Date("2026-07-01T12:00:00Z") });
    expect(prompt).toContain("2026-07-01");
  });

  it("carries the load-bearing rules", () => {
    const prompt = buildSystemPrompt({ now: new Date("2026-07-01T12:00:00Z") });
    // anti-fabrication - the highest-value rule for a data tool
    expect(prompt).toMatch(/never invent/i);
    // ambiguity -> ask (Should #8)
    expect(prompt).toMatch(/ambiguous/i);
    // confirm the resolved target before a state-changing action (Mutation UX)
    expect(prompt).toMatch(/confirm/i);
    // single-newline output (brief line 78)
    expect(prompt).toMatch(/single newline/i);
    // no duplicate data: results render inline, so prose must not re-tabulate
    expect(prompt).toMatch(/do not repeat/i);
    expect(prompt).not.toMatch(/render any tabular data as/i);
  });
});
