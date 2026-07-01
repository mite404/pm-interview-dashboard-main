// The tool registry: each entry bundles the LLM-facing metadata with an
// `execute` closure (validate -> run -> wrap into the discriminated ToolResult).
// Per tool, built leaf to root: the pure `validate` (the graded LLM->Convex
// boundary, unit-tested) and any transform, then the Convex `run`, then the
// assembled RegisteredTool. Actions are dependency-injected, so the calcs stay
// network-free and deterministic to test.

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { runCostBreakdown, validateCostRollups } from "./cost";
import type { OpenRouterTool } from "./openrouter";
import type {
  AggregateStats,
  AggregateStatsArgs,
  AggregateTokenUsage,
  AggregateTokenUsageArgs,
  Conversation,
  EnqueueArgs,
  EnqueuedMessageId,
  GroupsList,
  InvocationStatus,
  InvocationsList,
  ListAllArgs,
  ListByChatJidArgs,
  ListConversationsArgs,
  ListRecentToolArgs,
  MessagesList,
  PauseArgs,
  RegisteredTool,
  ReplyLineage,
  ReplyLineageArgs,
  ResumeArgs,
  StatusBar,
  TaskDef,
  TaskDefsList,
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

// ── listByChatJid: the synthesis read (one conversation's messages) ──────
// The bounded window the model summarizes for "what's X been talking about".
// `validate` only guards structure (a non-empty chatJid): a wrong-but-well-
// formed jid returns [] from Convex, which feeds back so the model self-
// corrects rather than us second-guessing the id. The "chatJid comes from
// listConversations" dependency lives in the description, not the prompt.

export function validateListByChatJid(raw: unknown): ListByChatJidArgs {
  const record = asArgsRecord(raw, "listByChatJid");
  assertKnownKeys(record, ["chatJid", "limit"], "listByChatJid");
  const chatJid = optionalString(record.chatJid, "chatJid", "listByChatJid");
  if (chatJid === undefined || chatJid.trim() === "") {
    throw new Error(
      "listByChatJid: `chatJid` is required and must be non-empty (resolve it from listConversations first)",
    );
  }
  const args: ListByChatJidArgs = { chatJid };
  const limit = optionalNumber(record.limit, "limit", "listByChatJid");
  if (limit !== undefined) args.limit = limit;
  return args;
}

function runListByChatJid(
  args: ListByChatJidArgs,
  deps: ToolDeps,
): Promise<MessagesList> {
  return deps.convex.query(api.messages.listByChatJid, args);
}

export const listByChatJidTool: RegisteredTool = {
  name: "listByChatJid",
  description:
    "Recent messages for ONE conversation, oldest-first - use this to answer " +
    "'what has X been talking about', 'where did we leave off', etc. by " +
    "summarizing the window in prose. `chatJid` MUST come from " +
    "listConversations: call that first to resolve a name to its jid. A wrong " +
    "or unknown jid returns an empty list (re-check the name). Optional `limit` " +
    "bounds the window (default 100, max 200).",
  parameters: {
    type: "object",
    properties: {
      chatJid: {
        type: "string",
        description: "The conversation's jid, resolved via listConversations.",
      },
      limit: {
        type: "number",
        description: "Optional max messages to fetch (default 100, max 200).",
      },
    },
    required: ["chatJid"],
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runListByChatJid(validateListByChatJid(rawArgs), deps).then((data) => ({
      tool: "listByChatJid",
      data,
    })),
};

// ── listAll: the scheduled intelligence tasks (mutation companion read) ──
// The read half of the write flow: the model lists tasks, reads a name -> _id,
// then (in a later PR) pauses/resumes by that id. Returns the raw docs so the
// _id/name/status/cronExpression shape stays stable for the mutation to resolve
// against. Takes no arguments.

export function validateListAll(raw: unknown): ListAllArgs {
  const record = asArgsRecord(raw, "listAll");
  assertKnownKeys(record, [], "listAll");
  return {};
}

function runListAll(_args: ListAllArgs, deps: ToolDeps): Promise<TaskDefsList> {
  return deps.convex.query(api.intelligenceTaskDefs.listAll, {});
}

export const listAllTool: RegisteredTool = {
  name: "listAll",
  description:
    "List all scheduled intelligence tasks, each with its name, status " +
    "(active/paused/cancelled), schedule, and what it does. Use this to answer " +
    "'what tasks do we have?' and to resolve a task name to the id a " +
    "pause/resume would target. Takes no arguments.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runListAll(validateListAll(rawArgs), deps).then((data) => ({
      tool: "listAll",
      data,
    })),
};

