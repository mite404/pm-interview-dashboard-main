# Plan: Conversational Admin Dashboard - Hardened Steel Thread (Phase 1)

## Context

This is a take-home: build a chat-based admin dashboard where an admin types natural language, an LLM (OpenRouter) with tool-calling maps it to Convex queries, and results render inline (text + chart) with streaming and a tool-status indicator.

The backend is given and live (`https://utmost-poodle-412.convex.cloud`); we build only the frontend in `src/` and consume the typed `api`.
This plan hardens the original steel-thread plan with an explicit build order, atomic commits, and test-alongside coverage, because the commit/PR history is itself a grading signal and end-loaded tests are a known anti-pattern.

Full reconnaissance, decisions, and the backend domain map live in `docs/REPO_TOUR.md`.

## Working methodology (applies to every commit)

- Work atomically, mise-en-place style: prep the pure ingredients first, then add them to the application in order.
  Each commit tells one part of the story and keeps the gate green (`lint-staged` + `bun run lint`).
- A commit boundary, concretely: the smallest diff where (a) the gate is green, (b) it completes exactly one story beat - one pure fn + its test, one tool's `validate` + test, one component + render test, or one loop capability + its integration test - and (c) it carries its own test if it added non-trivial logic.
  Stop when the next change would start a different beat or force the gate red midway.
  The build order gives the sequence of beats; this rule gives where each one ends - so Phase 2's commits are derivable even though they are not enumerated like Phase 1's.
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

Tool for the thread: `invocations.getAggregateStats`, called with no args (all-time), so the counts are stable and never depend on wall-clock proximity to the frozen late-June seed.
It returns `{ total, active, succeeded, finishedCount, avgDuration }`. The chart shows three derived bars - succeeded, active, and failed (`finishedCount - succeeded`) - which always sum to `total`, because the status enum is `{pending, running, succeeded, failed}` (so `active + succeeded + failed = total`). `total` and `avgDuration` are KPI text, not bars (`total` is the sum; `avgDuration` is milliseconds).
Why this over `dashboard.dailyUniqueUsers`: that tool filters the frozen message `timestamp`, so it renders only ~4 sparse spikes today and the e2e would assert a wall-clock-fragile value; `getAggregateStats` filters `_creationTime` and, with no `after`, is dense and stable. `dailyUniqueUsers` moves to Phase 2.

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

## Build order: tiers vs commits (one PR: "steel thread")

Tiers are ordered phases (data -> calculations -> actions -> UI -> verification), not single commits.
The commit order follows the tier order and never jumps backward, but a tier may span several atomic commits, so tiers map to ordered ranges of commits, not one-to-one.
There is no monolithic tooling commit: each dev/runtime dependency is installed just-in-time, in the commit that first needs it (Vitest before the first unit test, Recharts before the chart, Playwright before the e2e), so every commit stays focused and self-justifying.
Pre-req already done: `VITE_OPENROUTER_API_KEY` in `vite-env.d.ts`.

Approximate sequence, ~10 atomic commits (0-9), each green through the gate, annotated by tier:

