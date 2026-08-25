---
linear: ETH-42
linear_url: https://linear.app/mite404-workspace/issue/ETH-42/bind-one-tool-schema-to-the-convex-derived-args
github: 21
filed: 2026-08-24
parent: ETH-41
plan: 001-zod-bind-schema-to-backend.md
---

# Bind one tool schema to the Convex-derived args

_For the executor: this is the hands-on sheet for `001-zod-bind-schema-to-backend.md`.
The plan file says what to build. This says what to try, in what order, and how to
know you got it right. Work it top to bottom._

> **Where the answer lives.** `zod-migration-tutorial.md`, Phase 1, has a section
> headed `### ✅ Solution` containing the finished file. **Do not open it until
> Step 1.5 tells you to.** Everything you need to write it yourself is here. If
> you read it first, this ticket takes eight minutes and teaches you nothing —
> and Phases 3, 4 and 5 all repeat this same move, so the cost compounds.

**Drift check, run this first:**

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
git diff --stat 12b44d2..HEAD -- src/lib/tools.ts src/lib/types.ts
```

Expected: no output. Any output means this sheet was written against a different
`tools.ts` than the one on disk — re-read the plan file's Current state section
before you start.

**Goal:** `src/lib/toolSchemas.ts` exists, holds one Zod schema for
`getAggregateStats`, and holds a type-level assertion that makes `tsc` fail if
that schema ever stops matching `AggregateStatsArgs`.

**Learning style:** One small stub. Then a deliberate sabotage, because a check
you have never seen fail is not a check.

**Prerequisites:** You can read a TypeScript conditional type. You do not need to
have used Zod. Zod 4.4.3 is already installed transitively via `convex`.

**Estimated time:** ~1h. The file is about twenty lines. The hour is Step 1.3.

---

## Status

- **Initial priority:** P2
- **Effort:** S (1 point)
- **Risk:** LOW — nothing imports the new file when you are done. It cannot break runtime behaviour.
- **Depends on:** nothing
- **Blocks:** ETH-43, ETH-44, ETH-45, ETH-46. Every later phase binds the same way, so a wrong pattern here is repeated eleven more times.
- **Category:** refactor, contract consolidation
- **Planned at:** commit `12b44d2`, 2026-08-24

---

## Why this matters

`getAggregateStats` declares the shape `{ after?: number, groupFolder?: string }`
in three places:

1. `src/lib/tools.ts:145-157` — a JSON Schema object literal, which is what the language model reads
2. `src/lib/tools.ts:102-106` — the `AGGREGATE_STATS_KEYS` array passed to `assertKnownKeys`
3. `src/lib/types.ts:122` — `AggregateStatsArgs`, via `FunctionArgs<typeof api.invocations.getAggregateStats>`

Copy 3 is **derived**. It reads the real Convex function signature, so it updates
itself when the backend changes. Copies 1 and 2 are typed by hand and update when
someone remembers.

Nothing connects them. Add a `lane` parameter to the Convex function and copy 3
changes on its own while copies 1 and 2 keep advertising the old shape. The
compiler says nothing, because a string array and a JSON object literal are each
perfectly valid on their own terms.

This phase does not fix that yet. It builds the **anchor** the fix hangs off: one
schema, plus one line that makes the compiler refuse when the schema and the
backend disagree.

---

## Current state

`src/lib/types.ts:122-124`, the pattern you are extending:

```ts
export type AggregateStatsArgs = FunctionArgs<
  typeof api.invocations.getAggregateStats
>; // -> { after?: number; groupFolder?: string }
```

`src/lib/tools.ts:107-121`, fifteen lines of hand-written checking for two
optional fields, repeated with different names nine more times in the same file.

`src/lib/tools.ts:143-158`, the block the model reads — a sixteen-line object
literal duplicating the field names and adding description strings that exist
nowhere else.

**Do NOT edit anything under `convex/`.** That directory is the slice supplied
with the original brief. `tsc -b` already reports 6 pre-existing errors there and
they are not yours. Your gate is "zero errors in `src/`", not "zero errors".

---

## Commands You'll Need

| Purpose                                     | Command                                                             | Expected on success               |
| ------------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| Preflight: Zod is present                   | `node -e "console.log(require('zod/package.json').version)"`        | `4.4.3` or higher                 |
| **Your gate** — errors in `src/`            | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^src/"`       | `0`                               |
| Pre-existing backend errors (must not grow) | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^convex/"`    | `6`                               |
| Full unit suite                             | `npm test`                                                          | `Tests 141 passed (141)`          |
| Just the tools file while iterating         | `./node_modules/.bin/vitest run src/lib/tools.test.ts`              | `44 passed` or higher             |
| Lint                                        | `npm run lint`                                                      | `0 errors`, 21 warnings           |
| Confirm zod is a direct dep                 | `node -e "console.log(require('./package.json').dependencies.zod)"` | a version string, not `undefined` |

