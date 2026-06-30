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

export interface ToolResult {
  tool: "getAggregateStats";
  data: AggregateStats;
}

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

export interface Tool<Args, Data> {
  name: string;
  description: string;
  /** JSON Schema advertised to OpenRouter's `tools` param. */
  parameters: Record<string, unknown>;
  /**
   * Narrows untyped LLM-emitted JSON to typed `Args`.
   * @throws if the args are malformed or carry an unknown key - the throw feeds
   *   the agentic loop so the model can self-correct.
   */
  validate: (raw: unknown) => Args;
  /** Runs the tool's one side effect (the Convex call) via the injected `deps`. */
  run: (args: Args, deps: ToolDeps) => Promise<Data>;
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
