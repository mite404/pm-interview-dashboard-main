---
linear: ETH-45
linear_url: https://linear.app/mite404-workspace/issue/ETH-45/cover-the-four-argument-shapes-the-simple-case-did-not
github: 24
filed: 2026-08-24
parent: ETH-41
plan: 004-zod-remaining-arg-shapes.md
---

# Cover the four argument shapes the simple case did not

_For the executor: this is the hands-on sheet for `004-zod-remaining-arg-shapes.md`.
The plan file says what to build. This says what to try, in what order, and how to
know you got it right._

> **Blocked until ETH-44 lands.** Every schema here gets a validator built from
> `makeValidator`, which 003 creates.

> **Where the answer lives.** `zod-migration-tutorial.md`, Phase 4, has a
> `### ✅ Solution` with all four schemas. **Do not open it until Step 4.7.** Two
> of these four have failure modes whose error messages do not point at the cause
> — finding them yourself is the entire value of the phase.

**Drift check, run this first:**

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
git diff --stat 12b44d2..HEAD -- src/lib/types.ts src/lib/tools.test.ts
grep -n "export function makeValidator" src/lib/toolSchemas.ts || echo "STOP: do ETH-44 first"
```

Expected: no `git diff` output, and `makeValidator` present.

**Goal:** Schemas and binds for `listRecent`, `listByChatJid`,
`getAggregateTokenUsage`, and `listConversations` — four argument shapes that each
break the Phase 1 pattern in a different way.

**Learning style:** Four small problems in ascending difficulty, done in a
specific order because each one teaches the thing you need for the next. One of
them is a trap with a misleading error message; one of them breaks the migration's
core assumption outright.

**Prerequisites:** ETH-42, ETH-43, ETH-44 complete.

**Estimated time:** ~2-3h. Four schemas, maybe twenty-five lines total. The time
is in Steps 4.4 and 4.5.

---

## Status

- **Initial priority:** P2
- **Effort:** M (3 points)
- **Risk:** MED. One of the four fails a test with a message that does not point
  at the cause. You will lose time to it if you rush.
- **Depends on:** ETH-44 (003)
- **Blocks:** ETH-46 (005)
- **Category:** refactor
- **Planned at:** commit `12b44d2`, 2026-08-24

---

## Why this matters

`getAggregateStats` is two optional primitives. It is the easy case, and Phases
1-3 were built on it deliberately.

These four are not, and each fails differently if you translate it carelessly:

- **`listConversations`** takes no arguments at all. `tools.test.ts:120-123`
  requires _any_ key to throw. This is a one-line schema and it immediately proves
  whether you understood `strictObject` in Phase 1 or just copied it.
- **`getAggregateTokenUsage`** has an `after` that **defaults to 0** — see
  `tools.ts:182-184`, comment and assignment together. A default changes the _output_ type
  relative to the input type, which is the first time your bind has to think.
- **`listByChatJid`** requires a **non-blank** string. `tools.test.ts:143-146`
  requires both `""` and `"   "` to throw. This is the trap.
- **`listRecent`** carries a `status` field that **the backend does not have**. It
  is applied by the tool, not by Convex — so it cannot bind to `FunctionArgs`.
  This is the one case where the migration's core assumption does not hold, and
  knowing why is worth more than the schema.

---

## Current state

The four validators, in `src/lib/tools.ts`:

| Tool                     | Validator at | Bind target in `types.ts`                                                                  |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------ |
| `getAggregateTokenUsage` | `:173-186`   | `AggregateTokenUsageArgs` (`types.ts:125-127`) → `{ after: number; groupFolder?: string }` |
| `listRecent`             | `:233-251`   | see Step 4.6 — **not** `ListRecentArgs`                                                    |
| `listConversations`      | `:308-314`   | `ListConversationsArgs` (`types.ts:133`) → `{}`                                            |
| `listByChatJid`          | `:358-370`   | `ListByChatJidArgs` (`types.ts:135`) → `{ chatJid: string; limit?: number }`               |

`INVOCATION_STATUSES` is declared at `tools.ts:44` as `InvocationStatus[]` and is
already used twice — in the hand-rolled check at `tools.ts:243-246` and in the
advertised `parameters` enum at `tools.ts:289`.

The tests you must not break:

- `tools.test.ts:62-66` — `validateTokenUsage({})` and `validateTokenUsage(undefined)` both equal `{ after: 0 }`
- `tools.test.ts:120-123` — `validateListConversations({ jid: "maya@web" })` throws `/jid/`
- `tools.test.ts:143-146` — `chatJid: ""` throws **and** `chatJid: "   "` throws

---

## Commands You'll Need

| Purpose                  | Command                                                                | Expected on success    |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------- |
| **Your gate**            | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^src/"`          | `0`                    |
| Backend errors           | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^convex/"`       | `6`                    |
| Tools tests              | `./node_modules/.bin/vitest run src/lib/tools.test.ts`                 | all pass               |
| One test by name         | `./node_modules/.bin/vitest run src/lib/tools.test.ts -t "whitespace"` | see Step 4.5           |
| Full suite               | `npm test`                                                             | `141 passed` or higher |
| Probe                    | `npm run probe:backend`                                                | `12 tools checked`     |
| Inspect an inferred type | hover `z.infer<typeof s>` in your editor                               | see Step 4.4           |

