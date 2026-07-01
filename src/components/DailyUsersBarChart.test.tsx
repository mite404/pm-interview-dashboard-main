// @vitest-environment jsdom
import type { ReactNode } from "react";
import type { BarRectangleItem } from "recharts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BarDatum } from "@/lib/dailyUsersBarChart";
import { DailyUsersBarChart, PeakHighlightBar } from "./DailyUsersBarChart";

// Same approach as StatusBreakdownChart.test.tsx: Recharts needs a real layout
// engine jsdom doesn't have, so we stand it in with simple markers and test
// OUR code - that every bar reaches the chart, and (via the exported
// `PeakHighlightBar` shape fn below) that a datum's fill is forwarded to
// Rectangle. The visual bars are verified by eye and the e2e, not here.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ data, children }: { data: BarDatum[]; children: ReactNode }) => (
    <div data-testid="barchart" data-bars={data.length}>
      {children}
    </div>
  ),
  Bar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Rectangle: ({ fill }: { fill?: string }) => (
    <rect data-testid="rectangle" data-fill={fill} />
  ),
  LabelList: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

const data: BarDatum[] = [
  { label: "Mon", value: 128, fill: "var(--color-dc-navy)" },
  { label: "Thu", value: 172, fill: "var(--color-dc-orange)" },
  { label: "Sun", value: 88, fill: "var(--color-dc-navy)" },
];

describe("DailyUsersBarChart", () => {
  it("hands every bar to the chart", () => {
    render(<DailyUsersBarChart data={data} />);
    expect(screen.getByTestId("barchart").dataset.bars).toBe("3");
  });
});

describe("PeakHighlightBar", () => {
  it("forwards the datum's peak-highlight fill to the default Rectangle shape", () => {
    const props = {
      payload: data[1], // the peak day - orange
    } as unknown as BarRectangleItem;

    render(<PeakHighlightBar {...props} />);
    expect(screen.getByTestId("rectangle").dataset.fill).toBe(
      "var(--color-dc-orange)",
    );
  });
});
