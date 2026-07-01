import { describe, expect, it } from "vitest";
import type { WireMessage } from "./openrouter";
import { compactToolResults } from "./compact";

// The pairing invariant, as the API sees it: the set of ids declared by
// assistant tool_calls must equal the set of tool_call_ids answered by tool
// messages. If compaction ever drops or renames one, these diverge.
function declaredCallIds(messages: WireMessage[]): string[] {
  return messages
    .flatMap((m) => m.tool_calls ?? [])
    .map((call) => call.id)
    .sort();
}
function answeredCallIds(messages: WireMessage[]): string[] {
  return messages
    .filter((m) => m.role === "tool")
    .map((m) => m.tool_call_id ?? "")
    .sort();
}

// A two-tool-call turn with bulky results, in the shape the loop builds.
function bulky(n: number): string {
  return JSON.stringify({ rows: Array.from({ length: n }, (_, i) => i) });
}
const conversation: WireMessage[] = [
  { role: "system", content: "You are Monty." },
  { role: "user", content: "How are our agent runs doing?" },
  {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "getAggregateStats", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: bulky(500), tool_call_id: "call_1" },
  {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: "call_2",
        type: "function",
        function: { name: "getReplyLineage", arguments: "{}" },
      },
    ],
  },
  { role: "tool", content: bulky(500), tool_call_id: "call_2" },
  { role: "assistant", content: "Here is the summary." },
];

describe("compactToolResults", () => {
  it("preserves the tool_call/tool_result pairing", () => {
    const compacted = compactToolResults(conversation);
    expect(answeredCallIds(compacted)).toEqual(declaredCallIds(compacted));
    // And it still matches the original pairing (nothing added or lost).
    expect(answeredCallIds(compacted)).toEqual(["call_1", "call_2"]);
    expect(declaredCallIds(compacted)).toEqual(declaredCallIds(conversation));
  });

  it("stubs the bulky tool-result content but keeps the id and role", () => {
    const compacted = compactToolResults(conversation);
    const toolMessages = compacted.filter((m) => m.role === "tool");
    for (const message of toolMessages) {
      expect(message.content).toBe(
        "[tool result omitted to save context - already rendered]",
      );
      expect(message.tool_call_id).toMatch(/^call_/);
    }
  });

  it("leaves non-tool messages and small results untouched", () => {
    const small: WireMessage[] = [
      { role: "user", content: "hi" },
      { role: "tool", content: "42", tool_call_id: "call_9" },
    ];
    expect(compactToolResults(small)).toEqual(small);
  });

  it("does not mutate the input", () => {
    const before = JSON.stringify(conversation);
    compactToolResults(conversation);
    expect(JSON.stringify(conversation)).toBe(before);
  });

  it("respects a custom threshold", () => {
    const messages: WireMessage[] = [
      { role: "tool", content: "0123456789", tool_call_id: "c" },
    ];
    // Threshold 5: the 10-char result is now bulky and gets stubbed.
    expect(compactToolResults(messages, 5)[0].content).not.toBe("0123456789");
    // Threshold 20: it stays.
    expect(compactToolResults(messages, 20)[0].content).toBe("0123456789");
  });
});