---

## Files You'll Touch

| Path                     | Role                 | What it holds                          | You           |
| ------------------------ | -------------------- | -------------------------------------- | ------------- |
| `src/lib/toolSchemas.ts` | Data                 | Four new schemas, four new binds       | **Build**     |
| `src/lib/tools.ts`       | Calculation + Action | Four registry entries, four validators | **Build**     |
| `src/lib/types.ts`       | Data                 | The bind targets, lines 125-141        | **Read only** |
| `src/lib/tools.test.ts`  | Calculation          | The assertions you must not edit       | **Read only** |

---

## Scope

**In scope:** `src/lib/toolSchemas.ts`, four registry entries in `src/lib/tools.ts`.

**Out of scope:**

- **Changing any existing assertion in `tools.test.ts`.** If a test needs its
  _assertion_ changed rather than its _subject_, that test is pinning behaviour
  the model depends on. **Stop and report.**
- **`convex/`.**
- **A shared `makeToolSchema` wrapper.** The plan file argues against it and the
  argument is worth reading: four call sites that all begin with `strictObject`
  and share nothing else are four different things, and a wrapper hides the field
  list, which is the only part anyone reads.
- **The remaining eight tools.** ETH-46.

---

## Git workflow

One commit per tool, in the order below. Four commits.

```bash
git commit -m "refactor: bind listConversations to a Zod schema"
# ...
```

The order is not arbitrary — see each step.

---

## Background Concept: when the derived type is not the right target

Phases 1-3 rested on one assumption: **the Convex function signature is the truth,
and everything else derives from it.**

`listRecent` breaks it, and it is worth being precise about how.

Read `tools.ts:229-231`:

