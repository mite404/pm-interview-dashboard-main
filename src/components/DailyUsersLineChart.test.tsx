// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LineDatum } from "@/lib/dailyUsersLineChart";
import { DailyUsersLineChart } from "./DailyUsersLineChart";

// Same approach as StatusBreakdownChart.test.tsx: Recharts needs a real layout
// engine jsdom lacks, so we stand it in with simple markers and test OUR code -
// that every point reaches the chart. The visual line is verified by eye + e2e.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({
    data,
    children,
  }: {
    data: LineDatum[];
    children: ReactNode;
  }) => (
    <div data-testid="linechart" data-points={data.length}>
      {children}
    </div>
  ),
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const data: LineDatum[] = [
  { label: "Mon", value: 128 },
  { label: "Tue", value: 156 },
  { label: "Wed", value: 88 },
];

describe("DailyUsersLineChart", () => {
  it("hands every point to the chart", () => {
    render(<DailyUsersLineChart data={data} />);
    expect(screen.getByTestId("linechart").dataset.points).toBe("3");
  });
});
