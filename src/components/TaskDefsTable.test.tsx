// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskRow } from "@/lib/taskDefs";
import { TaskDefsTable } from "./TaskDefsTable";

const rows: TaskRow[] = [
  {
    id: "a",
    name: "Daily Project Accounting",
    status: "active",
    schedule: "0 9 * * * (America/New_York)",
    query: "summarize spend per project daily",
  },
  {
    id: "b",
    name: "Weekly Roundup",
    status: "paused",
    schedule: "0 8 * * 1 (UTC)",
    query: "weekly digest",
  },
];

describe("TaskDefsTable", () => {
  it("renders one row per task with its name, status, and schedule", () => {
    render(<TaskDefsTable rows={rows} />);
    expect(screen.getByText("Daily Project Accounting")).toBeDefined();
    expect(screen.getByText("active")).toBeDefined();
    expect(screen.getByText("paused")).toBeDefined();
    expect(screen.getByText("0 9 * * * (America/New_York)")).toBeDefined();
  });

  it("colors the status chip by lifecycle (active healthy, paused warning)", () => {
    render(<TaskDefsTable rows={rows} />);
    expect(screen.getByText("active").className).toContain("bg-dc-success-bg");
    expect(screen.getByText("paused").className).toContain("bg-dc-warning-bg");
  });

  it("shows an empty-state line when there are no tasks", () => {
    render(<TaskDefsTable rows={[]} />);
    expect(screen.getByText("No scheduled tasks.")).toBeDefined();
    expect(screen.queryByTestId("task-defs-table")).toBeNull();
  });
});
