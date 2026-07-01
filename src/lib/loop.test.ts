import { describe, expect, it } from "vitest";
import { runTurn } from "./loop";
import type { LoopDeps, TurnHooks } from "./loop";
import type { ToolCall, WireMessage } from "./openrouter";
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

// A scripted fake LLM: returns each queued decision in turn, then null (answer)
// once the script is exhausted. This is how we drive real multi-step turns.
function scriptDecideTool(script: (ToolCall | null)[]): LoopDeps["decideTool"] {
  let i = 0;
  return () => Promise.resolve(i < script.length ? script[i++] : null);
}

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
  it("runs a tool, feeds the result back with a matching id, then answers", async () => {
    let answered: WireMessage[] = [];
    const deps = makeDeps({
      decideTool: scriptDecideTool([
        { id: "c1", name: "getAggregateStats", args: {} },
        null,
      ]),
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
    // The assistant tool-call message immediately precedes its tool result, and
    // the tool_call_id matches - the real API 400s otherwise (regression guard).
    const [assistantMsg, toolMsg] = answered.slice(-2);
    expect(assistantMsg.role).toBe("assistant");
    expect(toolMsg.role).toBe("tool");
    const callId = assistantMsg.tool_calls?.[0].id;
    expect(callId).toBe("c1");
    expect(toolMsg.tool_call_id).toBe(callId);
  });

  it("chains multiple tools across steps, feeding each result back before answering", async () => {
    let answered: WireMessage[] = [];
    const deps = makeDeps({
      decideTool: scriptDecideTool([
        { id: "c1", name: "listConversations", args: {} },
        { id: "c2", name: "getAggregateStats", args: {} },
        null,
      ]),
      runTool: () => Promise.resolve(statsResult),
      streamAnswer: (messages, onDelta) => {
        answered = messages;
        onDelta("done");
        return Promise.resolve("done");
      },
    });
    const { hooks, statuses } = makeHooks();

    const result = await runTurn([{ role: "user", content: "x" }], hooks, deps);

    expect(result.text).toBe("done");
    // Both tool exchanges were fed back before the model answered.
    expect(answered.filter((m) => m.role === "tool")).toHaveLength(2);
    expect(statuses.filter((s) => s.phase === "calling")).toHaveLength(2);
    expect(statuses.filter((s) => s.phase === "done")).toHaveLength(2);
  });

  it("streams a direct answer and shows no pill when no tool is called", async () => {
    const deps = makeDeps({
      decideTool: () => Promise.resolve(null),
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

  it("terminates at the step cap when the model keeps requesting tools", async () => {
    let decideCount = 0;
    let answered: WireMessage[] = [];
    const deps = makeDeps({
      decideTool: () => {
        decideCount++;
        return Promise.resolve({
          id: `c${String(decideCount)}`,
          name: "getAggregateStats",
          args: {},
        });
      },
      runTool: () => Promise.resolve(statsResult),
      streamAnswer: (messages, onDelta) => {
        answered = messages;
        onDelta("capped");
        return Promise.resolve("capped");
      },
      maxSteps: 3,
    });
    const { hooks } = makeHooks();

    const result = await runTurn([{ role: "user", content: "x" }], hooks, deps);

    expect(decideCount).toBe(3); // bounded - no runaway loop
    expect(result.text).toBe("capped"); // still answers gracefully
    // Reason-bearing: a step-limit note is injected before the final answer.
    expect(
      answered.some(
        (m) => m.role === "system" && /step/i.test(m.content ?? ""),
      ),
    ).toBe(true);
  });

  it("feeds a tool error back and continues instead of aborting", async () => {
    let answered: WireMessage[] = [];
    const deps = makeDeps({
      decideTool: scriptDecideTool([
        { id: "c1", name: "getAggregateStats", args: { bad: 1 } },
        null,
      ]),
      runTool: () => Promise.reject(new Error("unknown argument: bad")),
      streamAnswer: (messages, onDelta) => {
        answered = messages;
        onDelta("recovered");
        return Promise.resolve("recovered");
      },
    });
    const { hooks, statuses } = makeHooks();

    const result = await runTurn([{ role: "user", content: "x" }], hooks, deps);

    expect(result.text).toBe("recovered"); // did NOT abort
    // The error was fed back as the tool's result so the model can self-correct.
    const toolMsg = answered.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("unknown argument: bad");
    expect(statuses).toContainEqual({
      phase: "error",
      tool: "getAggregateStats",
      message: "unknown argument: bad",
    });
  });

  it("aborts the turn when the LLM channel itself fails", async () => {
    const deps = makeDeps({
      decideTool: () =>
        Promise.reject(new Error("OpenRouter routing call failed: 500")),
    });
    const { hooks } = makeHooks();

    await expect(
      runTurn([{ role: "user", content: "x" }], hooks, deps),
    ).rejects.toThrow(/routing call failed/);
  });
});
