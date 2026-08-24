---
linear: ETH-42
linear_url: https://linear.app/mite404-workspace/issue/ETH-42/bind-one-tool-schema-to-the-convex-derived-args
github: 21
filed: 2026-08-24
---

# Bind one tool schema to the Convex-derived args

## Status

- **Goal**: Introduce `src/lib/toolSchemas.ts` with a `z.strictObject` for `getAggregateStats` and a
  compile-time assertion that fails the build when it stops matching `AggregateStatsArgs`.
- **Initial priority**: P2
- **Effort**: Small
- **Risk**: LOW
- **Category**: refactor
- **Planned at**: commit `12b44d2`, 2026-08-24
- **Teaching detail**: `docs/zod-migration-tutorial.md`, Phase 1

## Why this matters

`getAggregateStats` declares `{ after?, groupFolder? }` three times: as JSON Schema at
`src/lib/tools.ts:145-157`, as a string array at `tools.ts:104`, and as `AggregateStatsArgs` at
`src/lib/types.ts:122`. Only the third is derived, via `FunctionArgs<typeof
api.invocations.getAggregateStats>`. Nothing connects them. This phase creates the anchor the other
two will later be derived from.

## Current state

`src/lib/tools.ts:102-116` is fifteen lines of hand-written checking for two optional fields. Zod is
already installed at 4.4.3, transitively via `convex`.

## Approach

One `z.strictObject` plus a `Bound<S, Args>` type alias asserting `Required<z.infer<S>>` equals
`Required<Args>`.

`strictObject` rather than `object`: `z.object()` strips unknown keys and returns success, which
would silently disable the hallucination-catching `docs/PLAN.md:78` commits to.

`Required<>` rather than a bare `extends` pair: verified that `Exact<A, B>` compiles clean when a
field is renamed, because every field is optional and a type with extra optional properties is
assignable in both directions. The naive bind checks nothing.

## Scope

- In: `src/lib/toolSchemas.ts` (new), `package.json` (promote `zod` to a direct dependency)
- Out: `src/lib/tools.ts` behaviour. This phase adds the schema and the bind; it does not yet use
  them.
- Out: `convex/`. Supplied brief slice with 6 pre-existing type errors that are not ours.

## Steps

- Create `src/lib/toolSchemas.ts` with `aggregateStatsSchema`, carrying the `.describe()` text over
  verbatim from `tools.ts:145-157`.
- Add the `Exact` and `Bound` type aliases.
- Assert `Bound<z.infer<typeof aggregateStatsSchema>, AggregateStatsArgs>`.
- Add `zod` to `dependencies` so a future `convex` upgrade cannot move the validation library.

## Test plan

- `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` prints `0`.
- Rename `groupFolder` to `lane` in the schema; the same command prints more than `0`. Restore it
  and confirm `0` again. A bind never seen failing is not a bind.
- `npm test` still prints `Tests 141 passed (141)`.

## Done when

- `src/lib/toolSchemas.ts` exists and typechecks.
- Deliberately breaking the schema fails the typecheck.
- `zod` is in `dependencies`, not only the lockfile.

## Notes

Risk LOW: nothing imports the new file yet. Blocks every later phase, which all bind the same way.
