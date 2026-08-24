---
linear: ETH-44
linear_url: https://linear.app/mite404-workspace/issue/ETH-44/replace-the-hand-written-validators-keeping-the-message-the-model
github: 23
filed: 2026-08-24
---

# Replace the hand-written validators, keeping the message the model reads

## Status

- **Goal**: One `makeValidator(toolName, schema)` factory replacing ten hand-written `validate*` functions, with thrown messages that still name the tool.
- **Initial priority**: P2
- **Effort**: Medium
- **Risk**: MED
- **Category**: refactor
- **Planned at**: commit `12b44d2`, 2026-08-24
- **Teaching detail**: `docs/zod-migration-tutorial.md`, Phase 3

## Why this matters

`src/lib/loop.ts:123` reads `error.message` and `loop.ts:125` pushes it onto the wire as a `role: "tool"` message so the model can self-correct. That message is an input to another system, not a log line, so its shape is an API contract.

A raw `ZodError.message` names the offending key but never names the tool. With twelve tools registered, a model reading `Unrecognized key: "days"` cannot tell which of its calls was wrong.

## Current state

Ten near-identical validators at `src/lib/tools.ts:102`, `:169`, `:229`, `:304`, `:354`, `:413`, `:454`, `:545`, `:644`, `:784`, each built from the shared helpers `asArgsRecord`, `assertKnownKeys`, `optionalNumber`, `optionalString`.

## Approach

A generic factory returning `(raw: unknown) => z.infer<S>`, using `safeParse` and flattening `error.issues` into one line prefixed with the tool name.

`safeParse` rather than `parse` in a try/catch, because a validation failure is the graded path here, not an exception. Keeping it in the return value leaves the function a Calculation with a single throwing exit.

All issues are reported, not just the first: the model gets one message and takes one more step, and `loop.ts:129-135` caps the loop at five steps, so one problem at a time turns a single correction into three round trips.

Checked before writing this: the existing suite asserts on regexes (`toThrow(/days/)`, `/failed/`, `/chatJid/`), not exact strings, and all of them pass against a raw `ZodError.message`. That means a bare `schema.parse(raw)` would turn the suite green while dropping the tool name, which no test covers. A new test asserting the tool name is part of this ticket, not optional.

## Scope

- In: `src/lib/toolSchemas.ts`, `src/lib/tools.ts`, `src/lib/tools.test.ts`
- Out: `src/lib/loop.ts`. The three-way error policy at `loop.ts:8-12` is correct and must not change. Editing it means the message shape is wrong; fix that instead.
- Out: the `ToolResult` union and the `App.tsx` switch. Return types are unchanged; only the argument boundary moves.

## Steps

- Add `makeValidator<S>(toolName, schema)` to `toolSchemas.ts`.
- Rebuild `validateAggregateStats` from it, keeping the export name so call sites and tests are untouched.
- Add a test asserting a validation error message begins with the tool name.

## Test plan

- `./node_modules/.bin/vitest run src/lib/tools.test.ts` passes, count unchanged or higher.
- The new tool-name test fails if the prefix is removed.
- `npm test` prints `Tests 141 passed (141)` or higher.

## Done when

- `validateAggregateStats` is three lines built from the factory.
- A test pins the tool name in the message.

## Notes

Risk MED: this is the phase that can pass its tests while losing behaviour. The reviewer should check the tool-name prefix specifically, since no pre-existing assertion covers it. Depends on 001 and 002.
