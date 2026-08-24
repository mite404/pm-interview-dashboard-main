---
linear: ETH-43
linear_url: https://linear.app/mite404-workspace/issue/ETH-43/generate-the-model-facing-json-schema-from-the-zod-schema
github: 22
filed: 2026-08-24
---

# Generate the model-facing JSON Schema from the Zod schema

## Status

- **Goal**: Replace the hand-written `parameters` literal on `getAggregateStatsTool` with `toParameters(aggregateStatsSchema)`.
- **Initial priority**: P2
- **Effort**: Small
- **Risk**: LOW
- **Category**: refactor
- **Planned at**: commit `12b44d2`, 2026-08-24
- **Teaching detail**: `docs/zod-migration-tutorial.md`, Phase 2

## Why this matters

`RegisteredTool.parameters` at `src/lib/types.ts:175` is the model's only description of what a tool accepts. It goes out via `toOpenRouterTools` at `tools.ts:864-874`. Today it is a 16-line object literal typed by hand, which is the copy most likely to drift, because nothing reads it except an external system that cannot complain.

## Current state

`src/lib/tools.ts:143-158` holds the literal. It duplicates every field name and description already present in the Phase 1 schema.

## Approach

A pure `toParameters(schema)` that calls `z.toJSONSchema` and drops the `$schema` key OpenRouter does not want.

Chosen over keeping the literal and adding a conformance test: a test detects drift after someone writes it, deleting the literal makes drift impossible. `assets/drift-check.ts` in the teaching workspace already does the test version, and it found 0 drift while proving nothing about the future.

Verified before writing this: `z.toJSONSchema` on a `strictObject` with `.describe()` calls emits `type`, `properties` with descriptions, and `additionalProperties: false`, which is the existing literal exactly.

## Scope

- In: `src/lib/toolSchemas.ts`, `src/lib/tools.ts` (one registry entry)
- Out: the tool `description` strings. They move verbatim in later phases; rewording them is a separate ticket and would make this diff unreviewable.
- Out: `src/lib/loop.ts`.

## Steps

- Add `toParameters(schema): Record<string, unknown>` to `toolSchemas.ts`.
- Swap `getAggregateStatsTool.parameters` to call it and delete the literal.

## Test plan

- `npm run probe:backend` prints `12 tools checked`.
- `./node_modules/.bin/vitest run src/lib/tools.test.ts` passes unchanged.
- `grep -c "additionalProperties" src/lib/tools.ts` drops by one.

## Done when

- No hand-written `parameters` literal remains on `getAggregateStatsTool`.
- The probe still reports 12 tools checked.

## Notes

Risk LOW, with one external unknown: `z.toJSONSchema` output has not been sent to OpenRouter in production. If the probe passes but live calls degrade, bring the emitted object back rather than guessing at a transform. Depends on 001.
