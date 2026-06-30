# Implementation Log

One entry per commit, newest on top. Rationale: `docs/PLAN.md`.

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
