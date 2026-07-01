import { describe, expect, it } from "vitest";
import type { ToolStatus } from "./types";
import { invocationStatusToChipStatus, toChipStatus } from "./toolCallStatus";

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

describe("invocationStatusToChipStatus", () => {
  it("relabels pending -> queued and succeeded -> success", () => {
    expect(invocationStatusToChipStatus("pending")).toBe("queued");
    expect(invocationStatusToChipStatus("succeeded")).toBe("success");
  });

  it("passes running and failed through unchanged", () => {
    expect(invocationStatusToChipStatus("running")).toBe("running");
    expect(invocationStatusToChipStatus("failed")).toBe("failed");
  });
});
