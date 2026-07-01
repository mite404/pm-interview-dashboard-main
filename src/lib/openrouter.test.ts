import { describe, expect, it } from "vitest";
import {
  drainSSEBuffer,
  extractTextDeltas,
  extractToolCall,
} from "./openrouter";

// A routing-turn response: the model chose a tool instead of answering.
const toolCallResponse = {
  choices: [
    {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "getAggregateStats",
              arguments: '{"after":1000}',
            },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
};

// A routing-turn response where the model answered in prose (no tool).
const proseResponse = {
  choices: [{ message: { role: "assistant", content: "hi there" } }],
};

describe("extractToolCall", () => {
  it("extracts the first tool call with its arguments parsed to an object", () => {
    expect(extractToolCall(toolCallResponse)).toEqual({
      id: "call_1",
      name: "getAggregateStats",
      args: { after: 1000 },
    });
  });

  it("returns null when the model answered with prose (no tool_calls)", () => {
    expect(extractToolCall(proseResponse)).toBeNull();
  });

  it("throws when the tool-call arguments are not valid JSON", () => {
    const bad = {
      choices: [
        {
          message: {
            tool_calls: [
              { id: "c", function: { name: "x", arguments: "{not json" } },
            ],
          },
        },
      ],
    };
    expect(() => extractToolCall(bad)).toThrow();
  });
});

describe("extractTextDeltas", () => {
  it("pulls content deltas in order from the SSE data lines", () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Agent"}}]}',
      'data: {"choices":[{"delta":{"content":" runs"}}]}',
    ].join("\n\n");
    expect(extractTextDeltas(sse)).toEqual(["Agent", " runs"]);
  });

  it("ignores [DONE], comment keep-alives, and contentless deltas", () => {
    const sse = [
      ": OPENROUTER PROCESSING",
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}',
      'data: {"choices":[{"delta":{"content":"ok"}}]}',
      "data: [DONE]",
    ].join("\n\n");
    expect(extractTextDeltas(sse)).toEqual(["ok"]);
  });
});

describe("drainSSEBuffer", () => {
  it("emits a delta once its line is complete and leaves no leftover", () => {
    expect(
      drainSSEBuffer("", 'data: {"choices":[{"delta":{"content":"hi"}}]}\n'),
    ).toEqual({ deltas: ["hi"], rest: "" });
  });

  it("holds a line split across two chunks until the rest arrives", () => {
    // First read ends mid-JSON, before any newline: nothing is emitted yet.
    const first = drainSSEBuffer(
      "",
      'data: {"choices":[{"delta":{"content":"hel',
    );
    expect(first.deltas).toEqual([]);

    // The carried-over leftover + the rest of the line now completes it.
    expect(drainSSEBuffer(first.rest, 'lo"}}]}\n')).toEqual({
      deltas: ["hello"],
      rest: "",
    });
  });
});
