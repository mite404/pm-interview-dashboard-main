# Plan: Conversational Admin Dashboard - Hardened Steel Thread (Phase 1)

## Context

This is a take-home: build a chat-based admin dashboard where an admin types natural language, an LLM (OpenRouter) with tool-calling maps it to Convex queries, and results render inline (text + chart) with streaming and a tool-status indicator.

The backend is given and live (`https://utmost-poodle-412.convex.cloud`); we build only the frontend in `src/` and consume the typed `api`.
This plan hardens the original steel-thread plan with an explicit build order, atomic commits, and test-alongside coverage, because the commit/PR history is itself a grading signal and end-loaded tests are a known anti-pattern.

Full reconnaissance, decisions, and the backend domain map live in `docs/REPO_TOUR.md`.

## Working methodology (applies to every commit)

- Work atomically, mise-en-place style: prep the pure ingredients first, then add them to the application in order.
  Each commit tells one part of the story and keeps the gate green (`lint-staged` + `bun run lint`).
- Test-alongside, never end-loaded: a commit that adds non-trivial logic ships its own coverage (unit or e2e, whichever fits the seam).
  Prep/scaffolding commits, and commits that only become testable once a later piece exists, may legitimately carry no test.
- File-structure convention (per `AGENTS.md`): imports, then declarations, then prep data, then helper/pure fns, then the main orchestration at the bottom.
  Build leafs to root, following Grokking Simplicity: data, then calculations, then actions.
- Dependency injection is the enabler: `loop.ts` and each tool's `run` take their dependencies (OpenRouter fns, Convex client) as parameters so they are testable in isolation with fakes.
  No hard-imported singletons in the orchestration path.
- TypeScript discipline (per `AGENTS.md` + the brief): no `any`, no `// @ts-ignore`, no type-loosening to make code compile; fix the type.
  Annotate data-flow boundaries with `// -> Type` comments on the lines that cross a transformation.

## Phase 1 goal: the steel thread

One vertical slice that proves every integration seam once, with one tool:

`admin types -> OpenRouter (tool decision, mocked in tests) -> validate args -> real Convex query -> feed result back -> OpenRouter (streamed answer) -> render text + a real Recharts chart`

The reasoning is risk isolation and learning, not development time: each seam is proven once in the simplest setting where a failure is unambiguous, and the wiring is understood before breadth is layered on.

Tool for the thread: `dashboard.dailyUniqueUsers`, called with a wide window (`days: 90`) so the frozen seeded days always fall inside it.
Do not pass `lane` (the lane filter returns all-zeros against the seed).

### Criteria coverage (what "Phase 1 done" means)

The five build tiers prove the architecture end to end with one tool. That is a subset of the 14 criteria, not all of them.

**Satisfied by the steel thread:**

| Criterion                      | Status                                                |
| ------------------------------ | ----------------------------------------------------- |
| Must #1 chat interface         | yes                                                   |
| Must #2 LLM tool-calling       | yes                                                   |
| Must #4 one inline chart       | yes (real Recharts)                                   |
| Must #5 streaming              | yes (answer turn)                                     |
| Must #6 tool-status pill       | yes                                                   |
| Should #9 error handling       | yes (loop try/catch)                                  |
| Should #7 conversation context | partial (loop passes prior turns; lineage is Phase 2) |

**Deferred to Phase 2 (horizontal breadth on the proven thread):**

| Criterion                            | Why it waits                                         |
| ------------------------------------ | ---------------------------------------------------- |
| Must #3 >=5 tools                    | the thread wires one; the big remaining must-have    |
| Should #8 clarification on ambiguity | UX layer, added once the loop is proven              |
| Should #10 >=1 mutation              | `intelligenceTaskDefs.pause`, added as a second tool |
| Nice #11 multiple chart types        | reuse the Recharts setup                             |
| Nice #12 message drill-in            | second/third tool                                    |
| Nice #13 cost breakdown              | `listCostRollups` + `getRunUsage`                    |
| Nice #14 DESIGN.md                   | written near the end                                 |

## Build order: tiers vs commits (one PR: "steel thread")

Tiers are ordered phases (data -> calculations -> actions -> UI -> verification), not single commits.
The commit order follows the tier order and never jumps backward, but a tier may span several atomic commits, so tiers map to ordered ranges of commits, not one-to-one.
There is no monolithic tooling commit: each dev/runtime dependency is installed just-in-time, in the commit that first needs it (Vitest before the first unit test, Recharts before the chart, Playwright before the e2e), so every commit stays focused and self-justifying.
Pre-req already done: `VITE_OPENROUTER_API_KEY` in `vite-env.d.ts`.

Approximate sequence, ~9 atomic commits, each green through the gate, annotated by tier:

