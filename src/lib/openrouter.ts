// OpenRouter integration for the steel thread, ordered data -> calc -> action:
// the wire types and pure parsers first, the two network calls at the bottom.
// The parsers read untrusted shapes (a JSON response body, SSE text), so inputs
// are `unknown`/`string` and we narrow defensively. The loop (commit 6) injects
// `decideTool` / `streamAnswer`, so those stay swappable for fakes and carry no
// unit test (mocking `fetch` would assert the mock); the pure parsers are.

// A tool the model decided to call on the routing turn. `args` is parsed from
// the wire `arguments` JSON string; the tool's `validate` (tools.ts) narrows it.
export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

// One message in the array sent to OpenRouter - the LLM-facing conversation,
// owned here and kept distinct from the UI-facing ChatMessage (types.ts). The
// loop (commit 6) builds these: a tool decision is an assistant message with
// `tool_calls`; a tool result is a `role: "tool"` message whose `tool_call_id`
// matches the call it answers.
export interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
}

// A tool advertised to the model on the routing turn. `name` is the bare fn
// name (no Convex path - dots are illegal in OpenRouter function names) and
// `parameters` is the JSON Schema the model fills. Built from the registry.
export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
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
/**
 * Parses a routing-turn response into the single tool the model chose.
 *
 * Single tool per turn by design: the loop runs one tool, feeds the result
 * back, then re-asks, so only the first `tool_calls` entry is read.
 *
 * @param response - raw OpenRouter chat-completion JSON; shape is untrusted
 * @returns the chosen {@link ToolCall}, or `null` if the model answered in prose
 * @throws if a `tool_call` is present but malformed (missing id/name, or
 *   `arguments` that aren't valid JSON) - so the loop can feed the reason back
 */
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
/**
 * Pulls the text fragments out of a streamed answer, in order.
 *
 * The reply streams in as SSE: each real line looks like `data: {...json...}`
 * and carries the next bit of text. Three kinds of line are skipped on purpose
 * - keep-alive / blank lines (which just hold the connection open), the
 * `[DONE]` end-of-stream marker, and the opening chunk that names the speaker
 * but has no words yet. A line that won't JSON-parse is almost always half a
 * line split across two network packets; gluing the halves back together is the
 * streaming caller's job (streamAnswer, commit 5), so this pure function skips it.
 *
 * @param sse - one or more raw SSE lines from the answer stream
 * @returns the text fragments to append, in arrival order (empty if none)
 */
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

// ── drainSSEBuffer: reassemble SSE lines split across network reads ──────
/**
 * The stateful glue {@link extractTextDeltas} punts on, kept pure by threading
 * the leftover through the caller. A network read can end mid-line, splitting a
 * `data:` payload across two chunks. Given the leftover from the previous read
 * plus a new chunk, this emits the deltas for every now-complete line and
 * returns the still-incomplete trailing line as `rest`, to prepend next time.
 *
 * @param buffer - incomplete trailing text carried from the previous read
 * @param chunk - the newly-arrived text
 * @returns `deltas` for the completed lines and `rest`, the new leftover
 */
export function drainSSEBuffer(
  buffer: string,
  chunk: string,
): { deltas: string[]; rest: string } {
  const combined = buffer + chunk;
  const lastNewline = combined.lastIndexOf("\n");
  if (lastNewline === -1) return { deltas: [], rest: combined };
  return {
    deltas: extractTextDeltas(combined.slice(0, lastNewline)),
    rest: combined.slice(lastNewline + 1),
  };
}

// ── network actions (T3): the two OpenRouter calls ───────────────────────

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Overridable via VITE_OPENROUTER_MODEL (set in .env.local); defaults to a fast,
// cheap, tool-capable Claude. Any OpenRouter tool-calling model works - bump to
// `anthropic/claude-sonnet-4.5` for more capability. Use a currently-routable
// slug: retired ones (e.g. `claude-3.5-sonnet`) 404 with "No endpoints found".
const MODEL =
  import.meta.env.VITE_OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
  };
}

/**
 * Routing turn: asks the model to pick a tool for the conversation so far.
 * Non-streamed - the decision has no prose to show. `parallel_tool_calls: false`
 * keeps it to at most one call (the guard behind {@link extractToolCall}).
 *
 * @param messages - the LLM-facing conversation so far
 * @param tools - the tools advertised to the model
 * @returns the chosen tool call, or null if the model wants to answer directly
 * @throws if the OpenRouter call fails - an unreachable LLM aborts the turn
 */
export async function decideTool(
  messages: WireMessage[],
  tools: OpenRouterTool[],
): Promise<ToolCall | null> {
  console.log(
    `[llm] routing turn · model ${MODEL} · ${String(tools.length)} tool(s) offered`,
  );
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `OpenRouter routing call failed: ${String(res.status)} ${await res.text()}`,
    );
  }
  const json: unknown = await res.json();
  return extractToolCall(json);
}

/**
 * Answer turn: streams the model's prose reply, calling `onDelta` with each
 * fragment as it arrives and returning the full text at the end. Uses
 * {@link drainSSEBuffer} to reassemble lines split across network reads.
 *
 * @param messages - the conversation (including any tool result to synthesize)
 * @param onDelta - called with each text fragment, in order, for live rendering
 * @returns the complete answer text
 * @throws if the OpenRouter call fails or returns no stream body
 */
export async function streamAnswer(
  messages: WireMessage[],
  onDelta: (text: string) => void,
): Promise<string> {
  console.log(`[llm] answer turn (streaming) · model ${MODEL}`);
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model: MODEL, messages, stream: true }),
  });
  if (!res.ok) {
    throw new Error(
      `OpenRouter answer call failed: ${String(res.status)} ${await res.text()}`,
    );
  }
  if (!res.body) throw new Error("OpenRouter answer stream had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const { deltas, rest } = drainSSEBuffer(
      buffer,
      decoder.decode(value, { stream: true }),
    );
    buffer = rest;
    for (const delta of deltas) {
      full += delta;
      onDelta(delta);
    }
  }

  // Stream ended. Flush any bytes the decoder still holds, then treat the
  // leftover as a complete final line - nothing more is coming to finish it.
  // Guards a provider that omits the trailing newline on the last content line,
  // or splits a multi-byte char across the final two reads (data loss otherwise).
  const tail = buffer + decoder.decode();
  for (const delta of extractTextDeltas(tail)) {
    full += delta;
    onDelta(delta);
  }
  return full;
}
