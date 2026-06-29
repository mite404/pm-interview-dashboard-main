import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Database schema for the PlanMonster admin dashboard.
 *
 * This is a trimmed schema containing only the tables the dashboard
 * functions read from and write to. The full production schema has many
 * more tables for documents, project accounting, phone batching, etc.
 */
export default defineSchema({
  // ── Identity ───────────────────────────────────────────────────────

  registeredGroups: defineTable({
    jid: v.string(),
    name: v.string(),
    folder: v.string(),
    triggerPattern: v.string(),
    containerConfig: v.optional(v.object({ timeout: v.optional(v.number()) })),
    requiresTrigger: v.optional(v.boolean()),
    capabilities: v.optional(v.array(v.string())),
    personId: v.id("persons"),
  })
    .index("by_jid", ["jid"])
    .index("by_folder", ["folder"])
    .index("by_personId", ["personId"]),

  persons: defineTable({
    status: v.union(
      v.literal("anonymous"),
      v.literal("google_verified"),
      v.literal("phone_verified"),
    ),
    googleSub: v.optional(v.string()),
    googleEmail: v.optional(v.string()),
    phoneE164: v.optional(v.string()),
    primaryGroupId: v.optional(v.id("registeredGroups")),
    primaryGroupFolder: v.optional(v.string()),
    primaryLaneKey: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    displayName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    occupation: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_googleEmail", ["googleEmail"])
    .index("by_phoneE164", ["phoneE164"]),

  gmailTokens: defineTable({
    groupFolder: v.string(),
    emailAddress: v.string(),
    personId: v.id("persons"),
    refreshToken: v.string(),
    scopes: v.array(v.string()),
    connectedAt: v.number(),
    groupId: v.id("registeredGroups"),
    status: v.union(v.literal("active"), v.literal("revoked")),
  })
    .index("by_personId_status", ["personId", "status"]),

  // ── Chat ───────────────────────────────────────────────────────────

  chats: defineTable({
    jid: v.string(),
    name: v.string(),
    lastMessageTime: v.number(),
    groupId: v.optional(v.id("registeredGroups")),
    personId: v.optional(v.id("persons")),
  })
    .index("by_jid", ["jid"])
    .index("by_lastMessageTime", ["lastMessageTime"])
    .index("by_groupId", ["groupId"]),

  messages: defineTable({
    msgId: v.optional(v.string()),
    chatJid: v.string(),
    sender: v.string(),
    senderName: v.string(),
    content: v.string(),
    timestamp: v.number(),
    isFromMe: v.boolean(),
    groupId: v.optional(v.id("registeredGroups")),
    personId: v.id("persons"),
    laneKey: v.optional(v.string()),
    replyToMsgId: v.optional(v.string()),
    replyToContent: v.optional(v.string()),
    agentResultSourceKind: v.optional(
      v.union(v.literal("smart_reply"), v.literal("agent")),
    ),
    agentResultInvocationId: v.optional(v.id("agentInvocations")),
    agentResultRootMsgId: v.optional(v.string()),
    invocationId: v.optional(v.id("agentInvocations")),
    classification: v.optional(
      v.object({
        intent: v.string(),
        sentiment: v.string(),
        topics: v.array(v.string()),
        requiresFollowUp: v.boolean(),
        summary: v.string(),
      }),
    ),
  })
    .index("by_chatJid_and_timestamp", ["chatJid", "timestamp"])
    .index("by_msgId_and_chatJid", ["msgId", "chatJid"])
    .index("by_groupId", ["groupId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_laneKey_and_timestamp", ["laneKey", "timestamp"]),

  // ── Invocations ────────────────────────────────────────────────────

  agentInvocations: defineTable({
    groupFolder: v.string(),
    groupId: v.optional(v.id("registeredGroups")),
    chatJid: v.string(),
    personId: v.id("persons"),
    laneKey: v.optional(v.string()),
    prompt: v.string(),
    isMain: v.boolean(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    result: v.optional(
      v.object({
        outputType: v.string(),
        userMessage: v.optional(v.string()),
        internalLog: v.optional(v.string()),
      }),
    ),
    deliveryMessage: v.optional(v.string()),
    contentType: v.optional(
      v.union(
        v.literal("answer"),
        v.literal("not_found"),
        v.literal("error"),
        v.literal("internal_only"),
      ),
    ),
    error: v.optional(v.string()),
    taskDefId: v.optional(v.id("intelligenceTaskDefs")),
    briefRunId: v.optional(v.id("overnightBriefRuns")),
    invocationRole: v.optional(
      v.union(
        v.literal("parent"),
        v.literal("child"),
        v.literal("composer"),
        v.literal("simple"),
      ),
    ),
    parentInvocationId: v.optional(v.id("agentInvocations")),
    retryOfInvocationId: v.optional(v.id("agentInvocations")),
  })
    .index("by_status", ["status"])
    .index("by_groupFolder_status", ["groupFolder", "status"])
    .index("by_briefRunId", ["briefRunId"]),

  invocationEvents: defineTable({
    invocationId: v.id("agentInvocations"),
    personId: v.id("persons"),
    groupId: v.optional(v.id("registeredGroups")),
    groupFolder: v.string(),
    chatJid: v.string(),
    userJid: v.optional(v.string()),
    seq: v.number(),
    type: v.string(),
    subtype: v.optional(v.string()),
    payload: v.string(),
    summary: v.optional(v.string()),
    turnIndex: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    cacheCreationInputTokens: v.optional(v.number()),
    cacheReadInputTokens: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_invocationId_seq", ["invocationId", "seq"])
    .index("by_groupFolder_createdAt", ["groupFolder", "createdAt"])
    .index("by_personId_createdAt", ["personId", "createdAt"]),

  // ── Intelligence ───────────────────────────────────────────────────

  intelligenceTaskDefs: defineTable({
    name: v.string(),
    naturalLanguageQuery: v.string(),
    prompt: v.string(),
    cronExpression: v.string(),
    timezone: v.string(),
    cronName: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
    ),
    isUserVisible: v.optional(v.boolean()),
    briefFormatProfile: v.optional(
      v.union(v.literal("user_facing"), v.literal("admin_internal")),
    ),
    deliveryTarget: v.optional(
      v.union(v.literal("admin"), v.literal("user"), v.literal("both")),
    ),
    executionMode: v.optional(v.union(v.literal("deep"), v.literal("simple"))),
    scheduleMode: v.optional(v.union(v.literal("manual"), v.literal("cron"))),
    starred: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"]),

  overnightBriefRuns: defineTable({
    taskDefId: v.id("intelligenceTaskDefs"),
    groupId: v.id("registeredGroups"),
    userJid: v.string(),
    personId: v.id("persons"),
    runKey: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("partial"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    parentInvocationId: v.optional(v.id("agentInvocations")),
    composerInvocationId: v.optional(v.id("agentInvocations")),
    outputArtifact: v.optional(
      v.object({
        kind: v.literal("google_sheet"),
        spreadsheetId: v.string(),
        spreadsheetUrl: v.string(),
        spreadsheetTitle: v.string(),
        sheetName: v.string(),
        rowCount: v.number(),
        columnCount: v.number(),
        createdAt: v.number(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  // ── Admin ──────────────────────────────────────────────────────────

  adminDirectMessages: defineTable({
    groupId: v.id("registeredGroups"),
    personId: v.id("persons"),
    laneKey: v.optional(v.string()),
    groupJid: v.string(),
    groupName: v.string(),
    groupFolder: v.string(),
    selectedChannel: v.union(
      v.literal("whatsapp"),
      v.literal("sms"),
      v.literal("imessage"),
    ),
    messageBody: v.string(),
    messageWordCount: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    requestedAt: v.number(),
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    source: v.optional(v.string()),
  })
    .index("by_requestedAt", ["requestedAt"])
    .index("by_groupId_requestedAt", ["groupId", "requestedAt"])
    .index("by_status_requestedAt", ["status", "requestedAt"]),

  systemAlerts: defineTable({
    alertType: v.string(),
    message: v.string(),
    recipientJid: v.string(),
    contactJid: v.optional(v.string()),
    personId: v.optional(v.id("persons")),
    laneKey: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  monsterCitationCache: defineTable({
    customId: v.string(),
    recipientEmail: v.string(),
    normalizedRecipientEmail: v.string(),
    citationId: v.string(),
    loggedDate: v.string(),
    subject: v.string(),
    emailQuestion: v.string(),
    normalizedQuestion: v.string(),
    canonicalQuestion: v.string(),
    sourcedAnswer: v.string(),
    sourceReferences: v.array(
      v.object({
        sourceId: v.string(),
        label: v.string(),
        kind: v.string(),
      }),
    ),
    emailCta: v.string(),
    internalNotes: v.string(),
    messageHitCount: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_citationId", ["citationId"])
    .index("by_messageHitCount", ["messageHitCount"]),
});