1. (T1 data) `src/lib/types.ts` - `ChatMessage`, `ToolResult`, tool-registry types. Pure shapes; the first dip; no test needed.
2. (T2 calc) add Vitest; `src/lib/tools.ts` `validate` for the one tool (args in -> typed args or throw) + unit test. The boundary the brief grades.
3. (T2 calc) `src/lib/openrouter.ts` pure parsing helpers (tool-call extraction, SSE chunks -> text deltas) + unit tests.
4. (T3 action) `src/lib/convexClient.ts` + the tool's `run` (real `ConvexHttpClient`; partially proven by `scripts/check-backend.ts`).
5. (T3 action) `src/lib/openrouter.ts` `decideTool` (non-streamed) and `streamAnswer` (SSE). Stream only the answer turn; the routing turn has no prose to show.
6. (T3 action) `src/lib/loop.ts` orchestrator (DI'd), built as an iterate-until-done `while` loop (runs one iteration in Phase 1, so Phase 2 multi-step is purely additive) + integration test with fakes (happy path + error path: tool throws -> assistant error, no crash).
7. (T4 UI) add Recharts; `src/components/DailyUsersChart.tsx` (bar chart over `[{day, uniqueUsers}]`) + render test. Recharts over hand-rolled SVG: it is the shadcn-stack charting lib, covers Nice #11's bar/line/table, and avoids a throwaway stub.
8. (T4 UI) `src/App.tsx`: message list, input, send handler wiring `loop.ts`, tool-status pill, streamed text, the chart. Minimal plain styling (shadcn is Phase 2).
9. (T5 verify) add Playwright; one e2e (`e2e/`): mock OpenRouter (both turns), real Convex at `days: 90`; assert the pill appears, text streams in, the chart renders a known seeded value.

## Testing approach

- Unit (Vitest): the pure calculations - `validate`, the OpenRouter parsing. Fast, offline, deterministic.
- Integration (Vitest): `loop.ts` with injected fakes; assert state transitions and the error path.
- E2E (Playwright): mock the LLM (non-deterministic, costs tokens), real Convex (proves the typed-`api` wiring end to end, like a REST integration test against a real test DB).
- Behavior, not implementation: assert what the admin experiences (pill shows, text streams, chart renders), not that a function was called.
- Edge cases to cover as the relevant seam lands: OpenRouter request fails, Convex call fails, LLM returns invalid args, LLM names an unknown tool. Each should surface gracefully in the chat, never crash.

## Verification (Phase 1)

1. `bun run dev`; type "how many active users this week?" -> tool-status pill, a streamed sentence, and a rendered Recharts bar chart of day vs count. Type "hi" -> streamed reply, no tool call.
2. `bun run test` (Vitest) green; the e2e suite (Playwright) green.
3. `bun run lint` exits 0 (`src/` strict-clean; `convex/` advisory). `bun run build` (Vite) produces a bundle.
4. `bun run check:backend` still confirms the live wire.

## Phase 2 (after the thread runs)

Phase 2 is horizontal breadth on the proven thread: more tools, more chart types, the mutation, and the polish that makes it feel like a real operator tool.
Each item is a small vertical (data -> calculation -> action -> UI -> test) on the spine Phase 1 already proved.
The rationale for every decision below is recorded in `DESIGN.md`, written incrementally (one entry per decision as its commit lands, then a final editing pass); this section is the build roadmap, not the full defense.

### Audience and design direction

The dashboard is internal admin/operator tooling, not contractor-facing: the brief states "the admin is the user," and the backend has no per-tenant scoping (confirmed by the existing "MonsterClaw" ops console - dev/prod switcher, per-user delete, cross-user PII).
Match that existing tool's dark ops-console aesthetic: near-black background, construction-orange primary (`#F96302`, already close to MonsterClaw's accent), monospace labels, sharp corners.
Source the components from the `phillips-poc-public` project (Tailwind 4, shadcn/Radix, lucide icons, `--radius: 0`), reusing its dark-mode CSS variables as the starting palette and swapping `--primary` to the construction orange.

### Build order (Phase 2 as its own PR, or a small series)

1. Design system first: `npx shadcn init` (Tailwind 4, to match the source components) + import the reusable `phillips-poc` components + set the palette + delete the throwaway Phase 1 CSS.
   One clean commit, so every later commit builds on the final styling foundation.
