// Phase 1 action tier (T3): the conversational orchestrator. It ties the injected
// pieces together(decide a tool, run it, feed the result back,
// stream the synthesized answer) and owns none of
// them: every dependency arrives as a parameter, so the loop is exercised in
// isolation with fakes (loop.test.ts) and wired to the real services in the
// shell (App.tsx, commit 8).
//
// Built as a bounded while loop that runs only tool calls, then a terminal
// streamAnswer. Phase 1 caps it at one iteration (maxSteps = 1: decide -> run
// -> answer); Phase 2 is purely additive - raise the cap and the same loop
// chains multiple tools. Error ownership is split: a *tool* error is surfaced
// here (graceful message, no crash); an *LLM-channel* error (unreachable
// OpenRouter) propagates to the shell's top-level try/catch.
//
// The single change that *would* be required to render two
// charts from one turn is accumulating a `ToolResult[]` instead of one value -
// but that feature is not scoped, so pre-building the array now would be
// speculative complexity. We keep the single reassignment (YAGNI).

import type { OpenRouterTool, ToolCall, WireMessage } from "./openrouter";
import type { ToolResult, ToolStatus } from "./types";

// Everything the loop needs, injected so fakes can stand in for whole
// subsystems in tests. `runTool` and `tools` are the two facets of the registry
// the shell derives from it (execute a named tool; advertise the tools).
export interface LoopDeps {
  decideTool: (
    messages: WireMessage[],
    tools: OpenRouterTool[],
  ) => Promise<ToolCall | null>;
  runTool: (name: string, rawArgs: unknown) => Promise<ToolResult>;
  streamAnswer: (
    messages: WireMessage[],
    onDelta: (text: string) => void,
  ) => Promise<string>;
  tools: OpenRouterTool[];
  maxSteps?: number; // Phase 1 default 1; Phase 2 raises it
}

// Per-turn UI hooks: live streamed fragments and tool-status pill transitions.
export interface TurnHooks {
  onDelta: (text: string) => void;
  onToolStatus: (status: ToolStatus) => void;
}

export interface TurnResult {
  text: string;
  toolResult?: ToolResult; // present when a tool ran -> the shell renders a chart
}

// ── wire-message builders (pure) ─────────────────────────────────────────
// Record the tool exchange in OpenRouter's shape so the model can synthesize
// from it: an assistant message carrying the call, then a matching tool result.

function assistantToolCallMessage(call: ToolCall): WireMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.args) },
      },
    ],
  };
}

function toolResultMessage(callId: string, result: ToolResult): WireMessage {
  return {
    role: "tool",
    content: JSON.stringify(result.data),
    tool_call_id: callId,
  };
}

// ── runTurn: orchestrate one conversational turn ─────────────────────────

export async function runTurn(
  messages: WireMessage[],
  hooks: TurnHooks,
  deps: LoopDeps,
): Promise<TurnResult> {
  const wire = [...messages];
  const maxSteps = deps.maxSteps ?? 1;
  let toolResult: ToolResult | undefined;

  let step = 0;
  while (step < maxSteps) {
    step++;
    const toolCall = await deps.decideTool(wire, deps.tools);
    if (!toolCall) break; // the model wants to answer directly

    hooks.onToolStatus({ phase: "calling", tool: toolCall.name });
    try {
      toolResult = await deps.runTool(toolCall.name, toolCall.args);
    } catch (error) {
      // Phase 1: surface the reason and stop. Phase 2 feeds it back as the
      // tool result so the model can self-correct, then continues the loop.
      const message = error instanceof Error ? error.message : String(error);
      hooks.onToolStatus({ phase: "error", tool: toolCall.name, message });
      return { text: `I hit an error running ${toolCall.name}: ${message}` };
    }
    hooks.onToolStatus({ phase: "done", tool: toolCall.name });

    wire.push(assistantToolCallMessage(toolCall));
    wire.push(toolResultMessage(toolCall.id, toolResult));
  }

  const text = await deps.streamAnswer(wire, hooks.onDelta);
  return { text, toolResult };
}