---

## Files You'll Touch

| Path                     | Role                 | What it holds                                            | You                      |
| ------------------------ | -------------------- | -------------------------------------------------------- | ------------------------ |
| `src/lib/toolSchemas.ts` | Data                 | **New file.** The schema and the bind                    | **Build**                |
| `src/lib/types.ts`       | Data                 | `AggregateStatsArgs` at line 122 — the thing you bind to | **Read only**            |
| `src/lib/tools.ts`       | Calculation + Action | Lines 143-158 hold the description strings you copy over | **Read only this phase** |
| `package.json`           | Data                 | Promote `zod` from transitive to direct                  | **Build**                |
| `convex/`                | given                | 6 pre-existing type errors                               | **Do not touch**         |

`tools.ts` is read-only _this phase_. That is what keeps the first commit
reviewable: the schema lands, nothing consumes it, and the diff is one new file.

---

## Scope

**In scope:** `src/lib/toolSchemas.ts` (new), `package.json`.

**Out of scope:**

- **`src/lib/tools.ts` behaviour.** The schema is not wired to anything yet. That is ETH-43 and ETH-44.
- **The tool `description` strings.** They move into the schema verbatim. Rewording them is a separate ticket and would make this diff unreviewable.
- **`convex/`.** See above.
- **The other eleven tools.** One tool, deliberately. If the pattern is wrong you want to find out once, not twelve times.

---

## Git workflow

```bash
git switch -c refactor/zod-tool-schemas
# this phase is one commit
git commit -m "refactor: bind getAggregateStats args to a Zod schema"
```

Commit per phase, so a bad phase is one `git revert` rather than a bisect.

---

## Background Concept: the continuity supervisor

Think about who on a film set does nothing but stop things.

The continuity supervisor shoots no footage and lights nothing. Their entire job
is to hold two things side by side — the shot you took Tuesday and the shot you
are taking now — and say _"the coffee cup was in his left hand."_ They produce
no output. They halt a take.

A compile-time equality assertion is exactly that. It emits **zero JavaScript**.
It exists so `tsc` refuses to build when your Zod schema and the Convex
function's real arguments have drifted apart.

That is the shape to hold in your head for Step 1.2: you are not writing code
that runs. You are writing a claim that either compiles or does not.

**And here is the trap this whole phase is built around.** A continuity
supervisor who says "looks fine" to every take is worse than none at all,
because now everybody believes the coffee cup is fine. The naive version of this
assertion does precisely that. Step 1.3 is where you find out.

---

## Phase 1: The schema and the bind

### Step 1.1: The stub

Create `src/lib/toolSchemas.ts` with exactly this, then fill in the TODOs.

```ts
// CATEGORY: Data - schema values and the type-level assertions that pin them.
// No runtime behaviour lives here beyond constructing schema objects.

import { z } from "zod"; // → module
import type { AggregateStatsArgs } from "./types"; // → { after?: number; groupFolder?: string }

// TODO(you): build the schema for getAggregateStats.
//
//   - Both fields are optional. types.ts:122-124 has the exact shape; the
//     `// ->` comment on that line is the target you are matching.
//   - An unknown key must THROW, not be silently dropped. Zod has two object
//     constructors and only one of them does that by default. Which default
//     would let a hallucinated `lane` key through without complaint? Read
//     `docs/PLAN.md:78` for why that matters here specifically.
//   - Carry the two description strings over from tools.ts:145-157 VERBATIM.
//     Zod has a method for attaching human-readable text to a field. You will
//     need it in ETH-43 and it costs nothing to add now.
export const aggregateStatsSchema = /* TODO(you) */ null as never;

// TODO(you): write the bind.
//
// Goal: `tsc` errors if aggregateStatsSchema stops matching AggregateStatsArgs.
//
// Start from the shape below — then go to Step 1.3 before you trust it.
// `z.infer<typeof aggregateStatsSchema>` gives you the type the schema
// describes. You need to compare it against AggregateStatsArgs and produce a
// type that is assignable from `true` when they agree and from nothing at all
// when they do not.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

// TODO(you): declare a const whose type is that comparison, assigned `true`.
// Name it with a leading underscore — it exists for its type, not its value.
```

### Step 1.2: Get it compiling

Fill in the schema and write the naive bind:

```ts
const _aggregateStatsBound: Exact<
  z.infer<typeof aggregateStatsSchema>,
  AggregateStatsArgs
