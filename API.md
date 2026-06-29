# Convex API Reference

Every function below is available on the deployed preview at
`https://utmost-poodle-412.convex.cloud`. Import the typed `api` from
`../convex/_generated/api` and call via `useQuery`, `useMutation`, `useAction`
(React) or `ConvexHttpClient.query/mutation/action` (non-React).

## groups

### `groups.getAll` — query
List all registered groups/channels.
- **args**: `{}`
- **returns**: `Array<Doc<"registeredGroups">>` — `{ _id, _creationTime, jid, name, folder, triggerPattern, capabilities?, personId }`

### `groups.getByJid` — query
- **args**: `{ jid: string }`
- **returns**: `Doc<"registeredGroups"> | null`

### `groups.getByFolder` — query
- **args**: `{ folder: string }`
- **returns**: `Doc<"registeredGroups"> | null`

### `groups.listSignedUpUsersForAdmin` — query
All Google-verified and phone-verified users with Gmail/phone/email summary.
- **args**: `{}`
- **returns**: `Array<{ personId, userName, phoneNumber?, emailAddress?, gmailScopes: string[], gmailEmailAddress?, gmailConnectedAt?, createdAt, lastSeenAt }>`

### `groups.deleteSignedUpUserForAdmin` — mutation
Deletes a person and their groups/Gmail tokens. **Destructive.**
- **args**: `{ personId: Id<"persons"> }`
- **returns**: `{ ok: true }`

---

## messages

### `messages.listByChatJid` — query
Recent messages for one chat, oldest-first.
- **args**: `{ chatJid: string, limit?: number }` (limit default 100, max 200)
- **returns**: `Array<Doc<"messages">>` — includes `content`, `senderName`, `isFromMe`, `timestamp`, `replyToMsgId`, `classification?`

### `messages.getByMsgId` — query
- **args**: `{ msgId: string, chatJid: string }`
- **returns**: `Doc<"messages"> | null`

### `messages.getReplyLineage` — query
Walks the `replyToMsgId` chain to produce a bounded reply thread.
- **args**: `{ chatJid: string, replyToMsgId: string, maxMessages?: number, maxChars?: number }`
- **returns**: `Array<{ msgId?, content, role: "assistant"|"user", timestamp }>`

---

## dashboard

### `dashboard.listWebUserTurns` — query
Recent web-channel user turns paired with their assistant reply. Surfaces web
usage that may not have produced a full invocation row (smart-reply turns).
- **args**: `{ after?: number, groupFolder?: string, limit?: number }`
- **returns**: `Array<{ _id, _creationTime, msgId?, chatJid, groupFolder, groupId?, personId?, laneKey?, sender, senderName, content, timestamp, replyMsgId?, replyContent?, replySourceKind?, replyInvocationId? }>`

### `dashboard.dailyUniqueUsers` — query
Daily distinct-user counts from inbound messages, bucketed by UTC day.
- **args**: `{ days?: number, groupFolder?: string, lane?: "web"|"whatsapp"|"imessage"|"sms" }`
- **returns**: `Array<{ day: string, uniqueUsers: number }>`

---

## invocations

### `invocations.listRecent` — query
- **args**: `{ limit?: number, after?: number }`
- **returns**: `Array<Doc<"agentInvocations">>` (newest first)

### `invocations.listRecentPaginated` — query
- **args**: `{ paginationOpts: { cursor: string|null, numItems: number }, after?: number }`
- **returns**: `{ page: Array<Doc<"agentInvocations">>, isDone: boolean, continueCursor: string }`

### `invocations.listByGroup` — query
- **args**: `{ groupFolder: string, status?, limit?, after? }`
- **returns**: `Array<Doc<"agentInvocations">>` (newest first)

### `invocations.getById` — query
- **args**: `{ id: Id<"agentInvocations"> }`
- **returns**: `Doc<"agentInvocations"> | null`

### `invocations.getAggregateStats` — query
- **args**: `{ after?: number, groupFolder?: string }`
- **returns**: `{ total, active, succeeded, finishedCount, avgDuration }` (avgDuration in ms)

---

## invocationEvents

### `invocationEvents.getReadableByInvocation` — query
Human-readable event stream for one invocation (tool calls, model turns,
per-event token usage).
- **args**: `{ invocationId: Id<"agentInvocations"> }`
- **returns**: `Array<{ invocationId, groupFolder, chatJid, seq, type, subtype?, summary?, turnIndex?, tokens: TokenUsage, createdAt }>`