> `listRecent` has no status filter, so `validate` keeps it as a tool-level
> concern and `run` applies it to the returned array (that split is why "show me
> recent failed runs" resolves without a second Convex function).

And `runListRecent` at `tools.ts:258-262` strips it:

```ts
const { status, ...convexArgs } = args;
const rows = await deps.convex.query(api.invocations.listRecent, convexArgs);
```

So `status` is real, and it is _ours_. The backend has never heard of it.
`types.ts:141` already names this exactly:

```ts
export type ListRecentToolArgs = ListRecentArgs & { status?: InvocationStatus };
```

An intersection: what Convex accepts, **plus** what the tool adds.

Here is the thing worth internalising. If you bind the `listRecent` schema to
`ListRecentArgs`, the bind **fails — correctly**. It is not being awkward. It is
telling you the truth: your schema declares a field the backend does not have.
The fix is not to weaken the bind. The fix is to bind to the type that describes
what the _tool_ accepts, which is the intersection.

**The rule that falls out:** bind to the type that describes the boundary you are
actually validating. For nine tools that is the Convex signature. For this one the
boundary is the tool's own surface, which is strictly larger. A bind that "fails
for no reason" is usually pointing at a boundary you have mis-identified.

---

## Phase 4: The four shapes that are not two optional fields

### Step 4.1: `listConversations` — one line, and a check on Phase 1

Do this first because it is the smallest thing that can prove you understood
`strictObject`.

```ts
// src/lib/toolSchemas.ts
// TODO(you): a schema for a tool that takes NO arguments.
//   The test at tools.test.ts:120-123 requires ANY key to throw.
//   If you reach for z.object({}) here, go back and re-read ETH-42's Step 1.1 —
//   one of the two constructors silently accepts { jid: "maya@web" } and returns {}.
export const listConversationsSchema = /* TODO(you) */;

// TODO(you): the bind. Target is ListConversationsArgs (types.ts:133).
//   Note it is `{}`. What does Required<{}> give you, and does your Bound<>
//   from ETH-42 still say anything useful about two empty objects?
//   If the answer is "no", is that a problem here? Argue it.
```

Then the registry entry: `parameters: toParameters(...)` and
`validateListConversations = makeValidator(...)`.

**Verify:** `vitest run src/lib/tools.test.ts -t "listConversations"` passes,
including the `/jid/` throw.

### Step 4.2: `getAggregateTokenUsage` — a default changes the output type

`tools.ts:182-184`:

```ts
// `after` is required by the Convex action; default to 0 (all-time) when the
// model omits it, so "token usage" with no window returns the full picture.
const args: AggregateTokenUsageArgs = { after: after ?? 0 };
```

So the model may omit `after`, and the backend must receive it. Input optional,
output required.

```ts
// TODO(you):
//   - Zod has a method that supplies a value when the input omits the field.
//   - That method makes z.infer<> report the field as REQUIRED even though the
//     input type treats it as optional. Those are two different types and Zod
//     4 distinguishes them.
//   - Which one does your Bound<> from ETH-42 compare against? Find out by
//     hovering, not by guessing. If the bind errors, read the error — it is
//     telling you which of the two you got.
export const tokenUsageSchema = /* TODO(you) */;
```

**Verify:** `tools.test.ts:62-66` passes — `validateTokenUsage({})` and
`validateTokenUsage(undefined)` both equal `{ after: 0 }`. The `undefined` case is
the one your ETH-44 normalisation handles; confirm it still does.

**Then verify the half no test covers.** The input/output split you just met does
not stop at the bind. It reaches the document the model reads. Print what this
tool now advertises:

```bash
npx tsx -e "
import { getAggregateTokenUsageTool } from './src/lib/tools';
console.log(JSON.stringify(getAggregateTokenUsageTool.parameters, null, 2));
"
```

`required` must not contain `after`. The whole reason for the default is that the
model can omit it.

If `after` is listed as required, `toParameters` is emitting in output mode, and
this is the commit where that starts to matter. Every earlier schema was plain
optionals, where the two modes emit the same thing. ETH-43 should have pinned
`io: "input"`; if it did not, fix it in `toolSchemas.ts` rather than
special-casing this tool. Verified on Zod 4.4.3:

```
output {... "properties":{"after":{"default":0,...}}, "required":["after"], ...}
input  {... "properties":{"after":{"default":0,...}}, ...}
```

Note what did _not_ catch this: not `tsc`, not `Bound<>`, not the 141 tests, not
`probe:backend`. Nothing in `src/lib/tools.test.ts` asserts on `parameters` at
all. The only reason you are looking is that this sheet told you to.

### Step 4.3: `listByChatJid` — the trap

`chatJid` is required and must be non-blank. Two tests at `tools.test.ts:143-146`:

```ts
expect(() => validateListByChatJid({ chatJid: "" })).toThrow(/chatJid/);
expect(() => validateListByChatJid({ chatJid: "   " })).toThrow(/chatJid/);
```

```ts
// TODO(you): chatJid — a required string that must not be blank.
//   You need two refinements: one that trims, one that enforces a minimum
//   length. Zod applies refinements LEFT TO RIGHT.
//
//   Before you write it: work out on paper what each ORDER does to the input
//   "   " (three spaces). One order passes both tests. The other passes the
//   empty-string test and fails the whitespace test.
//
//   Write down your prediction, then write the code, then run the test.
export const listByChatJidSchema = /* TODO(you) */;
```

**This is the one the plan file flags as MED risk**, and here is why: if you get
the order wrong, the failing test is
`"throws when chatJid is empty or whitespace"` and the failure message is
something like `expected function to throw, but it did not`. Nothing in that
message says "your refinement order is backwards". You can stare at a correct-
looking schema for twenty minutes.

So: predict first, in writing. If your prediction and the test agree, you
understood it. If they disagree, you have learned something specific rather than
having flailed until green.

**Verify:** `vitest run src/lib/tools.test.ts -t "whitespace"` passes. Then swap
the refinement order deliberately, watch exactly which test fails and what it
says, and swap back. That thirty seconds is what stops this costing you an hour
in ETH-46.

### Step 4.4: `listRecent` — the enum, and not retyping it

```ts
// TODO(you): the status field.
//   INVOCATION_STATUSES is already declared at tools.ts:44 and already used
//   twice (the hand-rolled check at :243, the advertised enum at :289).
//   Zod has a constructor that takes a list of literals.
//
//   Do NOT retype the four status strings into the schema. This is a migration
//   whose entire purpose is removing duplicate declarations of a shape; adding
//   a fourth copy of the status list on the way past would be funny in the
//   wrong way.
//
//   One wrinkle: INVOCATION_STATUSES is typed `InvocationStatus[]`, not
//   `readonly [...]`. Zod's enum constructor may want the narrower form.
//   If it complains, work out the smallest honest fix — and note that changing
//   the declaration at tools.ts:44 affects two other call sites, so check them.
```

**Verify:** the `listRecent` status tests pass, and
`grep -c '"succeeded"' src/lib/` has not increased.

### Step 4.5: `listRecent` — the bind that must not be weakened

Now the part from the Background section.

```ts
// TODO(you): the bind for listRecent.
//   Try binding to ListRecentArgs (types.ts:129) FIRST, on purpose, and read
//   the error. It is a good error and it is telling you something true.
//
//   Then bind to the correct target. types.ts:141 already declares it.
//
//   Write a one-line comment on the bind saying WHY this tool binds to a
//   different kind of type than the other eleven. The next reader will
//   otherwise assume it is a mistake and "fix" it.
```

**Verify:** `tsc -b` gate prints `0`, and your comment exists.

### Step 4.6: Quiz yourself

1. `Required<{}>` versus `Required<{}>`. Your `Bound<>` from ETH-42 compares two
   empty objects for `listConversations`. Does it assert anything? If not, what is
   actually protecting that tool from drift — and is it enough?
2. `.default(0)` makes `z.infer<>` report `after` as required. Zod 4 also exposes
   an _input_ type separately from the output type. Which one should a bind
   against `FunctionArgs` use, given that `FunctionArgs` describes what the
   backend _receives_?
3. You swapped the refinement order in Step 4.3 and watched a test fail. Write
   the one-sentence rule you would put in a code review comment so a colleague
   never makes it.
4. `listRecent`'s schema declares `status`, which `runListRecent` strips before
   the Convex call. If someone later adds `status` to the Convex function, what
   should happen to `ListRecentToolArgs` and to your bind? Would anything alert
   you?
5. Four tools, four different reasons the simple pattern did not apply. Is there a
   fifth reason lurking in the remaining eight tools? Skim `types.ts:143-166` and
   name any shape that looks like it needs its own thinking. (ETH-46 will thank
   you.)

<details>
<summary>Hints — open only if stuck for more than fifteen minutes</summary>

- **4.1:** `z.strictObject({})`. And yes, `Bound<{}, {}>` is vacuously true — the
  honest answer to Q1 is that the _test_ is what protects `listConversations`, not
  the bind. Worth a comment.
- **4.2:** `.default(0)`. Zod 4 gives you `z.input<typeof s>` and `z.infer<typeof s>`
  (the latter being the output). A bind against `FunctionArgs` — what Convex
  receives — wants the output type.
- **4.3:** `z.string().trim().min(1)`. Trim first turns `"   "` into `""`, then
  `.min(1)` rejects it. The reverse order lets `"   "` through because it is three
  characters long at the moment `.min(1)` runs.
- **4.4:** `z.enum(INVOCATION_STATUSES)`. If the array type is too wide, the
  smallest honest fix is `as const satisfies readonly InvocationStatus[]` at
  `tools.ts:44` — check `:243` and `:289` still compile.
- **4.5:** bind to `ListRecentToolArgs` (`types.ts:141`), the intersection.
- **Q4:** nothing would alert you — `ListRecentToolArgs` is
  `ListRecentArgs & { status?: ... }` and an intersection with a now-redundant
  member is still valid. That is a real, small gap. Naming it in a comment is a
  legitimate deliverable.

</details>

### Step 4.7: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
./node_modules/.bin/vitest run src/lib/tools.test.ts   # → all pass, incl. :143-146
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"     # → 0
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^convex/"  # → 6
npm test                                                # → 141 or higher
npm run probe:backend                                   # → 12 tools checked
git diff --stat src/lib/tools.test.ts                   # → EMPTY. You edited no assertions.
```

That last line is a Done criterion, not a nicety.

**Only now** open `zod-migration-tutorial.md` Phase 4's `### ✅ Solution`.

### ✅ Phase 4 complete

- Four schemas exist, each with its own bind on the adjacent line.
- No existing test assertion was edited.
- The `listRecent` bind has a comment explaining why its target differs.
- You have personally watched the refinement-order test fail and can explain the
  message it gave you.

---

## Test plan

1. `./node_modules/.bin/vitest run src/lib/tools.test.ts` — every existing
   assertion passes, including the whitespace pair at `tools.test.ts:143-146`.
2. `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` → `0`.
3. Same with `^convex/` → `6`.
4. `npm test` → `141 passed` or higher.
5. `npm run probe:backend` → `12 tools checked`.
6. `git diff src/lib/tools.test.ts` → empty.
7. Deliberate-break check on each of the four binds: rename one field, confirm
   `tsc` fails, restore. Four small breaks, four confirmations.

---

## Done criteria

- Four schemas in `toolSchemas.ts`, each with a bind on the adjacent line.
- `listRecent` binds to `ListRecentToolArgs`, with a comment saying why.
- `INVOCATION_STATUSES` is referenced, not retyped —
  `grep -c '"succeeded"' src/lib/` has not increased.
- No existing test assertion edited.
- All four tools' registry entries call `toParameters(...)` and a factory-built
  validator.
- `getAggregateTokenUsageTool.parameters` does **not** list `after` in `required`.

---

## STOP conditions

- `makeValidator` missing — ETH-44 is not done.
- **An existing assertion in `tools.test.ts` needs editing to pass.** That is the
  loudest signal in this phase. It means you have changed behaviour the model
  depends on. Report; do not edit.
- You are about to weaken `Bound<>` (e.g. back to a bare `extends`) to make
  `listRecent` compile. Re-read the Background section — the bind is right and the
  target is wrong.
- You are about to retype the status strings. Re-read Step 4.4.
- The `convex/` error count moves off `6`.

---

## What You Should Know Now

1. Refinement order is semantic. `z.string().trim().min(1)` and
   `z.string().min(1).trim()` accept different inputs, and the failure gives you
   no hint that ordering is the cause.
2. A default changes the output type relative to the input type, and a bind has to
   know which one it is comparing.
3. `z.object` versus `z.strictObject` matters most for the tool that takes **no**
   arguments, where the wrong one accepts everything. No type-level check can see
   which you picked, because `z.infer` is identical for both. The unknown-key test
   is the only enforcement that exists.
4. When a bind fails "for no reason", you have probably mis-identified the
   boundary. Bind to the type that describes what you are actually validating.
5. A vacuous check (`Bound<{}, {}>`) is not a check. Know which of your twelve
   binds are load-bearing.

---

## Reference

### Troubleshooting

**Problem:** `"throws when chatJid is empty or whitespace"` fails, and the message just says the function did not throw.
**Solution:** Refinement order. `.min(1)` ran before `.trim()`. Swap them.

**Problem:** The `listRecent` bind errors and the message mentions `status`.
**Solution:** Working as intended — you bound to `ListRecentArgs`. Bind to `ListRecentToolArgs`.

**Problem:** `validateTokenUsage({})` returns `{}` rather than `{ after: 0 }`.
**Solution:** The default is missing, or it is attached after `.optional()` in a way that discards it. Hover the inferred type.

**Problem:** `z.enum(INVOCATION_STATUSES)` will not typecheck.
**Solution:** The array is `InvocationStatus[]`, not a readonly tuple. Narrow the declaration at `tools.ts:44` and check the two other call sites still compile.

**Problem:** `validateListConversations({ jid: "x" })` returns `{}` instead of throwing.
**Solution:** `z.object` instead of `z.strictObject`. The bind will not tell you; only this test will.

**Problem:** `getAggregateTokenUsageTool.parameters` lists `after` in `required`.
**Solution:** `toParameters` is calling `z.toJSONSchema` in the default `io: "output"` mode, which reports a defaulted field as required. Pass `io: "input"` in `toolSchemas.ts`. `parameters` describes what the model sends, which is the parser's input side.

### Key takeaways

1. Do the smallest tool first — it proves the pattern before the hard cases hide it.
2. Predict before you run, especially where the error message will not help you.
3. Never add a copy of a shape during a migration whose purpose is removing copies.
4. Bind to the boundary you validate, not to the one you assumed.

**End of Tutorial**