0. (T0 probe) `scripts/probe-tools.ts` - a throwaway, read-only `ConvexHttpClient` script that probes every non-mutation tool with the args the LLM will really emit and prints the return shape plus a "has data?" flag. Two call paths: `.query()` for the queries, and `.action()` for `getAggregateTokenUsage` (it pages internally, so it is an action - calling it with `.query()` fails). It skips all mutations (`pause` / `resume` / `enqueue`), which are writes proven at the integration/E2E layer, never fired against the live deployment in a smoke loop. This printout is the real tool contract, because the checked-in `convex/` source is a sketch that does not match the live deployment (verified: `dashboard.ts` references an undeclared `lane` that would `ReferenceError`, yet the deployment returns in-window data fine).
1. (T1 data) `src/lib/types.ts` - `ChatMessage`, `ToolResult`, tool-registry types. Pure shapes; the first dip; no test needed.
2. (T2 calc) add Vitest; the pure calc layer for `invocations.getAggregateStats`: `validate` in `src/lib/tools.ts` + the `toStatusBars` transform + unit tests. `validate` (args in -> typed args or throw) is the registry-wide boundary convention: strict on the types of known keys (`{ after?, groupFolder? }`), and it throws a descriptive error on any unknown key rather than silently dropping it - the throw feeds the agentic loop and demonstrates the hallucination-catching the brief grades (a valid-but-wrong value still passes; guarding the target is the prompt/ack layer's job in Phase 2). `toStatusBars` (`AggregateStats -> StatusBar[]`, deriving `failed = finishedCount - succeeded`) is the thread's first non-trivial, fail-able calculation; `StatusBar` is added to `types.ts` next to `ToolResult` (the cross-layer contract lives in the data layer), and the transform runs in the shell, not inside the chart, so the chart stays pure.
3. (T2 calc) `src/lib/openrouter.ts` pure parsing helpers (tool-call extraction, SSE chunks -> text deltas) + unit tests.
4. (T3 action) `src/lib/convexClient.ts` + the tool's `run` calling `invocations.getAggregateStats` (a plain `query`, so `.query()`; real `ConvexHttpClient`, already proven by commit 0's probe).
5. (T3 action) `src/lib/openrouter.ts` `decideTool` (non-streamed) and `streamAnswer` (SSE). Stream only the answer turn; the routing turn has no prose to show. `decideTool` sends `parallel_tool_calls: false`, so the routing turn returns at most one tool call - the deterministic guard behind `extractToolCall` reading `tool_calls[0]` (a prompt rule alone would not guarantee it). Tool-naming convention (registry-wide): a tool's name everywhere it is referenced as a name - the `tools` param's `function.name`, the value `extractToolCall` matches against the registry, and the `ToolResult` discriminant - is the bare Convex function name with no module path (`getAggregateStats`, not `invocations.getAggregateStats`), because OpenAI/OpenRouter function names disallow dots; the dotted path survives only as the typed `api` accessor (`api.invocations.getAggregateStats`), a separate concept that is an object path, not a string. This commit also updates the two `openrouter.test.ts` fixtures from the dotted name to the bare name so they reflect a real LLM response.
6. (T3 action) `src/lib/loop.ts` orchestrator (DI'd), built as an iterate-until-done `while` loop (runs one iteration in Phase 1, so Phase 2 multi-step is purely additive) + integration test with fakes (happy path + error path: tool throws -> assistant error, no crash).
7. (T4 UI) add Recharts; `src/components/StatusBreakdownChart.tsx` - a pure presentational component that receives an already-transformed `StatusBar[]` (imported from `types.ts`, never from `tools.ts`) plus the `total` / `avgDuration` KPI scalars, and renders a bar chart + KPI text + render test (fed a `StatusBar[]` fixture directly, no transform in the test). Recharts over hand-rolled SVG: it is the shadcn-stack charting lib, covers Nice #11's bar and line types (tables render via react-markdown, not Recharts), and avoids a throwaway stub.
8. (T4 UI) `src/App.tsx`: message list, input, send handler wiring `loop.ts`, tool-status pill, streamed text, and the render boundary - for a `getAggregateStats` result it calls `toStatusBars(toolResult.data)` in the shell and passes the `StatusBar[]` (plus the `total` / `avgDuration` KPI scalars) into the pure `StatusBreakdownChart`; `toolResult.data` itself stays the raw typed `AggregateStats`, which is what the loop feeds back to the LLM. A minimal hand-rolled `ErrorBoundary` (a ~15-line class, no new dep) wraps the rendered assistant result/chart so a render-time throw (e.g. Recharts on malformed data) degrades to a "couldn't render this result" fallback instead of unmounting the whole app - this is the third failure mode, beyond tool errors and LLM-channel errors (both handled in `loop.ts`), and a component cannot catch its own render throw, so the guard must be a parent boundary in the shell. Covered by a "component bomb" render test (a deliberately-throwing child -> fallback shown, error not propagated; the test spies on `console.error`, which React still calls for a caught boundary error, to keep output pristine). Fancier boundary behavior (retry, per-widget isolation granularity) is Phase 2. Minimal plain styling (shadcn is Phase 2).
9. (T5 verify) add Playwright; one e2e (`e2e/`): mock OpenRouter (both turns), real Convex (`getAggregateStats`, no args); assert the pill appears, text streams in, and the chart renders a stable known value (`succeeded = 24` / `total = 39`) - stable because the all-time stats do not depend on wall-clock proximity to the seed.

## Testing approach

- Unit (Vitest): the pure calculations - `validate`, the OpenRouter parsing. Fast, offline, deterministic.
- Integration (Vitest): `loop.ts` with injected fakes; assert state transitions and the error path.
- E2E (Playwright): mock the LLM (non-deterministic, costs tokens), real Convex (proves the typed-`api` wiring end to end, like a REST integration test against a real test DB).
- Behavior, not implementation: assert what the admin experiences (pill shows, text streams, chart renders), not that a function was called.
- Edge cases to cover as the relevant seam lands: OpenRouter request fails, Convex call fails, LLM returns invalid args, LLM names an unknown tool. Each should surface gracefully in the chat, never crash.

## Verification (Phase 1)

1. `bun run dev`; type "give me an overview of how our agent runs are doing" -> tool-status pill, a streamed sentence, and a rendered Recharts bar chart of succeeded / active / failed. Type "hi" -> streamed reply, no tool call.
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

### Atomic commit list (Phase 2 continues Phase 1's numbering)

Commits 10+ continue the Phase 1 sequence (0-9 above), so the whole build is one trackable list - the current stage is always a single number.
These Phase 2 entries are provisional: the order holds, but exact boundaries may shift as Phase 1 reality lands (re-confirm when Phase 1 is done).
Each item is one green beat with its test, per the commit-boundary rule in the methodology. The feature subsections below carry the design detail for these commits.
Tier note: Phase 1 built one tier per commit (data -> calc -> action -> UI -> verify) to prove the spine bottom-up. Phase 2 commits are per-feature verticals on that proven spine, so most span several tiers in one beat - the tags below show each commit's span.
Suggested PR seams: 10-13 (foundation: design system, prompt, loop, markdown), 14-20 (tools + mutations), 21-26 (drill-in, navbar, context, cost, DESIGN.md).

10. (T4 UI) Design system: `npx shadcn init` (Tailwind 4) + import the reusable `phillips-poc` ui components + dark palette with construction-orange `--primary` + delete the throwaway Phase 1 CSS. One clean foundation commit; the Phase 1 render/e2e tests stay green.
11. (T2 calc) `src/lib/prompt.ts` `buildSystemPrompt({ now })` pure fn + unit test (date injected, load-bearing rules present); wire it into the loop's system message.
12. (T3 action) Loop multi-step hardening: `MAX_STEPS` cap + errors-fed-back-as-tool-results + reason-bearing failure, with integration tests (scripted fake LLM: two-step happy path, cap-hit termination, tool-error fed back, LLM-channel error aborts).
13. (T4 UI) Markdown rendering: `react-markdown` + `remark-gfm` for assistant prose + GFM tables in the message renderer + render test.
14. (T2->T4 calc->action->UI) Tools: `invocationEvents.getAggregateTokenUsage` (`.action()`, line chart) + `dashboard.dailyUniqueUsers` (daily-active-users bar series - the brief's literal example, reusing Recharts; known-sparse against the frozen seed, so call it `days: 90` and do not assert a specific value) - `validate` + unit tests, `run`s, renders + render tests.
15. (T2->T4 calc->action->UI) Tool: `invocations.listRecent` - `validate` + test, `run`, table render (filter to failed for "show me recent failed runs") + render test. (`getAggregateStats` is already wired in Phase 1; its KPI is reused here, not re-added.)
16. (T2->T3 calc->action) Resolver tool: `groups.getAll` wired as `listConversations` (returns `{ name, jid }`) - `validate` (no args) + `run`. It is the only tool exposing the `jid`/`chatJid` bridge (`listSignedUpUsersForAdmin` returns `personId`, not `jid`), and it is the companion read for the synthesis flow - the way commit 18's `listAll` is the companion for the mutation.
17. (T2->T3 calc->action) Tool: `messages.listByChatJid` - `validate` (chatJid non-empty string; a wrong jid returns `[]`, fed back as self-correction) + test, `run`; the synthesis prose flow ("what's X been talking about" -> `listConversations` resolves the jid -> bounded window -> summary), rendered by the existing markdown path. The dependency hint ("chatJid must come from listConversations") lives in the tool description, not the system prompt.
18. (T2->T4 calc->action->UI) Tool: `intelligenceTaskDefs.listAll` - `validate` + test, `run`, render (companion read for the mutation's name -> id resolution).
19. (T2->T3 calc->action) Mutation: `pause` + `resume` - `validate` + test, `run`; the LLM-driven `listAll -> pause` multi-step works end to end (satisfies Should #10). Mutation safety is three thin layers, not `validate` alone: structural `validate` (well-formed id), a confirm-on-ambiguity prompt rule (added in commit 11), and a named acknowledgment (the `run` returns the patched doc, so the LLM states "Paused <name>" and a wrong target is visible immediately).
20. (T2->T4 calc->action->UI) Mutation (stretch): `enqueue` + undo-send window - `validate` + test, `run` deferred behind a client-side timer (the undo pill is the UI); fake-timer integration test (fires on elapse, never on undo).
21. (T2 + T4 calc + UI) Transcript Sheet component: right-side slide-over (greyed composer, dated banner, shaded background, two-sided bubbles via `isFromMe`) + the time-gap separator pure fn + unit test.
22. (T3->T5 action->UI->verify) Wire the drill-in: a "View full transcript" button on synthesis answers opens the Sheet; add the `getReplyLineage` tool (deeper thread, full Should #7); one e2e drill-in.
23. (T4 UI) Navbar: reproduce MonsterClaw's IA; in-scope items seed conversations into the composer; out-of-scope (Leads, Marketing) disabled with a tooltip + non-color cues.
24. (T2 calc) Context-stubbing compactor: pure fn (stub tool-result content between turns, preserve the `tool_call`/`tool_result` pairing) + unit test; wire into history management.
25. (T3->T4 action->UI) Cost breakdown by Go Deep run (Nice #13): `overnightBriefRuns.listCostRollups` then fan out to `getRunUsage` per run, + render.
26. (T5 verify) Final `DESIGN.md` editing pass + full verification (lint exits 0, unit + integration + e2e green, `vite build` clean, `check:backend` green).

### The multi-step agentic loop (hardening)

- Name -> id resolution is LLM-driven (Approach A), used for both writes (`listAll` -> `pause`) and the synthesis read (`listConversations` -> `listByChatJid`): the model calls the companion list tool, reads the result, then calls the target tool with the resolved id/jid.
  Our code does not string-match names. Every tool's `validate` is the structural net: it throws a descriptive error on unknown keys (never silently dropping them) and on mistyped args, which feeds the loop - but it is not the wrong-target net, since a valid-but-wrong id/value passes it; guarding the target is the job of the confirm-on-ambiguity rule and the named acknowledgment (see Mutation UX).
  This keeps a brittle resolver out of our code and exercises real multi-turn tool-calling.
- `MAX_STEPS` cap (~5) guarantees the loop terminates and bounds per-message cost; hitting it surfaces a graceful, reason-bearing message.
- Tool-layer errors (a `validate` throw, a failed Convex call) are fed back to the LLM as that tool's result so it can self-correct; only an unreachable-LLM error aborts the turn.
- Every failure carries its specific cause: `validate` and tools throw descriptive errors, and the thrown message is the reason the chat shows (upgrades Should #9 from "doesn't crash" to "doesn't crash and says why").
- No chained mutations: flows are reads-then-one-terminal-write, so there is never a half-applied mutation to roll back.
  If two writes ever had to be atomic, that belongs in a single Convex mutation, not two tool calls the LLM chains.

### Mutation UX

- `pause` / `resume` fire directly (reversible, so no grace period), but the wrong-target risk is guarded by three thin layers, each with one job:
  (1) structural - `validate` rejects a malformed id; (2) intent - a prompt rule makes the LLM name the resolved target and confirm before firing if the resolution was at all ambiguous (the unambiguous case still fires one-shot); (3) detection - the `run` returns the patched doc (which carries `name`), so the acknowledgment states "Paused Daily Project Accounting" and a mis-resolution is visible and reversible immediately.
  Do not bloat `validate` to look up and second-guess the id - the LLM controls its inputs, so that cannot fully work; keep `validate` structural and add the thin intent/detection layers instead.
- `enqueue` carries a 5-second undo-send window (`undoWindowMs: 5000`): the loop defers the Convex call behind a client-side timer, so nothing reaches the backend until it elapses.
  Undo clears the timer; both fire and cancel feed a tool result back to the LLM so it closes the turn.
  Delivery is inert on the preview deployment (no real channel credentials per `API.md`), so this is a judgment showcase, not a live safety mechanism - note that in `DESIGN.md`.
- Ambiguity (Should #8) is handled at the prompt level for all tools: when the target is unclear ("which task?", "which user?"), the LLM asks rather than guesses. On writes this becomes layer (2) above - name the resolved target and confirm before firing.

### Rendering and conversation context

- Tables render in-chat via `react-markdown` + `remark-gfm`: the LLM emits GFM table syntax in its prose, rendered as a React subtree (safe inline, no raw HTML, no sandbox).
  Charts render as Recharts components keyed off the typed tool result, not through markdown.
- Two stores, kept distinct: the UI message list (what the admin sees - prose + rendered charts/tables) and the LLM message array (what is sent to OpenRouter - system prompt, tool calls, tool results).
- Conversation context (Should #7) keeps full prose continuity, but once a turn completes, bulky tool-result content is stubbed (e.g. "[chart data rendered]") to bound token growth.
  We stub rather than delete because the API rejects a `tool_call` with no matching tool-result message.
  Windowing + summarization is the production scale-up, omitted here because admin sessions are short (noted in `DESIGN.md`).
- Time-window vocabulary mirrors the tools' filters (`24h / 7d / 30d / 60d / 90d`): the LLM maps "this week" -> 7d, "this month" -> 30d. Caveat surfaced by the probe: tools filter on two time bases - invocation tools on `_creationTime` (insert time, near now), message/usage tools on the frozen semantic `timestamp`/`createdAt` - so a relative window means different things per tool. Default the seed-frozen tools (e.g. `dailyUniqueUsers`) wide (`days: 90`); the Phase 1 steel-thread tool (`getAggregateStats`, no `after`) sidesteps this by being all-time.

### System prompt

- A dynamic `buildSystemPrompt({ now })` pure function in `src/lib/prompt.ts`; the current date is injected so the LLM resolves relative windows ("this week" -> 7d) against the seeded data, not its training cutoff.
- Tool descriptions live in the tool schemas (the `tools` param), not the prompt; the prompt owns only cross-cutting behavior.
- Minimal, load-bearing rules only: role, injected date, ambiguity -> ask (Should #8), confirm-the-target-before-a-name-resolved-write (the intent layer of Mutation UX), single-newline + GFM-table output (brief line 78), and an anti-fabrication rule ("only state figures returned by tools; never invent numbers").
  The anti-fabrication rule is the highest-value line for a data tool - a confidently wrong number is worse than a crash.
- No few-shot examples and no tool list in the prompt; add a rule only when a test or a real interaction proves the model needs it.

### Conversation drill-in: synthesis vs browsing

Two distinct features with two output paths, deliberately not merged:

- Synthesis (the default for "what's Maya been talking about", "where did we leave off", "what's on the agenda"): the LLM reads a bounded `listByChatJid` window and answers in prose.
  No special component; this is the headline conversational value and the brief's own example (line 23).
- Literal message browsing (Nice #12): a separate, explicitly requested "show me the transcript" action that renders the messages as a component, not prose.

The transcript drill-in (the browsing component):

- Opens in a right-side Sheet (slide-over), triggered by a "View full transcript" button on a synthesis answer - never auto-opened, so a multitasking admin is never locked out of their current task.
- A Sheet over a modal or a new view: no router (we have none), it preserves the conversation underneath, and it matches "inspect then return" semantics.
- Read-only affordances make it unambiguously a transcript, not the admin's own chat: greyed/disabled composer + "Viewing User X's transcript - DATE" banner, a shaded background, two-sided bubbles via `isFromMe`, and iMessage-style time separators inserted where the gap between consecutive `timestamp`s exceeds a constant (~20-30 min) - a pure calculation, unit-testable.
- `getReplyLineage` is the deeper "show the thread around this message" drill (full Should #7), not part of the first drill-in.

### Navbar: conversation seeders, not dead links

- Reproduce MonsterClaw's nav (Overview, Leads, Groups, Tokens & Cost, Users, Intelligence, Marketing, Direct Messages) for fidelity, but make it functional without a router.
- In-scope items seed a conversation rather than navigate: clicking "Tokens & Cost" drops "Show me token usage and cost this month" into the composer.
  This doubles as cold-start discoverability - it teaches a new admin what they can ask, instead of facing an empty chat.
- Out-of-scope items (Leads = CRM/Mapbox, Marketing = no backend) are visibly disabled: a muted shade plus redundant non-color cues (reduced opacity, `cursor: not-allowed`, a "Not in this build" tooltip), so the disabled state reads as intentional scoping and stays accessible.
- No per-item views or data screens behind the nav; the nav seeds chats, the chat does the work.

### Testing (Phase 2)

Extends the Phase 1 approach: most new logic is pure and unit-tested, the loop is covered at the integration level, and E2E stays at one or two whole journeys.

- Unit (pure calculations): `buildSystemPrompt({ now })` (date injected, load-bearing rules present); the transcript time-gap separator (separators appear only where the gap exceeds the threshold); the context-stubbing compactor (tool-result content stubbed, but the `tool_call`/`tool_result` pairing preserved - the test locks the reason we stub rather than delete); each new tool's `validate`.
- Integration (the loop, driven by a scripted fake LLM that returns a queue of responses): the multi-step `listAll -> pause` happy path and the `listConversations -> listByChatJid` synthesis-resolution path; the wrong-target confirm (an ambiguous resolution makes the fake confirm before firing); the `MAX_STEPS` cap (a fake that always calls a tool -> graceful termination); errors-as-observations (a tool throw is fed back and the loop continues, while an unreachable-LLM error aborts); and the `enqueue` undo-send window with fake timers + a spied Convex client (fires once the window elapses, never fires if undo is triggered first).
- E2E (Playwright): one happy-path journey (type -> tool pill -> streamed answer -> rendered chart/table) plus one drill-in (synthesis -> "View transcript" -> Sheet opens). No E2E per tool; confidence comes from unit + integration.

| Phase 2 work item                                        | Convex function(s)                                                                                          | Criteria closed                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Expand the tool registry to 7+ tools                     | the rows below + Phase 1 `getAggregateStats`                                                                | **Must #3** (>=5 tools) - the big remaining must-have                                                    |
| Pause/resume a scheduled task (the mutation)             | `intelligenceTaskDefs.pause` / `resume`                                                                     | **Should #10**                                                                                           |
| Clarify ambiguous requests (which user? which window?)   | loop/prompt UX, no new backend                                                                              | **Should #8**                                                                                            |
| Drill into a specific user's chat                        | `groups.getAll` (resolver) -> `messages.listByChatJid`                                                      | **Nice #12**                                                                                             |
| Reconstruct a user's reply thread on drill-in            | `messages.getReplyLineage`                                                                                  | **Should #7** (upgrades partial → full)                                                                  |
| Multiple chart types (line, bar, table) reusing Recharts | `getAggregateTokenUsage` (line), `dashboard.dailyUniqueUsers` (daily bar), `invocations.listRecent` (table) | **Nice #11**                                                                                             |
| Cost breakdown by Go Deep run                            | `overnightBriefRuns.listCostRollups` then fan out to `getRunUsage`                                          | **Nice #13**                                                                                             |
| `npx shadcn init` + UI polish                            | none (UI layer)                                                                                             | no numbered criterion, but directly serves evaluation axis #2 "does it feel like a real tool, not a toy" |
| Write `DESIGN.md`                                        | none                                                                                                        | **Nice #14**                                                                                             |

Note: there is deliberately no whole-project `tsc` gate. The given `convex/` backend source does not type-check, and the generated `api.d.ts` pulls those modules into any `tsc` run, so a clean compile is impossible without editing given code. Type safety on `src/` comes from type-aware ESLint plus the editor's TypeScript server.
