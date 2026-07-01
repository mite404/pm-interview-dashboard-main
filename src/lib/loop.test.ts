import { describe, expect, it } from "vitest";
import { runTurn } from "./loop";
import type { LoopDeps, TurnHooks } from "./loop";
import type { WireMessage } from "./openrouter";
import type { AggregateStats, ToolResult, ToolStatus } from "./types";

const seededStats: AggregateStats = {
  total: 39,
  active: 8,
  succeeded: 24,
  finishedCount: 31,
  avgDuration: 1234,
};
const statsResult: ToolResult = {
  tool: "getAggregateStats",
  data: seededStats,
};

// Collects what the UI would see: streamed fragments and pill transitions.
function makeHooks() {
  const deltas: string[] = [];
  const statuses: ToolStatus[] = [];
  const hooks: TurnHooks = {
    onDelta: (text) => {
      deltas.push(text);
    },
    onToolStatus: (status) => {
      statuses.push(status);
    },
  };
  return { hooks, deltas, statuses };
}

// Sensible fakes for every dependency; each test overrides just what it needs.
// Plain (non-async) functions returning Promises: the fakes do no real awaiting.
function makeDeps(over: Partial<LoopDeps>): LoopDeps {
  return {
    decideTool: () => Promise.resolve(null),
    runTool: () => Promise.resolve(statsResult),
    streamAnswer: (_messages, onDelta) => {
      onDelta("ok");
      return Promise.resolve("ok");
    },
    tools: [],
    ...over,
  };
}

describe("runTurn", () => {
  it("runs the tool, feeds the result back, then streams the answer", async () => {
    let answered: WireMessage[] = [];
    const deps = makeDeps({
      decideTool: () =>
        Promise.resolve({ id: "c1", name: "getAggregateStats", args: {} }),
      runTool: () => Promise.resolve(statsResult),
      streamAnswer: (messages, onDelta) => {
        answered = messages;
        onDelta("39 runs");
        return Promise.resolve("39 runs");
      },
    });
    const { hooks, deltas, statuses } = makeHooks();

    const result = await runTurn(
      [{ role: "user", content: "how are runs doing" }],
      hooks,
      deps,
    );

    expect(result).toEqual({ text: "39 runs", toolResult: statsResult });
    expect(deltas).toEqual(["39 runs"]);
    expect(statuses).toEqual([
      { phase: "calling", tool: "getAggregateStats" },
      { phase: "done", tool: "getAggregateStats" },
    ]);
    // The tool result was fed back into the conversation before synthesizing.
    expect(answered.some((m) => m.role === "tool")).toBe(true);

    // The API 400s a `role: "tool"` message unless it is immediately preceded
    // by the assistant message that made the call, and its `tool_call_id`
    // equals that call's `id`. Lock the ordering + id pairing as a regression
    // guard: reordering the two pushes in runTurn, or a mismatched id, would
    // slip past the `.some` check above but fail against the real API.
    const [assistantMsg, toolMsg] = answered.slice(-2);
    expect(assistantMsg.role).toBe("assistant");
    expect(toolMsg.role).toBe("tool");
    const callId = assistantMsg.tool_calls?.[0].id;
    expect(callId).toBe("c1");
    expect(toolMsg.tool_call_id).toBe(callId);
  });

  it("streams a direct answer and shows no pill when no tool is called", async () => {
    const deps = makeDeps({
      decideTool: () => Promise.resolve(null),
      runTool: () => Promise.reject(new Error("must not run")),
      streamAnswer: (_messages, onDelta) => {
        onDelta("hello!");
        return Promise.resolve("hello!");
      },
    });
    const { hooks, deltas, statuses } = makeHooks();

    const result = await runTurn(
      [{ role: "user", content: "hi" }],
      hooks,
      deps,
    );

    expect(result.text).toBe("hello!");
    expect(result.toolResult).toBeUndefined();
    expect(deltas).toEqual(["hello!"]);
    expect(statuses).toEqual([]);
  });

  it("surfaces a tool error to the user without streaming or crashing", async () => {
    let streamed = false;
    const deps = makeDeps({
      decideTool: () =>
        Promise.resolve({
          id: "c1",
          name: "getAggregateStats",
          args: { bad: 1 },
        }),
      runTool: () => Promise.reject(new Error("unknown argument: bad")),
      streamAnswer: () => {
        streamed = true;
        return Promise.resolve("");
      },
    });
    const { hooks, statuses } = makeHooks();

    const result = await runTurn([{ role: "user", content: "x" }], hooks, deps);

    expect(result.text).toContain("unknown argument: bad");
    expect(result.toolResult).toBeUndefined();
    expect(streamed).toBe(false);
    expect(statuses).toEqual([
      { phase: "calling", tool: "getAggregateStats" },
      {
        phase: "error",
        tool: "getAggregateStats",
        message: "unknown argument: bad",
      },
    ]);
  });
});
