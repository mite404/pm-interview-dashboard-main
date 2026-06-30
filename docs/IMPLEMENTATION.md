# Implementation Log

One entry per commit, newest on top. Rationale: `docs/PLAN.md`.

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
