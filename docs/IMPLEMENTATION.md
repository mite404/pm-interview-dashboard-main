# Implementation Log

One entry per commit, newest on top. Rationale: `docs/PLAN.md`.

---

## Commit 8 - The app shell: wire the thread end to end (T4)

`src/App.tsx`: the composition root. Input -> `runTurn` -> streamed text + tool-status pill + rendered chart. The thread now runs top to bottom.

- Builds the loop's real deps: `decideTool`/`streamAnswer` (OpenRouter) + `makeRunTool(registry, { convex })` + `toOpenRouterTools(registry)` - the `runTool`/tools builders deferred from commit 6, added to `tools.ts`.
- Two stores kept distinct: the on-screen `ChatMessage[]` and the per-turn OpenRouter `WireMessage[]` (system prompt + prose history) fed to the loop.
- Render boundary: for a tool result it calls `toStatusBars(result.data)` in the shell (never in the chart) and passes `StatusBar[]` + KPI scalars into `StatusBreakdownChart`. Phase 1 has one `ToolResult` shape so it renders directly; Phase 2's union will force a discriminant switch (compiler-enforced).
- `ErrorBoundary` (minimal class) wraps each rendered chart -> a render throw degrades to "couldn't render this result" instead of unmounting the app. Covered by the component-bomb test (`ErrorBoundary.test.tsx`): throwing child -> fallback shown; silences React's `console.error` and marks the re-dispatched `error` event handled to keep output pristine.
- Minimal top-level system prompt (anti-fabrication rule); dynamic `buildSystemPrompt` is Phase 2. `main.tsx` drops the unused `ConvexProvider` (the loop uses `ConvexHttpClient` directly).
- No unit test for `App`/the registry builders (wiring) - proven by the commit-9 e2e.

Gate: `bun run test` 24/24 (pristine), `src/` lints clean, `bun run build` bundles (530 kB - Recharts now included; lazy-load is a Phase 2 optimization).

---

## Commit 7 - StatusBreakdownChart + Recharts (T4)

`src/components/StatusBreakdownChart.tsx`: a pure presentational bar chart. Recharts installed just-in-time.

- Props: an already-transformed `StatusBar[]` (imported from `types.ts`, never `tools.ts`) + the `total` / `avgDuration` KPI scalars. No logic - `toStatusBars` runs in the shell (commit 8), so the chart just draws.
- Render test (`StatusBreakdownChart.test.tsx`, first jsdom test): mocks Recharts to simple markers (it needs a real layout engine jsdom lacks) and asserts what's ours - the KPI text renders and all three bars reach the chart. The visual bars are verified by eye / the e2e (commit 9), not here.
- Vitest test infra, just-in-time: `@testing-library/react` + `jsdom`; the render test opts into jsdom per-file (`// @vitest-environment jsdom`) so the calc/parse tests stay in the fast `node` env; JSX is transformed by Vitest 4's built-in oxc (no React plugin, no deprecation warnings).

Gate: `bun run test` 22/22 (pristine), `src/` lints clean, `bun run build` bundles.

---

## Commit 6 - The conversational loop (T3)

`src/lib/loop.ts`: `runTurn` - the orchestrator that ties the pieces together (decide a tool -> run it -> feed the result back -> stream the answer). Fully dependency-injected: it imports no services, so it runs against fakes in tests and real ones in the shell.

- Bounded `while` loop over tool calls, then a terminal `streamAnswer`. Phase 1 caps at `maxSteps = 1` (decide -> run -> answer); Phase 2 is purely additive (raise the cap to chain tools).
- Error ownership split: a **tool** error is surfaced here (graceful message, pill -> `error`, no stream, no crash); an **LLM-channel** error propagates to the shell's top-level try/catch (commit 8).
- `loop.test.ts` (3 integration tests, TDD): happy path (tool runs, result fed back into the messages, answer streams, pill `calling -> done`), no-tool path (direct answer, no pill), and the error path (tool throws -> reason surfaced, no stream). Fakes stand in for whole subsystems - real behavior, not mock-call assertions.
- Real `runTool` / tools-array builders are deferred to the shell (commit 8); the loop needs only the injected fakes here.

Gate: `bun run test` 21/21, `src/` lints clean, `bun run build` bundles.

---

## Commit 5 - OpenRouter calls + tool-name convention (T3)

The two LLM network calls, plus the bare tool-name decision going live.

