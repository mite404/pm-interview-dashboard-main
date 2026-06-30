// Phase 1 calc layer (T2): pure parsing helpers for OpenRouter's wire format.
// No network here - `fetch` and the SSE stream loop live in `decideTool` /
// `streamAnswer` (commit 5). These read two untrusted shapes (a JSON response
// body, and SSE text), so the input is `unknown`/`string` and we narrow
// defensively rather than trusting the shape.

// A tool the model decided to call on the routing turn. `args` is parsed from
// the wire `arguments` JSON string; the tool's `validate` (tools.ts) narrows it.
export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

// ── narrowing guards (keep `unknown` honest under strict lint) ───────────
// `Array.isArray` narrows `unknown` to `any[]`, which would re-leak `any`, so
// `asArray` casts to `unknown[]` instead and indexing stays `unknown`.

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? (value as unknown[]) : undefined;
}

// ── extractToolCall: routing-turn response -> ToolCall | null ────────────
// Returns null when the model answered in prose (no tool_calls). Throws on a
// structurally-present-but-malformed call so the loop can feed the reason back.
// Single tool per turn by design: the loop runs one tool, feeds the result back,
// then re-asks - so we read the first call only.

export function extractToolCall(response: unknown): ToolCall | null {
  const choices = asArray(asRecord(response)?.choices);
  const message = asRecord(asRecord(choices?.[0])?.message);
  // ponytail: first call only. `parallel_tool_calls: false` on the decideTool
  // request (commit 5) guarantees there is just one; if that guard is ever
  // removed (parallel calls ship on by default), loop over message.tool_calls
  // here instead of dropping the rest.
  const firstCall = asRecord(asArray(message?.tool_calls)?.[0]);
  if (!firstCall) return null;

  const fn = asRecord(firstCall.function);
  const id = firstCall.id;
  const name = fn?.name;
  const rawArgs = fn?.arguments;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof rawArgs !== "string"
  ) {
    throw new Error("OpenRouter: malformed tool_call in response");
  }

  try {
    return { id, name, args: JSON.parse(rawArgs) as unknown };
  } catch {
    throw new Error(
      `OpenRouter: tool_call arguments were not valid JSON: ${rawArgs}`,
    );
  }
}

// ── extractTextDeltas: the streamed answer -> its words, in order ────────
// The reply streams in as SSE. A real
// line looks like `data: {...json...}` and carries the next bit of text, which
// we collect in order.
//
// Three kinds of line are skipped on purpose:
//   - keep-alive / blank lines the server sends just to hold the connection open
//   - the `[DONE]` line, which only marks the end of the stream
//   - the opening chunk that names the speaker ("assistant") but has no words yet
//
// A line that won't JSON-parse is almost always half a line, split across two
// network packets. We skip it here; gluing the halves back together is the
// streaming caller's job (streamAnswer, commit 5), which remembers the previous
// packet - state this pure function deliberately avoids.

export function extractTextDeltas(sse: string): string[] {
  const deltas: string[] = [];
  for (const line of sse.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice("data:".length).trim();
    if (payload === "[DONE]") continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }

    const choices = asArray(asRecord(parsed)?.choices);
    const content = asRecord(asRecord(choices?.[0])?.delta)?.content;
    if (typeof content === "string" && content.length > 0) {
      deltas.push(content);
    }
  }
  return deltas;
}
