// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TokenUsageSegment } from "@/lib/tokenUsage";
import { TokenUsageCard } from "./TokenUsageCard";

const segments: TokenUsageSegment[] = [
  { key: "input", label: "Input", value: "2.43M", pct: 38, disabled: false },
  { key: "output", label: "Output", value: "0.89M", pct: 14, disabled: false },
  {
    key: "cacheRead",
    label: "Cache read",
    value: "0",
    pct: 0,
    disabled: true,
  },
];

describe("TokenUsageCard", () => {
  it("renders the period label, total, and every segment's value", () => {
    render(
      <TokenUsageCard
        period="Last 30 days"
        total="3.32M"
        segments={segments}
      />,
    );

    expect(screen.getByText("Last 30 days")).toBeDefined();
    expect(screen.getByText("3.32M")).toBeDefined();
    expect(screen.getByText("2.43M")).toBeDefined();
    expect(screen.getByText("0.89M")).toBeDefined();
  });

  it("marks the disabled (cache-read) row inert, live segments untouched", () => {
    render(
      <TokenUsageCard
        period="Last 30 days"
        total="3.32M"
        segments={segments}
      />,
    );

    const cacheRow = screen
      .getByText("Cache read")
      .closest("div[aria-disabled]");
    expect(cacheRow?.getAttribute("aria-disabled")).toBe("true");
    expect(cacheRow?.className).toContain("opacity-50");

    const inputRow = screen.getByText("Input").closest("div[aria-disabled]");
    expect(inputRow?.getAttribute("aria-disabled")).toBe("false");
    expect(inputRow?.className).not.toContain("opacity-50");
  });
});
