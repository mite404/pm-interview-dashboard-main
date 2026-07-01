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
  Conversation,
  GroupsList,
  InvocationStatus,
  InvocationsList,
  ListConversationsArgs,
  ListRecentToolArgs,
  RegisteredTool,
  StatusBar,
  ToolDeps,
  ToolResult,
} from "./types";

// The backend run-status enum, single-sourced for `validate` to check the
// LLM-supplied filter against. Kept in step with the schema's `v.union(...)`.
const INVOCATION_STATUSES: InvocationStatus[] = [
  "pending",
  "running",
  "succeeded",
  "failed",
];

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

// ── listRecent: recent agent runs, optionally filtered to one status ─────
// The only tool with an LLM-facing arg the backend doesn't take: `status`.
// `listRecent` has no status filter, so `validate` keeps it as a tool-level
// concern and `run` applies it to the returned array (that split is why
// "show me recent failed runs" resolves without a second Convex function).

export function validateListRecent(raw: unknown): ListRecentToolArgs {
  const record = asArgsRecord(raw, "listRecent");
  assertKnownKeys(record, ["limit", "after", "status"], "listRecent");
  const args: ListRecentToolArgs = {};
  const limit = optionalNumber(record.limit, "limit", "listRecent");
  if (limit !== undefined) args.limit = limit;
  const after = optionalNumber(record.after, "after", "listRecent");
  if (after !== undefined) args.after = after;
  const status = optionalString(record.status, "status", "listRecent");
  if (status !== undefined) {
    if (!INVOCATION_STATUSES.includes(status as InvocationStatus)) {
      throw new Error(
        `listRecent: \`status\` must be one of ${INVOCATION_STATUSES.join(", ")}`,
      );
    }
    args.status = status as InvocationStatus;
  }
  return args;
}

async function runListRecent(
  args: ListRecentToolArgs,
  deps: ToolDeps,
): Promise<InvocationsList> {
  // `status` is ours, not the backend's, so strip it before the Convex call and
  // filter the result. ponytail: the filter runs after `limit`, so a small
  // `limit` can hide older matches; fine at the seed's 39 runs (default take is
  // 50), lift to a paginated scan if a real deployment needs deep status filters.
  const { status, ...convexArgs } = args;
  const rows = await deps.convex.query(api.invocations.listRecent, convexArgs);
  return status ? rows.filter((run) => run.status === status) : rows;
}

export const listRecentTool: RegisteredTool = {
  name: "listRecent",
  description:
    "Recent agent runs (invocations), newest first, each with its status, the " +
    "admin prompt, group, and any failure error. Pass `status` to filter to " +
    "just 'failed', 'running', 'succeeded', or 'pending' - e.g. for 'show me " +
    "recent failed runs'. Use `limit` to cap how many, or omit for the default.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description:
          "Optional max number of runs to return. Omit for the default.",
      },
      after: {
        type: "number",
        description:
          "Optional unix-ms lower bound on a run's creation time. Omit for the " +
          "most recent regardless of age.",
      },
      status: {
        type: "string",
        enum: INVOCATION_STATUSES,
        description: "Optional status filter. Omit to include every status.",
      },
    },
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runListRecent(validateListRecent(rawArgs), deps).then((data) => ({
      tool: "listRecent",
      data,
    })),
};

// ── listConversations: the name/jid resolver (groups.getAll, narrowed) ───
// The one tool exposing the jid/chatJid bridge: it narrows the full group doc
// to { name, jid } so the model can resolve an admin's phrasing ("Maya") to the
// `jid` that listByChatJid consumes as `chatJid`. The companion read for the
// synthesis flow, the way listAll is the companion for the mutation.

export function validateListConversations(raw: unknown): ListConversationsArgs {
  const record = asArgsRecord(raw, "listConversations");
  // Takes no arguments; any key is a hallucination, thrown back so the model
  // drops it and retries.
  assertKnownKeys(record, [], "listConversations");
  return {};
}

/**
 * Narrows raw groups to the resolver payload the model reads: just the display
 * name and the jid, dropping folder/triggerPattern/personId/etc.
 * @param groups - the typed `groups.getAll` return (`GroupsList`)
 */
export function toConversations(groups: GroupsList): Conversation[] {
  return groups.map((group) => ({ name: group.name, jid: group.jid }));
}

async function runListConversations(
  _args: ListConversationsArgs,
  deps: ToolDeps,
): Promise<Conversation[]> {
  const groups = await deps.convex.query(api.groups.getAll, {});
  return toConversations(groups);
}

export const listConversationsTool: RegisteredTool = {
  name: "listConversations",
  description:
    "List all registered conversations (chats/channels), each with its display " +
    "`name` and its `jid`. Use this to resolve a person or conversation name " +
    "(e.g. 'Maya') to the `jid` that other tools take as `chatJid`. Takes no " +
    "arguments.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runListConversations(validateListConversations(rawArgs), deps).then(
      (data) => ({ tool: "listConversations", data }),
    ),
};

// ── registry wiring (the two facets the shell hands the loop) ────────────
// One array drives both advertising (toOpenRouterTools) and dispatch
// (makeRunTool). Adding a tool = define it + add it here.

export const registry: RegisteredTool[] = [
  getAggregateStatsTool,
  getAggregateTokenUsageTool,
  listRecentTool,
  listConversationsTool,
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
