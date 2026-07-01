// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCallStatus } from "./ToolCallStatus";

describe("ToolCallStatus", () => {
  it("shows the method name inside the pill, not a separate status word", () => {
    render(<ToolCallStatus status="queued" method="messages.listByChatJid" />);
    expect(screen.getByText("messages.listByChatJid")).toBeDefined();
    // color + icon carry the state, so the status label is no longer rendered
    expect(screen.queryByText("Queued")).toBeNull();
  });

  it("appends meta after the method inside the pill", () => {
    render(
      <ToolCallStatus
        status="success"
        method="groups.listSignedUpUsers"
        meta="128 rows · 42ms"
      />,
    );
    expect(
      screen.getByText("groups.listSignedUpUsers · 128 rows · 42ms"),
    ).toBeDefined();
  });

  it("colors the failed pill with the error foreground token", () => {
    render(
      <ToolCallStatus
        status="failed"
        method="invocations.listRecent"
        meta="timeout after 30s"
      />,
    );
    const pill = screen
      .getByText("invocations.listRecent · timeout after 30s")
      .closest("span");
    expect(pill?.className).toContain("text-dc-error-fg");
  });

  it("pulses and spins only while running", () => {
    render(
      <ToolCallStatus status="running" method="dashboard.dailyUniqueUsers" />,
    );
    const pill = screen.getByText("dashboard.dailyUniqueUsers").closest("span");
    expect(pill?.className).toContain("animate-dc-pulse");
  });
});