// ── mutation tools (PR 3): the LLM -> Convex write boundary ──────────────
// Structural validate is safety layer 1 of 3 (see AGENTS.md / the brief): it
// only proves the args are *well-formed* (a non-empty id string) - it
// deliberately does NOT check the id exists or resolve names. Layer 2
// (confirm-on-ambiguity) lives in the system prompt; layer 3 (a named
// acknowledgment) falls out of `run` returning the patched doc, so a wrong
// target is visible in the assistant's reply immediately.

// pause and resume take the identical arg, so they share one validator. The
// cast to the branded `Id` is the trust boundary itself: runtime JSON can only
// prove it is a non-empty string; Convex verifies the id server-side and 404s
// a bad one, which the loop feeds back for self-correction.
export function validateTaskDefId(
  toolName: string,
  raw: unknown,
): { taskDefId: Id<"intelligenceTaskDefs"> } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${toolName} args must be an object`);
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "taskDefId") {
      throw new Error(`${toolName}: unknown argument: ${key}`);
    }
  }
  const { taskDefId } = record;
  if (typeof taskDefId !== "string" || taskDefId.length === 0) {
    throw new Error(`${toolName}: \`taskDefId\` must be a non-empty id string`);
  }
  return { taskDefId: taskDefId as Id<"intelligenceTaskDefs"> };
}

// The one JSON Schema both single-id mutations advertise (id-in, doc-out).
const taskDefIdParameters: Record<string, unknown> = {
  type: "object",
  properties: {
    taskDefId: {
      type: "string",
      description:
        "The id of the task to act on, resolved from `listAll` - never a task " +
        "name. Call `listAll` first if you only have the name.",
    },
  },
  required: ["taskDefId"],
  additionalProperties: false,
};

/**
 * Pauses a scheduled intelligence task. The one side effect: a Convex mutation.
 * @param args - validated args from {@link validateTaskDefId}
 * @param deps - injected dependencies (the Convex client)
 * @returns the patched task doc (carries `name` + `status` for the named ack)
 */
export function runPause(args: PauseArgs, deps: ToolDeps): Promise<TaskDef> {
  return deps.convex.mutation(api.intelligenceTaskDefs.pause, args);
}

/**
 * Resumes a paused intelligence task. The one side effect: a Convex mutation.
 * @param args - validated args from {@link validateTaskDefId}
 * @param deps - injected dependencies (the Convex client)
 * @returns the patched task doc (carries `name` + `status` for the named ack)
 */
export function runResume(args: ResumeArgs, deps: ToolDeps): Promise<TaskDef> {
  return deps.convex.mutation(api.intelligenceTaskDefs.resume, args);
}

export const pauseTool: RegisteredTool = {
  name: "pause",
  description:
    "Pause a scheduled intelligence task so it stops running on its cron. " +
    "Takes the task's id (resolve it from `listAll` first). Returns the " +
    "updated task; confirm the pause by the returned name.",
  parameters: taskDefIdParameters,
  execute: (rawArgs, deps) =>
    runPause(validateTaskDefId("pause", rawArgs), deps).then((data) => ({
      tool: "pause",
      data,
    })),
};

export const resumeTool: RegisteredTool = {
  name: "resume",
  description:
    "Resume a paused intelligence task so it runs on its cron again. Takes " +
    "the task's id (resolve it from `listAll` first). Returns the updated " +
    "task; confirm the resume by the returned name.",
  parameters: taskDefIdParameters,
  execute: (rawArgs, deps) =>
    runResume(validateTaskDefId("resume", rawArgs), deps).then((data) => ({
      tool: "resume",
      data,
    })),
};