2. Generalize `loop.ts` to multi-step (see below) + integration test (two-step `listAll -> pause` happy path; a mid-sequence tool error fed back).
3. Add the read tools one at a time, each with its `validate` + unit test and its render path: `getAggregateTokenUsage` (`.action()`, line chart), `invocations.listRecent` + `getAggregateStats` (table + KPIs), `messages.listByChatJid` + `getReplyLineage` (drill-in + lineage), `intelligenceTaskDefs.listAll` (companion to the mutation).
4. Add the mutation tools: `pause` + `resume` first (reversible, the brief's own example), then `enqueue` as the stretch second mutation with its undo-send window.
5. `react-markdown` + `remark-gfm` for tables-in-chat; additional Recharts chart types.
6. Cost breakdown by Go Deep run (Nice #13): `overnightBriefRuns.listCostRollups`, then fan out to `getRunUsage` per run, because the list returns zeroed usage.
7. Final `DESIGN.md` editing pass.

### The multi-step agentic loop (hardening)

- Name -> id resolution is LLM-driven (Approach A): the model calls `listAll`, reads the result, then calls `pause` with the resolved id.
  Our code does not string-match names; `validate` throwing on an unknown id is the safety net.
  This keeps a brittle resolver out of our code and exercises real multi-turn tool-calling.
- `MAX_STEPS` cap (~5) guarantees the loop terminates and bounds per-message cost; hitting it surfaces a graceful, reason-bearing message.
- Tool-layer errors (a `validate` throw, a failed Convex call) are fed back to the LLM as that tool's result so it can self-correct; only an unreachable-LLM error aborts the turn.
- Every failure carries its specific cause: `validate` and tools throw descriptive errors, and the thrown message is the reason the chat shows (upgrades Should #9 from "doesn't crash" to "doesn't crash and says why").
- No chained mutations: flows are reads-then-one-terminal-write, so there is never a half-applied mutation to roll back.
  If two writes ever had to be atomic, that belongs in a single Convex mutation, not two tool calls the LLM chains.

### Mutation UX

- `pause` / `resume` fire directly; the LLM acknowledges the result ("Paused Daily Project Accounting").
  Reversible, so no grace period.
- `enqueue` carries a 5-second undo-send window (`undoWindowMs: 5000`): the loop defers the Convex call behind a client-side timer, so nothing reaches the backend until it elapses.
  Undo clears the timer; both fire and cancel feed a tool result back to the LLM so it closes the turn.
  Delivery is inert on the preview deployment (no real channel credentials per `API.md`), so this is risk-free to demo.
- Ambiguity (Should #8) is handled at the prompt level for all tools: when the target is unclear ("which task?"), the LLM asks rather than guesses.
  This is separate from the mutation grace period.

### Rendering and conversation context

- Tables render in-chat via `react-markdown` + `remark-gfm`: the LLM emits GFM table syntax in its prose, rendered as a React subtree (safe inline, no raw HTML, no sandbox).
  Charts render as Recharts components keyed off the typed tool result, not through markdown.
- Two stores, kept distinct: the UI message list (what the admin sees - prose + rendered charts/tables) and the LLM message array (what is sent to OpenRouter - system prompt, tool calls, tool results).
- Conversation context (Should #7) keeps full prose continuity, but once a turn completes, bulky tool-result content is stubbed (e.g. "[chart data rendered]") to bound token growth.
  We stub rather than delete because the API rejects a `tool_call` with no matching tool-result message.
  Windowing + summarization is the production scale-up, omitted here because admin sessions are short (noted in `DESIGN.md`).
- Time-window vocabulary mirrors the existing tool's filters (`24h / 7d / 30d / 60d / 90d`): the LLM maps "this week" -> 7d, "this month" -> 30d, and `days: 90` stays the widest window so seeded data is always in range.

| Phase 2 work item                                      | Convex function(s)                                                                      | Criteria closed                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Expand the tool registry to ~6 tools                   | the five below + the Phase 1 one                                                        | **Must #3** (≥5 tools) — the big remaining must-have                                                     |
| Pause/resume a scheduled task (the mutation)           | `intelligenceTaskDefs.pause` / `resume`                                                 | **Should #10**                                                                                           |
| Clarify ambiguous requests (which user? which window?) | loop/prompt UX, no new backend                                                          | **Should #8**                                                                                            |
| Drill into a specific user's chat                      | `messages.listByChatJid`                                                                | **Nice #12**                                                                                             |
| Reconstruct a user's reply thread on drill-in          | `messages.getReplyLineage`                                                              | **Should #7** (upgrades partial → full)                                                                  |
| Multiple chart types (line, table) reusing Recharts    | `getAggregateTokenUsage` (line), `invocations.listRecent` + `getAggregateStats` (table) | **Nice #11**                                                                                             |
| Cost breakdown by Go Deep run                          | `overnightBriefRuns.listCostRollups` then fan out to `getRunUsage`                      | **Nice #13**                                                                                             |
| `npx shadcn init` + UI polish                          | none (UI layer)                                                                         | no numbered criterion, but directly serves evaluation axis #2 "does it feel like a real tool, not a toy" |
| Write `DESIGN.md`                                      | none                                                                                    | **Nice #14**                                                                                             |

Note: there is deliberately no whole-project `tsc` gate. The given `convex/` backend source does not type-check, and the generated `api.d.ts` pulls those modules into any `tsc` run, so a clean compile is impossible without editing given code. Type safety on `src/` comes from type-aware ESLint plus the editor's TypeScript server.
