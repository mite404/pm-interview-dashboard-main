// The tool registry: each entry bundles the LLM-facing metadata with an
// `execute` closure (validate -> run -> wrap into the discriminated ToolResult).
// Per tool, built leaf to root: the pure `validate` (the graded LLM->Convex
// boundary, unit-tested) and any transform, then the Convex `run`, then the
// assembled RegisteredTool. Actions are dependency-injected, so the calcs stay
// network-free and deterministic to test.

import { api } from "../../convex/_generated/api";
import type { OpenRouterTool } from "./openrouter";
import type {
  AggregateStats,
  AggregateStatsArgs,
  AggregateTokenUsage,
  AggregateTokenUsageArgs,
  RegisteredTool,
  StatusBar,
  ToolDeps,
  ToolResult,
} from "./types";

// ── shared validate helpers (the registry-wide boundary convention) ──────
// Untyped LLM JSON in -> typed args out, or a descriptive throw. Strict on the
// types of known keys; throws on ANY unknown key, naming it so the loop can feed
// the reason back and the model can self-correct.

function asArgsRecord(raw: unknown, tool: string): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${tool} args must be an object`);
  }
  return raw as Record<string, unknown>;
}

function assertKnownKeys(
  record: Record<string, unknown>,
  known: string[],
  tool: string,
): void {
  for (const key of Object.keys(record)) {
    if (!known.includes(key)) {
      throw new Error(`${tool}: unknown argument: ${key}`);
    }
  }
}

function optionalNumber(
  value: unknown,
  name: string,
  tool: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${tool}: \`${name}\` must be a number`);
  }
  return value;
}

function optionalString(
  value: unknown,
  name: string,
  tool: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${tool}: \`${name}\` must be a string`);
  }
  return value;
}

// ── getAggregateStats: overall agent-run health (the Phase 1 tool) ───────

export function validateAggregateStats(raw: unknown): AggregateStatsArgs {
  const record = asArgsRecord(raw, "getAggregateStats");
  assertKnownKeys(record, ["after", "groupFolder"], "getAggregateStats");
  const args: AggregateStatsArgs = {};
  const after = optionalNumber(record.after, "after", "getAggregateStats");
  if (after !== undefined) args.after = after;
  const groupFolder = optionalString(
    record.groupFolder,
    "groupFolder",
    "getAggregateStats",
  );
  if (groupFolder !== undefined) args.groupFolder = groupFolder;
  return args;
}

/**
 * Derives the three status bars the chart renders. The status enum is
 * {pending, running, succeeded, failed}, so active + succeeded + failed = total;
 * failed is derived as finishedCount - succeeded. The three bars sum to total.
 */
export function toStatusBars(stats: AggregateStats): StatusBar[] {
  return [
    { status: "succeeded", count: stats.succeeded },
    { status: "active", count: stats.active },
    { status: "failed", count: stats.finishedCount - stats.succeeded },
  ];
}

function runAggregateStats(
  args: AggregateStatsArgs,
  deps: ToolDeps,
): Promise<AggregateStats> {
  return deps.convex.query(api.invocations.getAggregateStats, args);
}

export const getAggregateStatsTool: RegisteredTool = {
  name: "getAggregateStats",
  description:
    "Overall health of agent runs, all-time: total invocations, how many " +
    "succeeded, how many are still active (pending/running), how many finished, " +
    "and average run duration in ms. Use for questions like 'how are our agent " +
    "runs doing?'.",
  parameters: {
    type: "object",
    properties: {
      after: {
        type: "number",
        description:
          "Optional unix-ms lower bound on a run's creation time. Omit for " +
          "all-time, which is the usual case.",
      },
      groupFolder: {
        type: "string",
        description: "Optional group folder to scope to. Omit for all groups.",
      },
    },
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runAggregateStats(validateAggregateStats(rawArgs), deps).then((data) => ({
      tool: "getAggregateStats",
      data,
    })),
};

// ── getAggregateTokenUsage: LLM token spend (an ACTION, not a query) ─────

export function validateTokenUsage(raw: unknown): AggregateTokenUsageArgs {
  const record = asArgsRecord(raw, "getAggregateTokenUsage");
  assertKnownKeys(record, ["after", "groupFolder"], "getAggregateTokenUsage");
  const after = optionalNumber(record.after, "after", "getAggregateTokenUsage");
  const groupFolder = optionalString(
    record.groupFolder,
    "groupFolder",
    "getAggregateTokenUsage",
  );
  // `after` is required by the Convex action; default to 0 (all-time) when the
  // model omits it, so "token usage" with no window returns the full picture.
  const args: AggregateTokenUsageArgs = { after: after ?? 0 };
  if (groupFolder !== undefined) args.groupFolder = groupFolder;
  return args;
}

function runTokenUsage(
  args: AggregateTokenUsageArgs,
  deps: ToolDeps,
): Promise<AggregateTokenUsage> {
  // `.action()`, not `.query()` - getAggregateTokenUsage pages internally.
  return deps.convex.action(api.invocationEvents.getAggregateTokenUsage, args);
}

export const getAggregateTokenUsageTool: RegisteredTool = {
  name: "getAggregateTokenUsage",
  description:
    "Total LLM token usage across all agent activity: input, output, and " +
    "cache-read tokens. Use for 'token usage', 'how many tokens', or cost " +
    "questions. Pass `after` as a unix-ms lower bound for a window, or omit " +
    "for all-time.",
  parameters: {
    type: "object",
    properties: {
      after: {
        type: "number",
        description:
          "Optional unix-ms lower bound on when the usage was recorded. Omit " +
          "for all-time.",
      },
      groupFolder: {
        type: "string",
        description: "Optional group folder to scope to. Omit for all groups.",
      },
    },
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runTokenUsage(validateTokenUsage(rawArgs), deps).then((data) => ({
      tool: "getAggregateTokenUsage",
      data,
    })),
};

// ── registry wiring (the two facets the shell hands the loop) ────────────
// One array drives both advertising (toOpenRouterTools) and dispatch
// (makeRunTool). Adding a tool = define it + add it here.

export const registry: RegisteredTool[] = [
  getAggregateStatsTool,
  getAggregateTokenUsageTool,
];

// Advertise the registry to the model (the `tools` param for decideTool).
export function toOpenRouterTools(tools: RegisteredTool[]): OpenRouterTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// Execute a tool by the name the LLM called. An unknown name rejects (a
// hallucinated tool), which the loop surfaces gracefully.
export function makeRunTool(
  tools: RegisteredTool[],
  deps: ToolDeps,
): (name: string, rawArgs: unknown) => Promise<ToolResult> {
  return (name, rawArgs) => {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) return Promise.reject(new Error(`unknown tool: ${name}`));
    return tool.execute(rawArgs, deps);
  };
}
