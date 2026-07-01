import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import type { InvocationsList } from "./types";
import { toAgentRunRows } from "./agentRuns";

type Run = InvocationsList[number];

// A minimally-complete agentInvocations doc; each test overrides just the
// fields the transform reads (status/prompt/groupFolder/_creationTime/error).
function run(over: Partial<Run>): Run {
  return {
    _id: "run1" as Id<"agentInvocations">,
    _creationTime: Date.UTC(2026, 5, 22, 14, 30), // 2026-06-22 14:30 UTC
    groupFolder: "maya-web",
    chatJid: "maya@web",
    personId: "p1" as Id<"persons">,
    prompt: "summarize today",
    isMain: true,
    status: "succeeded",
    ...over,
  };
}

describe("toAgentRunRows", () => {
  it("maps status to chip state and formats creation time as UTC", () => {
    const [row] = toAgentRunRows([run({ status: "pending" })]);
    expect(row.status).toBe("queued");
    expect(row.when).toBe("2026-06-22 14:30");
  });

  it("surfaces the raw error only on failed rows", () => {
    const rows = toAgentRunRows([
      run({ _id: "ok" as Id<"agentInvocations">, status: "succeeded" }),
      run({
        _id: "bad" as Id<"agentInvocations">,
        status: "failed",
        error: "Convex query timed out",
      }),
    ]);
    expect(rows[0].error).toBeUndefined();
    expect(rows[1].error).toBe("Convex query timed out");
  });

  it("falls back to the result user message when a failed row has no error field", () => {
    const [row] = toAgentRunRows([
      run({
        status: "failed",
        error: undefined,
        result: { outputType: "error", userMessage: "Something went wrong" },
      }),
    ]);
    expect(row.error).toBe("Something went wrong");
  });
});
