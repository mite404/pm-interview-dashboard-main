// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentRunRow } from "@/lib/agentRuns";
import { AgentRunsTable } from "./AgentRunsTable";

const rows: AgentRunRow[] = [
  {
    id: "ok",
    status: "success",
    prompt: "summarize today",
    group: "maya-web",
    when: "2026-06-22 14:30",
  },
  {
    id: "bad",
    status: "failed",
    prompt: "run the nightly brief",
    group: "sam-web",
    when: "2026-06-22 15:00",
    error: "Convex query timed out",
  },
];

describe("AgentRunsTable", () => {
  it("renders one row per run with its status chip, prompt, and group", () => {
    render(<AgentRunsTable rows={rows} />);
    expect(screen.getByText("Success")).toBeDefined();
    expect(screen.getByText("Failed")).toBeDefined();
    expect(screen.getByText("summarize today")).toBeDefined();
    expect(screen.getByText("maya-web")).toBeDefined();
  });

  it("exposes the raw error only on failed rows, behind a disclosure", () => {
    render(<AgentRunsTable rows={rows} />);
    // One disclosure, for the single failed row.
    expect(screen.getAllByText("View error")).toHaveLength(1);
    expect(screen.getByText("Convex query timed out")).toBeDefined();
  });

  it("shows an empty-state line when nothing matches the filter", () => {
    render(<AgentRunsTable rows={[]} />);
    expect(screen.getByText("No agent runs match.")).toBeDefined();
    expect(screen.queryByTestId("agent-runs-table")).toBeNull();
  });
});
