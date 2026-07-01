// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StatusBar } from "../lib/types";
import { StatusBreakdownChart } from "./StatusBreakdownChart";

// Recharts is a trusted third party that needs a real layout engine (jsdom has
// none). We stand it in with simple markers and test OUR component: that it
// renders the KPI scalars and hands every bar to the chart. The visual bars are
// verified by eye and the e2e (commit 9), not here.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ data, children }: { data: unknown[]; children: ReactNode }) => (
    <div data-testid="barchart" data-bars={data.length}>
      {children}
    </div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const bars: StatusBar[] = [
  { status: "succeeded", count: 24 },
  { status: "active", count: 8 },
  { status: "failed", count: 7 },
];

describe("StatusBreakdownChart", () => {
  it("renders the KPI scalars and feeds every bar to the chart", () => {
    render(<StatusBreakdownChart bars={bars} total={39} avgDuration={1234} />);

    expect(screen.getByText("Total runs: 39")).toBeDefined();
    expect(screen.getByText("Avg duration: 1234 ms")).toBeDefined();
    expect(screen.getByTestId("barchart").dataset.bars).toBe("3");
  });
});
