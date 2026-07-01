// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCallStatus } from "./ToolCallStatus";

describe("ToolCallStatus", () => {
  it("renders the queued label and method name, no meta suffix", () => {
    render(<ToolCallStatus status="queued" method="messages.listByChatJid" />);
    expect(screen.getByText("Queued")).toBeDefined();
    expect(screen.getByText("messages.listByChatJid")).toBeDefined();
  });

  it("renders success with a method · meta line", () => {
    render(
      <ToolCallStatus
        status="success"
        method="groups.listSignedUpUsers"
        meta="128 rows · 42ms"
      />,
    );
    expect(screen.getByText("Success")).toBeDefined();
    expect(
      screen.getByText("groups.listSignedUpUsers · 128 rows · 42ms"),
    ).toBeDefined();
  });

  it("colors the failed method line with the error foreground token", () => {
    render(
      <ToolCallStatus
        status="failed"
        method="invocations.listRecent"
        meta="timeout after 30s"
      />,
    );
    const methodLine = screen.getByText(
      "invocations.listRecent · timeout after 30s",
    );
    expect(methodLine.className).toContain("text-dc-error-fg");
  });

  it("pulses and spins only while running", () => {
    render(
      <ToolCallStatus status="running" method="dashboard.dailyUniqueUsers" />,
    );
    const chip = screen.getByText("Running").closest("span");
    expect(chip?.className).toContain("animate-dc-pulse");
  });
});
