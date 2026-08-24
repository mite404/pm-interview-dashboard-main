---
linear: ETH-46
linear_url: https://linear.app/mite404-workspace/issue/ETH-46/migrate-the-remaining-eight-tools-and-delete-the-hand-rolled-helpers
github: 25
filed: 2026-08-24
---

# Migrate the remaining eight tools and delete the hand-rolled helpers

## Status

- **Goal**: Every registry entry derives its `parameters` and validator from one Zod schema, and the four hand-written validation helpers are gone.
- **Initial priority**: P2
- **Effort**: Medium
- **Risk**: MED
- **Category**: refactor
- **Planned at**: commit `12b44d2`, 2026-08-24
- **Teaching detail**: `docs/zod-migration-tutorial.md`, Phase 5

## Why this matters

Until all twelve tools are migrated the codebase carries both systems, which is worse than either. The helpers at `src/lib/tools.ts:56-98` stay reachable, and a thirteenth tool could be written against the old pattern without any signal that it is the old pattern.

## Current state

Eight tools remain: `listAll`, `pause`, `resume`, `enqueue`, `getReplyLineage`, `listCostRollups`, `dailyUniqueUsers`, and the shared `validateTaskDefId` at `tools.ts:454` that `pause` and `resume` both use.

`listCostRollups` is the one with a required rather than optional `after` (`types.ts:159-161`). `dailyUniqueUsers` carries a `lane` enum (`types.ts:164`).

## Approach

One tool per commit. The suite runs in 1.55 seconds, so batching buys nothing and costs bisect time.

`pause` and `resume` get one shared `taskDefIdSchema` and two validators built from it. Two schemas would let two tools that must accept identical arguments drift apart; the tool name differs only in the error message, which is exactly what a factory parameter is for.

Helpers are deleted on evidence, not belief: `grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/` must return only the definitions before they are removed.

## Scope

- In: `src/lib/toolSchemas.ts`, `src/lib/tools.ts`
- Out: `assets/drift-check.ts` in the teaching workspace. It becomes redundant once the bind covers all twelve tools, but it lives outside this repo. Note it, do not delete silently.
- Out: `convex/` and its 6 pre-existing type errors.

## Steps

- Migrate the eight remaining tools, one commit each, running `vitest run src/lib/tools.test.ts` after every one.
- Prove the four helpers are unreferenced, then delete them.

## Test plan

- `npm test` prints `Tests 141 passed (141)` or higher.
- `npm run lint` prints `0 errors` and no more than 21 warnings.
- `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` prints `0`, and `grep -c "^convex/"` still prints `6`.
- `npm run dev` in one terminal, `npm run test:e2e` in another, all specs pass.
- `git status --porcelain` lists only the files in scope.

## Done when

- `grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/` returns nothing.
- All twelve registry entries call `toParameters(...)` and a factory-built validator.
- Breaking any one schema fails the typecheck.

## Notes

Risk MED, spread across twelve sites rather than concentrated. One commit per tool means a bad one is a single revert. Depends on 004. After this lands, `assets/drift-check.ts` is checking that a value equals itself.