// ── enqueue: send an admin direct message (PR 3) ─────────────────────────
// Structural validate (layer 1): a well-formed group id, a known channel, and a
// non-empty body. It does NOT resolve the group by name or check delivery - the
// group is resolved to an id upstream (like pause/resume), and delivery is inert
// on the preview (no channel creds), so this is a judgment showcase, not a live
// send. Word-count / group-existence are enforced server-side by the mutation.
const CHANNELS = ["whatsapp", "sms", "imessage"] as const;

export function validateEnqueue(raw: unknown): EnqueueArgs {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("enqueue args must be an object");
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["groupId", "selectedChannel", "messageBody"].includes(key)) {
      throw new Error(`enqueue: unknown argument: ${key}`);
    }
  }
  const { groupId, selectedChannel, messageBody } = record;
  if (typeof groupId !== "string" || groupId.length === 0) {
    throw new Error("enqueue: `groupId` must be a non-empty id string");
  }
  if (
    typeof selectedChannel !== "string" ||
    !CHANNELS.includes(selectedChannel as (typeof CHANNELS)[number])
  ) {
    throw new Error(
      `enqueue: \`selectedChannel\` must be one of ${CHANNELS.join(", ")}`,
    );
  }
  if (typeof messageBody !== "string" || messageBody.trim().length === 0) {
    throw new Error("enqueue: `messageBody` must be a non-empty string");
  }
  return {
    groupId: groupId as Id<"registeredGroups">,
    selectedChannel: selectedChannel as (typeof CHANNELS)[number],
    messageBody,
  };
}

/**
 * Enqueues an admin direct message. The one side effect: a Convex mutation.
 * @param args - validated args from {@link validateEnqueue}
 * @param deps - injected dependencies (the Convex client)
 * @returns the id of the inserted `adminDirectMessages` row
 */
export function runEnqueue(
  args: EnqueueArgs,
  deps: ToolDeps,
): Promise<EnqueuedMessageId> {
  return deps.convex.mutation(api.adminDirectMessages.enqueue, args);
}

export const enqueueTool: RegisteredTool = {
  name: "enqueue",
  description:
    "Queue an admin direct message to a group over a chosen channel " +
    "(whatsapp, sms, or imessage). Takes the group's id (resolve it first), " +
    "the channel, and the message body. Confirm the target before sending.",
  parameters: {
    type: "object",
    properties: {
      groupId: {
        type: "string",
        description: "The id of the group to message - never a group name.",
      },
      selectedChannel: {
        type: "string",
        enum: [...CHANNELS],
        description: "The delivery channel.",
      },
      messageBody: {
        type: "string",
        description: "The message text (max 250 words, enforced server-side).",
      },
    },
    required: ["groupId", "selectedChannel", "messageBody"],
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runEnqueue(validateEnqueue(rawArgs), deps).then((data) => ({
      tool: "enqueue",
      data,
    })),
};

// ── getReplyLineage: reply-chain context for synthesis (PR 4) ────────────
const REPLY_LINEAGE_ARGS = [
  "chatJid",
  "replyToMsgId",
  "maxMessages",
  "maxChars",
];

/**
 * Narrows untyped LLM-emitted JSON into typed `getReplyLineage` args.
 *
 * Same boundary convention as {@link validate}: throws on any unknown key, and
 * type-checks each known key. `chatJid` / `replyToMsgId` are required non-empty
 * strings; `maxMessages` / `maxChars` are optional positive integer caps.
 *
 * @param raw - the LLM's emitted args (untrusted)
 * @returns the typed, validated args
 * @throws if `raw` is not an object, carries an unknown key, omits a required
 *   string, or gives a cap the wrong type - the throw feeds the loop so the
 *   model can self-correct
 */
export function validateReplyLineage(raw: unknown): ReplyLineageArgs {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("getReplyLineage args must be an object");
  }

  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!REPLY_LINEAGE_ARGS.includes(key)) {
      throw new Error(`getReplyLineage: unknown argument: ${key}`);
    }
  }

  const { chatJid, replyToMsgId, maxMessages, maxChars } = record;
  if (typeof chatJid !== "string" || chatJid.length === 0) {
    throw new Error("getReplyLineage: `chatJid` must be a non-empty string");
  }
  if (typeof replyToMsgId !== "string" || replyToMsgId.length === 0) {
    throw new Error(
      "getReplyLineage: `replyToMsgId` must be a non-empty string",
    );
  }

  const args: ReplyLineageArgs = { chatJid, replyToMsgId };
  if (maxMessages !== undefined) {
    if (!Number.isInteger(maxMessages) || (maxMessages as number) <= 0) {
      throw new Error(
        "getReplyLineage: `maxMessages` must be a positive integer",
      );
    }
    args.maxMessages = maxMessages as number;
  }
  if (maxChars !== undefined) {
    if (!Number.isInteger(maxChars) || (maxChars as number) <= 0) {
      throw new Error("getReplyLineage: `maxChars` must be a positive integer");
    }
    args.maxChars = maxChars as number;
  }
  return args;
}

