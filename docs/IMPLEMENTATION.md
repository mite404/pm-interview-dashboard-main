# Implementation Log

One entry per commit, newest on top. Rationale: `docs/PLAN.md`.

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
