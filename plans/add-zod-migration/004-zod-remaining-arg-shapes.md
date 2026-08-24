---
linear: ETH-45
linear_url: https://linear.app/mite404-workspace/issue/ETH-45/cover-the-four-argument-shapes-the-simple-case-did-not
github: 24
filed: 2026-08-24
---

# Cover the four argument shapes the simple case did not

## Status

- **Goal**: Schemas and binds for `listRecent`, `listByChatJid`, `getAggregateTokenUsage`, and `listConversations`.
- **Initial priority**: P2
- **Effort**: Medium
- **Risk**: MED
- **Category**: refactor
- **Planned at**: commit `12b44d2`, 2026-08-24
- **Teaching detail**: `docs/zod-migration-tutorial.md`, Phase 4

## Why this matters

`getAggregateStats` is two optional primitives. Four other tools are not, and each fails differently if translated carelessly. `listRecent` also cannot bind to `FunctionArgs` at all, which is the one case where the migration's core assumption does not hold.

## Current state

- `src/lib/tools.ts:229-247` — `listRecent`, with a hand-rolled enum check against `INVOCATION_STATUSES`.
- `src/lib/tools.ts:354` — `listByChatJid`, required non-blank string; `tools.test.ts:143-146` requires both `""` and `"   "` to throw.
- `src/lib/tools.ts:169` — `getAggregateTokenUsage`, where `after` defaults to `0`; pinned by `tools.test.ts:62-66`.
- `src/lib/tools.ts:304` — `listConversations`, takes no arguments; `tools.test.ts:120-123` requires any argument to throw.

## Approach

`z.enum(INVOCATION_STATUSES)` rather than retyping the four status strings, since retyping would create a fourth copy of a shape in a migration whose whole purpose is removing copies.

`z.string().trim().min(1)` in that order. Zod applies refinements left to right, so trimming first turns `"   "` into `""` and the length check rejects it. The reverse order passes the empty-string test and fails the whitespace test, and the failure gives no hint that ordering is the cause.

`listRecent` binds to `ListRecentToolArgs` (`types.ts:138-141`), the intersection, not to `ListRecentArgs`. `status` is app-level: `runListRecent` at `tools.ts:249-257` strips it before the Convex call and filters in our own code. Binding to `FunctionArgs` directly would reject the schema for declaring a field the backend does not have, correctly.

No shared `makeToolSchema` wrapper. Four call sites that all begin with `strictObject` and share nothing else are four different things, and a wrapper would hide the field list, which is the only part anyone reads.

## Scope

- In: `src/lib/toolSchemas.ts`, `src/lib/tools.ts` (four registry entries)
- Out: changing any existing assertion in `tools.test.ts`. If a test needs its assertion changed rather than its subject, that test is pinning behaviour the model depends on. Stop and report.
- Out: `convex/`.

## Steps

- `listConversations` first, since it is one line and immediately proves whether `strictObject` was understood.
- `getAggregateTokenUsage` next: `.default(0)` changes the output type, so let the bind error tell you what the parsed value actually is.
- `listByChatJid`, minding refinement order.
- `listRecent`, binding to the intersection.

## Test plan

- `./node_modules/.bin/vitest run src/lib/tools.test.ts` passes every existing assertion, including the whitespace pair at `tools.test.ts:143-146`.
- `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` prints `0`.

## Done when

- Four schemas exist, each with its own bind on the adjacent line.
- No existing test assertion was edited.

## Notes

Risk MED: the refinement-order trap fails one test with a message that does not point at the cause. Depends on 003.
