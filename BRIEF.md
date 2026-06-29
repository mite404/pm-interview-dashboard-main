# Product Brief: Conversational Admin Dashboard

## The problem

PlanMonster is a jobsite assistant platform. Contractors, interior designers,
and tradespeople chat with "Monty" across WhatsApp, iMessage, SMS, and web.
Behind the scenes, every conversation produces messages, agent invocations,
token usage, and scheduled intelligence runs.

Today, admins use a traditional dashboard (tables, charts, filters) to monitor
all of this. We want to replace that with a **conversational interface** — a
chat app where an admin types natural language and gets back data,
visualizations, and insights.

## What you're building

A chat-based admin dashboard. The admin is the user. The assistant is an LLM
that translates natural language into Convex backend queries, renders the
results (text, tables, charts), and answers follow-up questions.

### Example interactions

- "Show me what Maya Patel has been talking about lately"
  → calls `messages.listByChatJid` for Maya's chat, summarizes the conversation

- "How many active users did we have each day this week?"
  → calls `dashboard.dailyUniqueUsers`, renders a bar chart inline

- "What's our token usage this month?"
  → calls `invocationEvents.getAggregateTokenUsage`, shows input/output/cache
  breakdown

- "Show me recent agent runs that failed"
  → calls `invocations.listRecent`, filters by status, shows error details

- "Pause the Daily Project Accounting task"
  → calls `intelligenceTaskDefs.pause`, confirms the action

- "Who are our signed-up users?"
  → calls `groups.listSignedUpUsersForAdmin`, shows names, emails, Gmail status

## Acceptance criteria

### Must have
1. A chat interface where the admin sends messages and receives responses
2. An LLM with tool-calling that maps natural language to Convex functions
3. At least 5 tools wired to real Convex queries (from the `api.*` surface)
4. At least one inline visualization (chart) rendered inside the chat
5. Streaming responses (the admin sees text appear as it's generated)
6. Tool-call status indicators (the admin can see when a tool is executing)

### Should have
7. Reply lineage / conversation context (the assistant remembers prior turns)
8. Clarification when the admin's request is ambiguous (which user? which time
   window?)
9. Error handling (failed tool calls don't crash the chat)
10. At least one mutation wired (pause/resume a task, or enqueue a DM)

### Nice to have
11. Multiple chart types (bar, line, table)
12. Message history browsing (drill into a specific user's chat)
13. Cost breakdown by Go Deep run
14. A short DESIGN.md explaining your architecture and tradeoffs

## What's out of scope
- Authentication / login (the preview deployment has no auth)
- Real-time subscriptions / live updates (polling or manual refresh is fine)
- CRM leads / Mapbox map (those use a separate external API not provided here)
- Mobile-responsive design (desktop is fine)

## Technical constraints

- Use the typed `api` from `convex/_generated/api` — do not use `anyApi`
- The three action functions (`getMetricsBatch`, `getAggregateTokenUsage`)
  must be called with `.action()`, not `.query()`
- The preview deployment URL is `https://utmost-poodle-412.convex.cloud`
- Use an LLM with tool-calling (OpenRouter, OpenAI, Anthropic, etc.)
- Single newlines between lines in chat messages, not double newlines

## What we're evaluating

1. **Architecture**: How clean is the tool-calling boundary? Does the LLM
   hallucinate arguments, or are args validated?
2. **Product sense**: Does the chat feel like a real admin tool, or a toy?
   Does it handle ambiguity gracefully?
3. **Code quality**: Types, error handling, component structure, tests
4. **Speed**: What did you build in 1-2 days, and what did you cut?
5. **Judgment**: What tradeoffs did you make, and can you defend them?

## Submitting

Push your work to a public or shareable Git repo and send us the link. Include
a short README with setup instructions and a DESIGN.md with your architecture
notes.
