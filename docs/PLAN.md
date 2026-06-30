# Plan: Conversational Admin Dashboard - Steel Thread (Phase 1)

## Context

This is a take-home: build a chat-based admin dashboard where an admin types natural language, an LLM (OpenRouter) with tool-calling maps it to Convex queries, and results render inline (text + charts) with streaming and tool-status indicators.

The backend is given and live (`https://utmost-poodle-412.convex.cloud`, ~25 typed functions in `convex/`, seeded data verified reachable).
`src/` is a hello-world we replace.
The OpenRouter key is already in `.env.local`.

Decisions are weighted on quality, simplicity, robustness, and long-term maintainability, not on how long a human would take to write the code.

**Decisions locked with the user:**

- LLM runs browser-direct (local dev only; key in `.env.local`, no deploy, so key exposure is a non-issue).
  One line in DESIGN.md covers the production tradeoff (move the call into a Convex action with the key in `npx convex env set`).
- Tool-calling boundary is a hand-written tool registry; the LLM never touches `api` directly.
  This is the boundary the brief grades (eval #1: are args validated, or does the model hallucinate them).
- Charts use Recharts from the first chart onward, including the steel thread.
  Reasoning: it covers bar, line, and table cleanly (the brief wants multiple types) and is more robust and less code to maintain than hand-rolled SVG axis and scaling math.
- shadcn is the final UI library, added in Phase 2.
  The steel thread uses minimal plain styling on purpose, to keep visual styling out of the risk surface while the integration plumbing is being validated, and because validating wiring before layering UI is the stated learning preference.
- Stay in this repo (it is already a fully-wired Vite + React + Convex app, README "Option B" done for you).
  Do not scaffold a new `react-vite-shadcn` template and copy folders; run `npx shadcn init` in-place in Phase 2.
- Build vertical, not horizontal: the thinnest path that touches every integration seam once.
  Each seam is built with its real implementation (for example a real Recharts chart), not a throwaway stub, so nothing is rebuilt later.

## Phase 1 goal: the steel thread

One working vertical slice that proves every integration seam in isolation before complexity stacks on top.

Why a thread and not a feature-complete first pass:

1. Risk isolation.
   Each seam (LLM-to-tool boundary, argument validation, typed Convex call, result-to-render, streaming) is proven once, in the simplest setting where a failure is unambiguous.
2. Learning.
   Validate and understand the wiring before layering on UI polish and more tools.

Neither reason is about development time.

The slice:

`admin types -> OpenRouter (tool decision) -> validate args -> call ONE Convex query -> feed result back -> OpenRouter (streamed answer) -> render text + a real Recharts chart`

Acceptance criteria this hits:
Must #1 (chat), #2 (LLM tool-calling), #3 (one real tool; the required five come in Phase 2), #4 (a real inline chart, not a stub), #5 (streaming on the answer turn), #6 (tool-status pill).
Should #9 (error handling) is covered cheaply by the loop's try/catch.

Tool chosen for the thread: `dashboard.dailyUniqueUsers`.
It returns `[{day, uniqueUsers}]` in one call (verified: nonzero days exist) and is the natural first chart.
Call it without `lane`; the lane filter returns all-zeros against the seeded data.

## Files (Phase 1)

- `src/lib/convexClient.ts`
  Module-scope `ConvexHttpClient(import.meta.env.VITE_CONVEX_URL)` for imperative tool execution inside the loop (not React `useQuery`, because the loop is imperative).
  Uses the typed `api` from `convex/_generated/api`.
- `src/lib/tools.ts`
  The tool registry.
  One entry for the steel thread: `{ name, description, parameters (JSON schema), validate(args) -> typed | throw, run(args) -> Promise<result> }`.
  The LLM only ever sees `name`, `description`, and `parameters`; `validate` and `run` live in our code.
  This is the tool-calling boundary the brief grades.
- `src/lib/openrouter.ts`
  Two helpers.
  `decideTool(messages, tools)` does a non-streamed POST with `tools` and returns either a tool call (name + args) or final text.
  Streaming is omitted here on purpose: the routing turn has no prose to show, so streaming would only force fragile reassembly of tool-call fragments across chunks for no user benefit.
  Upgrade path: stream this turn too if token-level tool-status is ever wanted.
  `streamAnswer(messages, onDelta)` does a streamed POST (SSE) and calls `onDelta(text)` as tokens arrive, satisfying Must #5.
  Plain `fetch` to `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`; no SDK dependency.
- `src/lib/loop.ts`
  The orchestrator: append user message, `decideTool`, and if a tool is requested set status "running {name}", `validate` args, `run`, append the tool result, then `streamAnswer`.
  Wrapped in try/catch so a failed tool call surfaces as an assistant error message instead of crashing the chat (Should #9).
- `src/components/DailyUsersChart.tsx`
  A small Recharts bar chart over `[{day, uniqueUsers}]`.
  Built as the real render path so the inline-visualization seam is genuinely proven.
- `src/App.tsx`
  Replaces the hello-world.
  Message list, input box, a send handler wiring `loop.ts`, a tool-status pill, and rendering of assistant text plus the chart.
  Minimal plain styling only.
- `src/lib/tools.test.ts`
  A focused test that `validate` accepts good args and throws on bad ones (for example `days: "soon"`).
  This guards the validation logic that stands between the model and the backend.

**Pre-req before coding:** add `VITE_OPENROUTER_API_KEY` to `src/vite-env.d.ts` so the env contract is complete under strict type-aware lint.

**Dependencies added in Phase 1:** `recharts`.
Everything else uses `fetch` and the already-installed `convex`.

## Phase 2 (after the thread runs)

- `npx shadcn init` in this repo (Tailwind + components.json + aliases; additive).
- Expand the registry to at least five tools: `getAggregateTokenUsage` (an `.action()`), `invocations.listRecent` and `getAggregateStats`, `messages.listByChatJid` with `getReplyLineage`, and the `intelligenceTaskDefs.pause` mutation.
- More chart types, reusing the Recharts setup from Phase 1.
- Reply lineage and clarification UX.
- DESIGN.md.
- Cost breakdown by Go Deep run (Nice #13): list runs with `overnightBriefRuns.listCostRollups`, then fan out to `getRunUsage` per run, because the list returns zeroed usage.

## Verification (Phase 1)

1. `bun install`, then `bun run dev`; open the app.
2. Type "how many active users did we have this week?".
   Expect a "running dailyUniqueUsers" pill, then a streamed sentence and a rendered Recharts bar chart of day vs count.
   This confirms every seam: OpenRouter, the tool boundary, the typed Convex call, and the real render path.
3. Type something needing no tool ("hi").
   Expect a streamed reply and no tool call.
4. Run `bun run lint` and the `tools.test.ts` check.
   The lint gate passes (exit 0): `src/` is held to full `strictTypeChecked` and is clean, while `convex/` (the given backend) has its strict type-safety rules relaxed and its Convex-idiom rules left as advisory warnings, since we consume that code rather than rewrite it.
   The test confirms invalid model args are rejected before reaching Convex.
5. `bun run build` (Vite/esbuild) produces a production bundle.
   Note: there is deliberately no whole-project `tsc` gate. The given `convex/` backend source does not type-check, and the generated `api.d.ts` pulls those modules into any `tsc` run, so a clean compile is impossible without editing given code. Type safety on `src/` comes from type-aware ESLint plus the editor's TypeScript server, which check our code without failing on the backend.
