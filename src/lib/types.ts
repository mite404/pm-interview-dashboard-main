// Phase 1 data layer (T1): the pure shapes the steel thread is built from.
//
// No runtime logic lives here, so this commit carries no test - later commits
// that add calculations or actions ship their own coverage (see docs/PLAN.md).
// Two message stores stay deliberately distinct: this file types the UI-facing
// `ChatMessage` (prose + rendered chart + status pill); the OpenRouter wire
// array (tool_calls / tool_results) is owned by `src/lib/openrouter.ts`, a
// later commit, because that shape never carries rendered artifacts.

import type { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

// ── Tool results (typed Convex returns, keyed by tool name) ──────────────
// Sourced from the typed `api` so the shape can never drift from the backend.
// A discriminated union keyed by `tool`: one member in Phase 1, extended one
// member per tool in Phase 2. `data` is both what the loop feeds back to the
// LLM and what the UI renders a chart from.

export type AggregateStats = FunctionReturnType<
  typeof api.invocations.getAggregateStats
>; // -> { total, active, succeeded, finishedCount, avgDuration }

// A discriminated union keyed by `tool` - one member per wired tool. `data` is
// both what the loop feeds back to the LLM and what the shell renders from. The
// union grows one member per tool as they are wired (dailyUniqueUsers: 14b).
export type ToolResult =
  | { tool: "getAggregateStats"; data: AggregateStats }
  | { tool: "getAggregateTokenUsage"; data: AggregateTokenUsage };

// Phase 2 tool returns, typed from the `api` so the card/chart components can
// never drift from the live backend shape.

export type AggregateTokenUsage = FunctionReturnType<
  typeof api.invocationEvents.getAggregateTokenUsage
>; // -> { inputTokens, outputTokens, totalTokens, cacheCreationInputTokens, cacheReadInputTokens }

export type DailyUniqueUsers = FunctionReturnType<
  typeof api.dashboard.dailyUniqueUsers
>; // -> { day: string /* YYYY-MM-DD */; uniqueUsers: number }[]

// The cross-layer contract between the calc (`toStatusBars` in tools.ts) and
// the pure chart (commit 7): both import it from here. The transform runs in
// the shell (App.tsx), never inside the chart, so the chart stays presentational.
export interface StatusBar {
  status: "succeeded" | "active" | "failed";
  count: number;
}

// ── Tool registry (the LLM <-> Convex boundary the brief grades) ─────────
// Dependencies are injected, never hard-imported, so each tool's `run` is
// testable in isolation with a fake client. `validate` is the trust boundary:
// untyped LLM-emitted JSON in -> typed args out, or throw.

export interface ToolDeps {
  convex: ConvexHttpClient;
}

export type AggregateStatsArgs = FunctionArgs<
  typeof api.invocations.getAggregateStats
>; // -> { after?: number; groupFolder?: string }

export type AggregateTokenUsageArgs = FunctionArgs<
  typeof api.invocationEvents.getAggregateTokenUsage
>; // -> { after: number; groupFolder?: string }

// A registry entry the loop dispatches uniformly. `execute` validates the raw
// LLM args, runs the tool, and wraps the return into the discriminated
// `ToolResult` - one closure, so a heterogeneous registry (tools with different
// arg/return shapes) stays uniformly typed. Each tool's `validate` is still a
// separate export, unit-tested as the graded LLM->Convex boundary.
export interface RegisteredTool {
  name: string;
  description: string;
  /** JSON Schema advertised to OpenRouter's `tools` param. */
  parameters: Record<string, unknown>;
  /** @throws on malformed args (fed back to the loop) or a failed Convex call. */
  execute: (rawArgs: unknown, deps: ToolDeps) => Promise<ToolResult>;
}

// ── Chat UI messages (what the admin sees) ───────────────────────────────
// Distinct from the OpenRouter wire array: this carries rendered artifacts (a
// chart via `toolResult`) and transient UI state (the status pill), neither of
// which goes on the wire.

export type ToolStatus =
  | { phase: "calling"; tool: string } // pill: tool in flight (Must #6)
  | { phase: "done"; tool: string }
  | { phase: "error"; tool: string; message: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string; // assistant prose streams into this field, token by token
  toolResult?: ToolResult; // present once a tool ran -> renders inline chart
  toolStatus?: ToolStatus; // drives the tool-call status pill
}