- `decideTool(messages, tools)` - non-streamed routing turn; `parallel_tool_calls: false` (at most one call), returns `extractToolCall(...)`. Throws on a failed call (unreachable LLM aborts the turn).
- `streamAnswer(messages, onDelta)` - streamed answer turn; calls `onDelta` per fragment, returns the full text.
- `drainSSEBuffer(buffer, chunk)` - **pure**, test-driven (2 tests): reassembles `data:` lines split across network reads (the stateful gluing `extractTextDeltas` punts on). Extracted precisely because the e2e mock may never split a line, so this real risk gets its own check.
- `decideTool` / `streamAnswer` are thin I/O - no unit test (mocking `fetch` asserts the mock), proven by the commit-9 e2e.
- Naming convention live: `getAggregateStatsTool` assembled in `tools.ts` with `name: "getAggregateStats"` (bare fn name); `ToolResult.tool` and the two `openrouter.test.ts` fixtures updated to match. Dotted path survives only as the `api.invocations.getAggregateStats` accessor.
- `WireMessage` / `OpenRouterTool` wire types added (LLM-facing, distinct from `ChatMessage`).
- Model is a single swappable constant (`anthropic/claude-3.5-sonnet`).

Gate: `bun run test` 16/16, `src/` lints clean, `bun run build` bundles.

---

## Commit 4 - Convex client + the tool's `run` (T3)

The action tier: the tool can now hit the real backend.

- `src/lib/convexClient.ts` - one `ConvexHttpClient` built at module scope from `VITE_CONVEX_URL`. Browser-direct in Phase 1.
- `run(args, deps)` in `tools.ts` - delegates to `deps.convex.query(api.invocations.getAggregateStats, args)`. Dependency-injected, so the app passes the real client and tests pass a fake; the pure calcs above stay network-free.
- No new unit test by design (the plan omits one for this seam): `run` is a one-line typed delegation, already proven live by commit 0's probe and covered downstream by the loop integration test (commit 6) and the e2e (commit 9). A client-mocking unit test would assert the mock, not behavior.

Gate: `bun run test` 14/14, `src/` lints clean, `bun run build` bundles.

---

## Commit 3 - OpenRouter parsing helpers (T2)

`src/lib/openrouter.ts`: two pure functions that read OpenRouter's wire format, test-driven (`openrouter.test.ts`, 5 tests). No network - `fetch`/SSE plumbing is commit 5.

- `extractToolCall(response)` - routing-turn body -> `ToolCall | null` (null = the model answered in prose). Parses the `arguments` JSON string to an object so the downstream `validate` gets an object; throws on malformed JSON so the loop can feed the reason back.
- `extractTextDeltas(sse)` - answer-turn SSE text -> ordered `content` fragments; skips comment keep-alives, `[DONE]`, contentless deltas, and partial (unparseable) lines.
- Untrusted input is `unknown`, narrowed with small `asRecord`/`asArray` guards - no `any`, no casts to a hand-wavy shape.

Gate: `bun run test` 14/14, `src/` lints clean.

---

## Commit 2 - Calc layer + Vitest (T2)

`src/lib/tools.ts`: the two pure calculations for `getAggregateStats`, test-driven (`tools.test.ts`, 8 tests). Vitest installed just-in-time.

- `validate(raw)` - the graded LLM->Convex boundary: untyped JSON in, typed args out, or a descriptive throw. Registry-wide convention - rejects non-objects, mistyped `after`/`groupFolder`, and any unknown key (named in the error so the loop can self-correct).
- `toStatusBars(stats)` - derives the three chart bars (`succeeded` / `active` / `failed = finishedCount - succeeded`), which sum to `total`. Its output type `StatusBar` lives in `types.ts` (the cross-layer contract the future chart imports), not in `tools.ts`.
- Vitest config is `node`-only with no React plugin; jsdom + React arrive with the first render test (commit 7).

Gate: `bun run test` 8/8, `src/` lints clean.

---

## Commit 1 - Data layer types (T1)

`src/lib/types.ts`: the pure shapes the steel thread builds on. No runtime logic, no test.

- `ChatMessage` / `ToolStatus` - UI message + status-pill state (Must #6).
- `ToolResult` - tool output, keyed by tool name (extended per tool in Phase 2).
- `Tool<Args, Data>` / `ToolDeps` - registry entry with injected deps; `validate` is the graded LLM->Convex boundary.
- `AggregateStats` / `AggregateStatsArgs` - sourced from the typed `api`, so they can't drift from the backend.

Out of scope: the OpenRouter wire-message type (lives in `openrouter.ts`, a later commit). Gate: `src/` lints clean.

---

## Commit 0 - Tool-contract probe (T0)

`scripts/probe-tools.ts`: read-only script that calls every non-mutation tool and prints its real return shape - the contract, since the checked-in `convex/` source doesn't match the live deployment.