> = true;
```

Run your gate:

```bash
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"
```

You want `0`. If you get errors, they are almost certainly about the two
optional fields — Zod's `.optional()` and TypeScript's `?:` are related but not
identical, and the order you chain `.describe()` and `.optional()` affects the
inferred type. Get to `0` before moving on.

### Step 1.3: Now try to break it

**This is the phase. Everything before it was setup.**

Add a second, deliberately wrong schema below the first — same shape, but rename
`groupFolder` to `lane`:

```ts
// scratch — delete before committing
const drifted = z.strictObject({
  after: z.number().optional(),
  lane: z.string().optional(),
});
const _driftedBound: Exact<z.infer<typeof drifted>, AggregateStatsArgs> = true;
```

Run the gate again.

It prints `0`. **No error.**

Sit with that, because it is the most useful thing in this ticket. You just
asserted that `{ after?: number; lane?: string }` is exactly
`{ after?: number; groupFolder?: string }`, and the compiler agreed.

Work out why before reading on. The relevant fact: _every field on both sides is
optional._ A type with an extra optional property is still assignable to one
without it. A type missing an optional property is still assignable to one that
has it. Both directions of `extends` pass. Your continuity supervisor is reading
a blank page.

### Step 1.4: Fix the bind

You need a comparison that survives all-optional shapes. Two candidate routes —
reason about which you prefer **before** you try either:

- **Compare the keys, not the shapes.** `keyof` on an all-optional object still
  yields a real union of string literals, and `"after" | "lane"` is genuinely not
  `"after" | "groupFolder"`.
- **Strip the optionality first, then compare shapes.** TypeScript ships a
  built-in mapped type that turns `{ a?: X }` into `{ a: X }`.

Both catch the rename. **Only one of them also catches a teammate changing
`after` from `number` to `string` while leaving the name alone.** Work out which,
and use that one.

Then introduce a `Bound<S, Args>` alias wrapping your chosen comparison, and
assert through it. Name it, do not inline it — it is about to be repeated eleven
more times in ETH-44 through ETH-46, and a named type means the error message
says `Bound` and a future improvement lands in one place.

**Verify, in this order:**

1. With `drifted` still present, the gate prints a number **greater than** `0`.
2. Change `drifted` back so only the _type_ differs (`after: z.string()`, name unchanged). The gate still prints greater than `0`. If it prints `0`, you picked the weaker of the two routes — switch.
3. Delete the `drifted` block entirely. The gate prints `0`.

If you cannot get step 1 to fail, you do not have a bind yet, and moving on will
propagate the non-check to twelve tools.

**One more sabotage, and this one does not have a fix.** With everything green,
change `z.strictObject` to `z.object` on the real schema and run the gate again.

It prints `0`. The bind does not care.

That is correct behaviour, not a bug in your bind. `z.infer` of
`z.object({ after: z.number().optional() })` and of `z.strictObject({ ... })` are
the same TypeScript type. Strictness is a _runtime_ property of the parser and
leaves no trace in the inferred type, so no type-level assertion can ever see it.
Verified on the installed Zod 4.4.3:

```
z.strictObject({ after: ... }).safeParse({ days: 3 })
  -> issues: [{ code: "unrecognized_keys", keys: ["days"] }]
z.object({ after: ... }).safeParse({ days: 3 })
  -> { success: true, data: {} }        // key silently deleted
```

So the guard `docs/PLAN.md:78` commits to has exactly one enforcer, and it is not
the compiler and not the JSON Schema (Phase 2 shows why). It is a runtime test
that feeds an unknown key in and asserts a throw. `getAggregateStats` has no such
test; ETH-45 adds one per tool. Put `z.strictObject` back now. Nothing in the
repo would have told you if you had not.

### Step 1.5: Quiz yourself

Answer these in writing before you look at anything.

1. `z.object({ after: z.number().optional() }).parse({ after: 1, lane: "x" })` returns a value rather than throwing. What is in that value? Which line of `docs/PLAN.md` does that behaviour violate?
2. Your bind catches a renamed key. A teammate changes `after` from `number` to `string` in the schema only. Does yours catch it? If not, what would?
3. Why is `[A] extends [B]` wrapped in tuples at all? What would bare `A extends B` do differently if `A` were a union type?
4. You are about to repeat this bind eleven more times. What is the one thing about your current version you would least like to have to change later?

<details>
<summary>Hints — open only if you are stuck for more than fifteen minutes</summary>

- **Schema constructor:** the two candidates are `z.object` and `z.strictObject`. One strips unknown keys and returns success; one throws. The whole point of `assertKnownKeys` is that a hallucinated key must throw, because that is how the model learns it invented a parameter.
- **Chaining order:** `.describe()` returns the same schema type, so it can go before or after `.optional()`. Put `.optional()` last and read the inferred type in your editor to confirm.
- **Step 1.4, the stronger route:** `keyof` alone compares _names_. To catch a type change you need to compare the _properties_, which means removing optionality rather than sidestepping it. TypeScript's built-in is `Required<T>`.
- **Q3:** naked type parameters in a conditional type distribute over unions. Wrapping both sides in a one-element tuple turns off distribution, so you compare the union as a whole rather than member by member.
- **package.json:** `npm install zod` will pick up the version already in the lockfile. Confirm with the last row of the Commands table.

</details>

### Step 1.6: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"   # → 0
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^convex/" # → 6, unchanged
npm test                                                      # → 141 passed
node -e "console.log(require('./package.json').dependencies.zod)"
```

