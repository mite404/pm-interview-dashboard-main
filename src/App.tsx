// Phase 1 UI (T4): the shell that wires the steel thread together - input ->
// runTurn (the loop) -> streamed text + tool-status pill + a rendered chart.
// This is the composition root: it builds the loop's real dependencies (the LLM
// calls + the registry wired to the live Convex client) and owns the two UI
// stores - the on-screen ChatMessage list and, per turn, the OpenRouter wire
// array it feeds the loop.

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { convex } from "./lib/convexClient";
import { runTurn } from "./lib/loop";
import type { LoopDeps } from "./lib/loop";
import { decideTool, streamAnswer } from "./lib/openrouter";
import type { WireMessage } from "./lib/openrouter";
import { buildSystemPrompt } from "./lib/prompt";
import { toAgentRunRows } from "./lib/agentRuns";
import { toTaskRows } from "./lib/taskDefs";
import { toTokenUsageSegments } from "./lib/tokenUsage";
import {
  makeRunTool,
  registry,
  toOpenRouterTools,
  toStatusBars,
} from "./lib/tools";
import type { ChatMessage, ToolResult, ToolStatus } from "./lib/types";
import { AgentRunsTable } from "./components/AgentRunsTable";
import { TaskDefsTable } from "./components/TaskDefsTable";
import {
  fixtureContact,
  fixtureDateLabel,
  fixtureMessages,
} from "./lib/transcriptFixture";
import { CostBreakdown } from "./components/CostBreakdown";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Markdown } from "./components/Markdown";
import { TokenUsageCard } from "./components/TokenUsageCard";
import { SidebarNav } from "./components/SidebarNav";
import type { NavId } from "./components/SidebarNav";
import { StatusBreakdownChart } from "./components/StatusBreakdownChart";
import { TaskControl } from "./components/TaskControl";
import { DirectMessageComposer } from "./components/DirectMessageComposer";
import { Transcript } from "./components/Transcript";

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
  // Discriminate on the tool, then transform the raw result into the props each
  // pure component wants (the transform runs in the shell, never in the chart).
  // The switch is exhaustive over the union - a new ToolResult member won't
  // compile until it's handled here. Mutations (pause/resume) carry their meaning
  // in the assistant's prose acknowledgment, so they render nothing inline.
  switch (result.tool) {
    case "getAggregateStats": {
      const stats = result.data;
      return (
        <StatusBreakdownChart
          bars={toStatusBars(stats)}
          total={stats.total}
          avgDuration={stats.avgDuration}
        />
      );
    }
    case "getAggregateTokenUsage":
      // The tool defaults to all-time (after: 0), so label it honestly rather
      // than the design's "Last 30 days" (this-month is 0 on the frozen seed).
      return (
        <TokenUsageCard
          period="All-time"
          {...toTokenUsageSegments(result.data)}
        />
      );
    case "listRecent":
      return <AgentRunsTable rows={toAgentRunRows(result.data)} />;
    case "listConversations":
      // A resolver, not a visual: the model reads the name/jid list to resolve a
      // conversation, then answers in prose (or chains into listByChatJid). No
      // inline chart, so keep the exhaustive switch honest with an explicit null.
      return null;
    case "listByChatJid":
      // Synthesis renders as prose via the Markdown path, not a chart; the raw
      // transcript is a separate, explicitly-requested drill-in (PR 4). The
      // result still rides on the message as the "synthesis answer" discriminant
      // for the actions seam below.
      return null;
    case "listAll":
      return <TaskDefsTable rows={toTaskRows(result.data)} />;
    case "pause":
    case "resume":
    case "enqueue":
      return null;
    case "getReplyLineage":
      // Reply-chain context the model reads to answer in prose (and that drives
      // the transcript drill-in), so it renders nothing inline.
      return null;
    case "listCostRollups":
      return <CostBreakdown rows={result.data} />;
  }
}

