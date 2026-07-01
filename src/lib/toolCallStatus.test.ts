import { describe, expect, it } from "vitest";
import type { ToolStatus } from "./types";
import { toChipStatus } from "./toolCallStatus";

describe("toChipStatus", () => {
  it("maps calling -> running", () => {
    const status: ToolStatus = { phase: "calling", tool: "dailyUniqueUsers" };
    expect(toChipStatus(status)).toBe("running");
  });

  it("maps done -> success", () => {
    const status: ToolStatus = { phase: "done", tool: "dailyUniqueUsers" };
    expect(toChipStatus(status)).toBe("success");
  });

  it("maps error -> failed", () => {
    const status: ToolStatus = {
      phase: "error",
      tool: "dailyUniqueUsers",
      message: "timeout after 30s",
    };
    expect(toChipStatus(status)).toBe("failed");
  });
});
