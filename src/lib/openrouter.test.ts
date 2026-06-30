import { describe, expect, it } from "vitest";
import { extractTextDeltas, extractToolCall } from "./openrouter";

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
              name: "invocations.getAggregateStats",
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
      name: "invocations.getAggregateStats",
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