function MessageView({
  message,
  onOpenTranscript,
}: {
  message: ChatMessage;
  onOpenTranscript: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div style={isUser ? userBubble : assistantBubble}>
      {isUser ? <div>{message.text}</div> : <Markdown>{message.text}</Markdown>}
      {message.toolResult && (
        <ErrorBoundary
          fallback={
            <div style={fallbackStyle}>Couldn&apos;t render this result.</div>
          }
        >
          <ToolResultChart result={message.toolResult} />
        </ErrorBoundary>
      )}
      {!isUser && message.toolResult?.tool === "listByChatJid" && (
        <div style={actionsSlotStyle} data-testid="synthesis-actions">
          {/* PR 4 drill-in: this is a synthesis answer (its toolResult is a
              listByChatJid window). The button opens the transcript modal.
              STUB: it opens the fixture transcript for now; wire it to read
              message.toolResult.data once the shapes are joined. */}
          <button
            type="button"
            style={drillInButton}
            onClick={onOpenTranscript}
          >
            View full transcript ›
          </button>
        </div>
      )}
    </div>
  );
}

// ── Task Control panel (design 07) ───────────────────────────────────────
// The optimistic-mutation showcase, wired to the LIVE deployment: it resolves
// one real task on mount (so the id is genuine, not the chat flow's stub) and
// hands `TaskControl` real pause/resume mutations. Run Now is inert here (no
// run-now backend on the preview), matching the enqueue "judgment showcase, not
// a live send" stance. Self-contained so the chat shell below stays untouched.
interface DemoTask {
  id: Id<"intelligenceTaskDefs">;
  name: string;
  schedule: string;
  status: "active" | "paused";
}

function TaskControlPanel() {
  const [task, setTask] = useState<DemoTask | null>(null);

  useEffect(() => {
    void convex
      .query(api.intelligenceTaskDefs.listAll, {})
      .then((tasks) => {
        // Pick the first task that can actually toggle (skip cancelled ones).
        const live = tasks.find((t) => t.status !== "cancelled");
        if (live) {
          setTask({
            id: live._id,
            name: live.name,
            schedule: `intelligenceTaskDefs · ${live.cronExpression}`,
            status: live.status === "paused" ? "paused" : "active",
          });
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load a task for Task Control:", error);
      });
  }, []);

  if (!task) return null;

  return (
    <TaskControl
      task={{ name: task.name, schedule: task.schedule }}
      status={task.status}
      onToggle={(next) =>
        convex.mutation(
          next === "paused"
            ? api.intelligenceTaskDefs.pause
            : api.intelligenceTaskDefs.resume,
          { taskDefId: task.id },
        )
      }
      onRunNow={() => {
        // Inert on the preview - no run-now backend wired.
        console.log(`[task-control] Run Now (inert) for ${task.name}`);
      }}
    />
  );
}

// ── the shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>("groups");

  // In-scope nav items set the active route and seed a starter question into
  // the composer (they never auto-send - the admin edits/sends). Out-of-scope
  // items never call this: they are inert in the sidebar.
  function handleNavSelect(id: NavId, seed: string) {
    setActiveNav(id);
    setInput(seed);
  }

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
    <div style={appShell}>
      <SidebarNav active={activeNav} onSelect={handleNavSelect} />
      <div style={pageStyle}>
        <h1 style={{ fontSize: 20 }}>PlanMonster Admin</h1>
        <div style={listStyle}>
          {messages.map((message) => (
            <MessageView
              key={message.id}
              message={message}
              onOpenTranscript={() => {
                setTranscriptOpen(true);
              }}
            />
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
        <TaskControlPanel />
        <DirectMessageComposer />
        <Transcript
          open={transcriptOpen}
          onOpenChange={setTranscriptOpen}
          contact={fixtureContact}
          messages={fixtureMessages}
          dateLabel={fixtureDateLabel}
          messageCount={214} // Maya's lifetime total (design); the fixture shows a recent slice
        />
      </div>
    </div>
  );
}

// ── minimal plain styling (shadcn is Phase 2) ────────────────────────────
// The app shell: the sidebar nav beside the chat column. The sidebar owns its
// own width; the chat column flexes to fill the rest.
const appShell: CSSProperties = {
  display: "flex",
  height: "100vh",
  boxSizing: "border-box",
};
const pageStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  flex: 1,
  maxWidth: 760,
  margin: "0 auto",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  height: "100%",
  minWidth: 0,
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
// The synthesis-answer actions slot (SEAM for PR 4), now holding the drill-in.
const actionsSlotStyle: CSSProperties = { display: "flex", gap: 8 };
const drillInButton: CSSProperties = {
  alignSelf: "flex-start",
  background: "transparent",
  border: "none",
  padding: 0,
  color: "#f26212",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const formStyle: CSSProperties = { display: "flex", gap: 8 };
const inputStyle: CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d4d4d8",
};