### `invocationEvents.getMetricsByInvocation` — query
Rolled-up metrics for a single invocation.
- **args**: `{ invocationId: Id<"agentInvocations"> }`
- **returns**: `{ invocationId, eventCount, turnCount, tokenUsage: TokenUsage, typeCounts, firstEventAt?, lastEventAt? }`

### `invocationEvents.getMetricsBatch` — ACTION
Same metrics shape as above but for many invocations. **Call with `.action()`.**
- **args**: `{ invocationIds: Array<Id<"agentInvocations">> }`
- **returns**: `Array<metrics object>` (one per invocation that had events)

### `invocationEvents.getAggregateTokenUsage` — ACTION
Sums token usage across all events in a time window. **Call with `.action()`.**
- **args**: `{ after: number, groupFolder?: string }`
- **returns**: `{ inputTokens, outputTokens, totalTokens, cacheCreationInputTokens, cacheReadInputTokens }`

---

## overnightBriefRuns

### `overnightBriefRuns.listCostRollups` — query
Per-run cost/usage rollup for Go Deep briefs in a time window.
- **args**: `{ after: number, groupFolder?: string, limit?: number }`
- **returns**: `Array<{ briefRunId, runKey, createdAt, groupFolder, taskName, userJid, status, outputArtifact?, parentUsage, childUsage, retryUsage, composerUsage, totalUsage, invocationCounts }>`

### `overnightBriefRuns.getRunUsage` — query
Detailed token usage for one brief run, split by invocation role.
- **args**: `{ briefRunId: Id<"overnightBriefRuns"> }`
- **returns**: `{ parentUsage, childUsage, retryUsage, composerUsage, totalUsage }`

---

## intelligenceTaskDefs

### `intelligenceTaskDefs.listAll` — query
- **args**: `{}`
- **returns**: `Array<Doc<"intelligenceTaskDefs">>`

### `intelligenceTaskDefs.getById` — query
- **args**: `{ taskDefId: Id<"intelligenceTaskDefs"> }`
- **returns**: `Doc<"intelligenceTaskDefs"> | null`

### `intelligenceTaskDefs.pause` — mutation
- **args**: `{ taskDefId: Id<"intelligenceTaskDefs"> }`
- **returns**: updated task def

### `intelligenceTaskDefs.resume` — mutation
- **args**: `{ taskDefId: Id<"intelligenceTaskDefs"> }`
- **returns**: updated task def

### `intelligenceTaskDefs.cancel` — mutation
- **args**: `{ taskDefId: Id<"intelligenceTaskDefs"> }`
- **returns**: updated task def

### `intelligenceTaskDefs.toggleStar` — mutation
- **args**: `{ taskDefId: Id<"intelligenceTaskDefs"> }`
- **returns**: updated task def

---

## adminDirectMessages

### `adminDirectMessages.listRecipients` — query
Groups eligible to receive an admin DM.
- **args**: `{}`
- **returns**: `Array<{ _id, jid, name, folder, personId }>`

### `adminDirectMessages.listByTimeRange` — query
- **args**: `{ after: number, groupId?: Id<"registeredGroups"> }`
- **returns**: `Array<Doc<"adminDirectMessages">>` (newest first)

### `adminDirectMessages.enqueue` — mutation
Queue a one-off DM (250-word limit). **Note:** On the preview deployment,
delivery is inert (no real WhatsApp/SMS/iMessage credentials configured).
- **args**: `{ groupId: Id<"registeredGroups">, selectedChannel: "whatsapp"|"sms"|"imessage", messageBody: string, source?: string }`
- **returns**: `Id<"adminDirectMessages">`

---

## alerts

### `alerts.listRecentGoDeepBriefs` — query
Recent Go Deep brief delivery/log alerts.
- **args**: `{ taskDefId?: Id<"intelligenceTaskDefs">, after?: number }`
- **returns**: `Array<{ id, createdAt, status, recipientJid, alertType, message, briefRunId, taskDefId }>`

---

## monsterCitations

### `monsterCitations.listMarketingMatchesPaginated` — query
Marketing citation rows with message-hit counts.
- **args**: `{ paginationOpts: { cursor: string|null, numItems: number }, sortBy?: "citationId"|"messageHitCount" }`
- **returns**: `{ page: Array<{ citationId, emailQuestion, recipientEmail, matchCount, matched }>, isDone, continueCursor }`

---

## Types

```ts
type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};
```

All `Id<"tableName">` values are opaque strings at runtime. Pass them as-is
between functions (e.g., `groups.getAll` returns `personId` which you can pass
to `groups.deleteSignedUpUserForAdmin`).
