// Context-stubbing compactor (pure). Between turns the wire history accumulates
// tool results whose JSON payloads (chart data, row dumps) are bulky and stale -
// the UI already rendered them, and the model rarely needs the raw bytes again.
// This trims that weight before the next request WITHOUT breaking the one rule
// the API enforces: every assistant `tool_calls[].id` must still have a matching
// `role:"tool"` message carrying that `tool_call_id`. So we rewrite the bulky
// tool-result *content* to a short stub in place - never drop the message, never
// touch the id - and leave the call/result graph intact.

import type { WireMessage } from "./openrouter";

// What a stubbed tool result reads as. The model sees this instead of the raw
// payload; it signals the result existed (and was rendered) without the bytes.
const STUB = "[tool result omitted to save context - already rendered]";

// Tool results shorter than this are cheap to keep, so they pass through - only
// bulky payloads (the ones worth the round-trip savings) get stubbed.
const DEFAULT_MAX_CHARS = 200;

/**
 * Replaces bulky tool-result payloads in a wire history with a short stub,
 * preserving the tool_call/tool_result pairing the API requires.
 *
 * Pure: returns a new array and new message objects for the ones it rewrites;
 * the input is never mutated. Only `role:"tool"` messages whose `content`
 * exceeds `maxChars` are stubbed; their `tool_call_id` (and every assistant
 * `tool_calls` entry) is left exactly as-is, so no call is ever orphaned.
 *
 * @param messages - the wire history to compact
 * @param maxChars - tool results longer than this are stubbed (default 200)
 * @returns a new history with bulky tool-result content replaced by {@link STUB}
 */
export function compactToolResults(
  messages: WireMessage[],
  maxChars: number = DEFAULT_MAX_CHARS,
): WireMessage[] {
  return messages.map((message) => {
    if (
      message.role === "tool" &&
      message.content !== null &&
      message.content.length > maxChars
    ) {
      return { ...message, content: STUB };
    }
    return message;
  });
}