**Only now** open `zod-migration-tutorial.md` and read Phase 1's `### ✅ Solution`
section. Diff it against what you wrote. If they differ, the interesting question
is not "which is right" — both may pass the gate — but _what does the difference
protect against_.

### ✅ Phase 1 complete

- `src/lib/toolSchemas.ts` exists and typechecks.
- You have personally watched the bind fail on a renamed key **and** on a changed type.
- `zod` is in `dependencies`, not only the lockfile.
- Nothing imports the new file. Runtime behaviour is untouched.

---

## Test plan

1. `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` → `0`
2. Same command with `grep -c "^convex/"` → `6`. If this grew, you edited the brief slice.
3. `npm test` → `Tests 141 passed (141)`. Unchanged, because nothing imports your file.
4. `npm run lint` → `0 errors`.
5. **The one that matters:** re-introduce the drifted schema, confirm check 1 fails, remove it, confirm it passes. Record that you did this in the commit message.

---

## Done criteria

- `src/lib/toolSchemas.ts` exists and typechecks.
- Deliberately breaking the schema — by name **or** by type — fails the typecheck.
- `zod` is a direct dependency.
- The description strings in the schema are byte-identical to `tools.ts:145-157`.
- `git diff --stat` shows two files changed and no change under `src/lib/tools.ts`.

---

## STOP conditions

- The drift check at the top prints anything. The line numbers in this sheet are then untrustworthy.
- The `convex/` error count is not `6`. Something outside your change moved.
- You cannot make the bind fail on a deliberate break. Do not proceed to ETH-43 — you would be building on a check that does not check.
- `npm test` drops below 141. Nothing in this phase should be able to do that; if it did, find out why before continuing.

---

## What You Should Know Now

- A shape written in three places is three chances to be wrong. Derive two of them from the third.
- `extends` is close to useless as an equality test on all-optional objects, and it fails _silently_, which is the worst way to fail.
- A type-level check you have never seen fail is not a check. Break it on purpose, once, before you trust it.
- `z.object` strips unknown keys and succeeds; `z.strictObject` throws. The default is the wrong one for a boundary that talks to a language model.
- The bind cannot see which one you picked. `z.infer` is identical for both, so strictness is enforceable only by a runtime test. Know which of your checks covers which failure.
- Naming a type alias you are about to repeat twelve times is not style, it is the difference between one edit and twelve.

---

## Reference

### Troubleshooting

**Problem:** `Type 'true' is not assignable to type 'never'` on your bind line.
**Solution:** Working as intended — the schema and the args type genuinely disagree. Hover `z.infer<typeof aggregateStatsSchema>` in your editor and diff it against the `// ->` comment on `types.ts:122`.

**Problem:** The bind compiles even with a deliberately wrong field name.
**Solution:** You are comparing all-optional shapes directly. See Step 1.4 — you need to remove optionality before comparing.

**Problem:** The bind compiles with `z.object` in place of `z.strictObject`.
**Solution:** Not fixable, and not a defect in your bind. The two constructors infer the same type. See the second sabotage in Step 1.3.

**Problem:** `tsc` reports errors in `convex/` and you did not touch it.
**Solution:** Those 6 are pre-existing. Your gate greps `^src/` for exactly this reason.

**Problem:** Editor says `Cannot find module 'zod'`.
**Solution:** It is installed transitively, which resolves at runtime but may not be picked up by your editor's TS server until it is a direct dependency. Do the `package.json` step, then restart the TS server.

### Key takeaways

1. Derive, don't restate.
2. Bind the derivation to the source with something that fails the build.
3. Try to break every check you write, immediately, once.
4. `strictObject` at boundaries. Silent key-stripping is a disabled feature wearing a green checkmark.

**End of Tutorial**
