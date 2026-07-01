// The conversational orchestrator (T3). It ties the injected pieces together
// (decide a tool, run it, feed the result back, repeat, then stream the answer)
// and owns none of them: every dependency arrives as a parameter, so the loop is
// exercised in isolation with fakes (loop.test.ts) and wired to the real services
// in the shell (App.tsx).
//
// A bounded while loop that runs tool calls until the model stops requesting
// them or MAX_STEPS is hit, then a terminal streamAnswer. Error ownership is
// split three ways: a *tool* error (validate/run) is fed back to the model as
// that tool's result so it can self-correct, and the loop continues; hitting
// MAX_STEPS ends the loop with a reason-bearing note so the model wraps up; only
// an *LLM-channel* error (unreachable OpenRouter) propagates to the shell and
// aborts the turn.
//
// The single change that *would* be required to render two charts from one turn
// is accumulating a `ToolResult[]` instead of one value - not scoped, so we keep
// the single reassignment (the last tool's result, which is the renderable one
// in a resolver-then-action chain). YAGNI.

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
  maxSteps?: number; // default MAX_STEPS (5); tests inject a small value
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

// A tool error, fed back as that tool's result (paired by tool_call_id) so the
// model reads the reason and can self-correct on the next step.
function toolErrorMessage(callId: string, message: string): WireMessage {
  return {
    role: "tool",
    content: `Error: ${message}`,
    tool_call_id: callId,
  };
}

// ── runTurn: orchestrate one conversational turn ─────────────────────────

const MAX_STEPS = 5; // bounds per-message cost and guarantees termination

export async function runTurn(
  messages: WireMessage[],
  hooks: TurnHooks,
  deps: LoopDeps,
): Promise<TurnResult> {
  const wire = [...messages];
  const maxSteps = deps.maxSteps ?? MAX_STEPS;
  let toolResult: ToolResult | undefined;
  let answered = false; // did the model choose to stop calling tools?

  let step = 0;
  while (step < maxSteps) {
    step++;
    // An LLM-channel error here propagates and aborts the turn - only tool
    // errors are caught and fed back below.
    const toolCall = await deps.decideTool(wire, deps.tools);
    if (!toolCall) {
      answered = true;
      break;
    }

    hooks.onToolStatus({ phase: "calling", tool: toolCall.name });
    // Push the assistant tool-call message before running, so the tool message
    // that follows (success OR error) is correctly paired by tool_call_id.
    wire.push(assistantToolCallMessage(toolCall));
    try {
      toolResult = await deps.runTool(toolCall.name, toolCall.args);
      hooks.onToolStatus({ phase: "done", tool: toolCall.name });
      wire.push(toolResultMessage(toolCall.id, toolResult));
    } catch (error) {
      // Tool-layer error: feed the reason back so the model can self-correct
      // next step, and continue - do not abort the turn.
      const message = error instanceof Error ? error.message : String(error);
      hooks.onToolStatus({ phase: "error", tool: toolCall.name, message });
      wire.push(toolErrorMessage(toolCall.id, message));
    }
  }

  // Cap hit (the model still wanted tools): nudge it to wrap up gracefully.
  if (!answered) {
    wire.push({
      role: "system",
      content: `You have reached the ${String(maxSteps)}-step tool limit. Answer now using the information you already gathered; do not request more tools.`,
    });
  }

  const text = await deps.streamAnswer(wire, hooks.onDelta);
  return { text, toolResult };
}