/**
 * The tool's one side effect: calls `messages.getReplyLineage` over Convex.
 * A plain query, so `.query()`. Dependency-injected like {@link run}; proven
 * against the live backend, not a mock.
 *
 * @param args - validated args from {@link validateReplyLineage}
 * @param deps - injected dependencies (the Convex client)
 * @returns the reply lineage, oldest ancestor first
 */
export function runReplyLineage(
  args: ReplyLineageArgs,
  deps: ToolDeps,
): Promise<ReplyLineage> {
  return deps.convex.query(api.messages.getReplyLineage, args);
}

export const getReplyLineageTool: RegisteredTool = {
  name: "getReplyLineage",
  description:
    "Reconstruct the chain of messages a given message was replying to, in a " +
    "WhatsApp chat. Use to gather the surrounding thread before answering a " +
    "question about a specific message. Returns the ancestor messages oldest " +
    "first, each with its role (user/assistant), text, and timestamp.",
  parameters: {
    type: "object",
    properties: {
      chatJid: {
        type: "string",
        description: "The WhatsApp chat id (JID) the message belongs to.",
      },
      replyToMsgId: {
        type: "string",
        description: "The message id to walk the reply chain back from.",
      },
      maxMessages: {
        type: "number",
        description: "Optional cap on how many ancestors to walk. Default 8.",
      },
      maxChars: {
        type: "number",
        description: "Optional cap on total characters returned. Default 4000.",
      },
    },
    required: ["chatJid", "replyToMsgId"],
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runReplyLineage(validateReplyLineage(rawArgs), deps).then((data) => ({
      tool: "getReplyLineage",
      data,
    })),
};

// ── listCostRollups: per-run Go Deep cost (PR 4) ─────────────────────────
// The tool's action lives in cost.ts (it fans out list -> per-run usage), so
// only the LLM-facing metadata is assembled here. `data` is the merged cost rows
// the shell renders as a cost panel.
export const listCostRollupsTool: RegisteredTool = {
  name: "listCostRollups",
  description:
    "Per-run token cost of overnight 'Go Deep' brief runs: each recent run with " +
    "its task, group, and REAL token totals (input / output / cache). Use for " +
    "questions like 'what did each Go Deep run cost?' or cost-by-run breakdowns.",
  parameters: {
    type: "object",
    properties: {
      after: {
        type: "number",
        description:
          "Optional unix-ms lower bound on a run's creation time. Omit for " +
          "all-time.",
      },
      groupFolder: {
        type: "string",
        description: "Optional group folder to scope to. Omit for all groups.",
      },
      limit: {
        type: "number",
        description: "Optional cap on how many recent runs to include.",
      },
    },
    additionalProperties: false,
  },
  execute: (rawArgs, deps) =>
    runCostBreakdown(validateCostRollups(rawArgs), deps).then((data) => ({
      tool: "listCostRollups",
      data,
    })),
};

// ── registry wiring (the two facets the shell hands the loop) ────────────
// One array drives both advertising (toOpenRouterTools) and dispatch
// (makeRunTool). Adding a tool = define it + add it here.

export const registry: RegisteredTool[] = [
  getAggregateStatsTool,
  getAggregateTokenUsageTool,
  listRecentTool,
  listConversationsTool,
  listByChatJidTool,
  listAllTool,
  pauseTool,
  resumeTool,
  enqueueTool,
  getReplyLineageTool,
  listCostRollupsTool,
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
