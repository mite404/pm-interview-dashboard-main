// Phase 1 UI (T4): the shell that wires the steel thread together - input ->
// runTurn (the loop) -> streamed text + tool-status pill + a rendered chart.
// This is the composition root: it builds the loop's real dependencies (the LLM
// calls + the registry wired to the live Convex client) and owns the two UI
// stores - the on-screen ChatMessage list and, per turn, the OpenRouter wire
// array it feeds the loop.

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { convex } from "./lib/convexClient";
import { runTurn } from "./lib/loop";
import type { LoopDeps } from "./lib/loop";
import { decideTool, streamAnswer } from "./lib/openrouter";
import type { WireMessage } from "./lib/openrouter";
import { buildSystemPrompt } from "./lib/prompt";
import {
  makeRunTool,
  registry,
  toOpenRouterTools,
  toStatusBars,
} from "./lib/tools";
import type { ChatMessage, ToolResult, ToolStatus } from "./lib/types";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StatusBreakdownChart } from "./components/StatusBreakdownChart";

// ── config + injected dependencies ───────────────────────────────────────
// Built once: the loop's real services, wired to the live Convex client. Only
// tests swap these for fakes (loop.test.ts).
const baseRunTool = makeRunTool(registry, { convex });

// Decorate the injected runTool with console logging so each tool call and its
// result are visible in devtools. Because runTool is a dependency, this wraps it
// at the composition root without touching the loop or tools.ts - and it logs
// every tool by name, so it covers getAggregateStats now and future tools free.
const runTool: LoopDeps["runTool"] = async (name, rawArgs) => {
  console.log(`[tool] ${name} called with`, rawArgs);
  const result = await baseRunTool(name, rawArgs);
  console.log(`[tool] ${name} returned`, result.data);
  return result;
};

const deps: LoopDeps = {
  decideTool,
  streamAnswer,
  runTool,
  tools: toOpenRouterTools(registry),
};

// ── pure helpers ─────────────────────────────────────────────────────────
function toWireMessage(message: ChatMessage): WireMessage {
  return { role: message.role, content: message.text };
}

function newId(): string {
  return crypto.randomUUID();
}

function toolPillLabel(status: ToolStatus): string {
  if (status.phase === "calling") return `Running ${status.tool}…`;
  if (status.phase === "done") return `${status.tool} finished`;
  return `${status.tool} failed: ${status.message}`;
}

// ── presentational sub-components ─────────────────────────────────────────
// The render boundary: transform the raw tool result into chart-ready bars in
// the shell (never inside the pure chart). Phase 1 has one ToolResult shape, so
// we render it directly; when Phase 2 adds tools, `result.data` becomes a union
// and the compiler forces a discriminant switch here.
function ToolResultChart({ result }: { result: ToolResult }) {
  const stats = result.data;
  return (
    <StatusBreakdownChart
      bars={toStatusBars(stats)}
      total={stats.total}
      avgDuration={stats.avgDuration}
    />
  );
}

function MessageView({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div style={isUser ? userBubble : assistantBubble}>
      <div>{message.text}</div>
      {message.toolResult && (
        <ErrorBoundary
          fallback={
            <div style={fallbackStyle}>Couldn&apos;t render this result.</div>
          }
        >
          <ToolResultChart result={message.toolResult} />
        </ErrorBoundary>
      )}
    </div>
  );
}

// ── the shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setBusy(true);
    setStreamText("");
    setToolStatus(null);

    // The wire array (system + prose history) is rebuilt each turn and kept
    // distinct from the on-screen list; the loop appends the tool exchange to
    // its own copy internally.
    const wire: WireMessage[] = [
      { role: "system", content: buildSystemPrompt({ now: new Date() }) },
      ...history.map(toWireMessage),
    ];

    try {
      let streamed = "";
      const result = await runTurn(
        wire,
        {
          onDelta: (delta) => {
            streamed += delta;
            setStreamText(streamed);
          },
          onToolStatus: (status) => {
            if (status.phase === "error") {
              console.error(`[tool ${status.tool}]`, status.message);
            }
            setToolStatus(status);
          },
        },
        deps,
      );
      setMessages([
        ...history,
        {
          id: newId(),
          role: "assistant",
          text: result.text,
          toolResult: result.toolResult,
        },
      ]);
    } catch (error) {
      // An unreachable LLM aborts the turn; surface it, never crash. Log the
      // full error to the console so it is debuggable from browser devtools.
      console.error("Assistant turn failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      setMessages([
        ...history,
        {
          id: newId(),
          role: "assistant",
          text: `Sorry - I couldn't reach the assistant: ${message}`,
        },
      ]);
    } finally {
      setBusy(false);
      setStreamText("");
      setToolStatus(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 20 }}>PlanMonster Admin</h1>
      <div style={listStyle}>
        {messages.map((message) => (
          <MessageView key={message.id} message={message} />
        ))}
        {busy && (
          <div style={assistantBubble}>
            {toolStatus && (
              <span style={pillStyle}>{toolPillLabel(toolStatus)}</span>
            )}
            <div>{streamText || "…"}</div>
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} style={formStyle}>
        <input
          style={inputStyle}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
          }}
          placeholder="Ask about agent runs…"
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </div>
  );
}

// ── minimal plain styling (shadcn is Phase 2) ────────────────────────────
const pageStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 760,
  margin: "0 auto",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  height: "100vh",
  boxSizing: "border-box",
};
const listStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const userBubble: CSSProperties = {
  alignSelf: "flex-end",
  background: "#e8f0fe",
  borderRadius: 8,
  padding: "8px 12px",
  maxWidth: "80%",
};
const assistantBubble: CSSProperties = {
  alignSelf: "flex-start",
  background: "#f4f4f5",
  borderRadius: 8,
  padding: "8px 12px",
  maxWidth: "100%",
  width: "100%",
};
const pillStyle: CSSProperties = {
  display: "inline-block",
  fontSize: 12,
  color: "#3730a3",
  background: "#e0e7ff",
  borderRadius: 999,
  padding: "2px 8px",
  marginBottom: 6,
};
const fallbackStyle: CSSProperties = { color: "#b91c1c", fontSize: 13 };
const formStyle: CSSProperties = { display: "flex", gap: 8 };
const inputStyle: CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d4d4d8",
};
