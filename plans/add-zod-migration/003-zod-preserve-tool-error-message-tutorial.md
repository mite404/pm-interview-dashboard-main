---
linear: ETH-44
linear_url: https://linear.app/mite404-workspace/issue/ETH-44/replace-the-hand-written-validators-keeping-the-message-the-model
github: 23
filed: 2026-08-24
parent: ETH-41
plan: 003-zod-preserve-tool-error-message.md
---

# Replace the hand-written validators, keeping the message the model reads

_For the executor: this is the hands-on sheet for `003-zod-preserve-tool-error-message.md`.
The plan file says what to build. This says what to try, in what order, and how to
know you got it right._

> **Blocked until ETH-42 and ETH-43 land.** This phase adds a second Calculation
> to `src/lib/toolSchemas.ts` and consumes `getAggregateStatsSchema`. Do 001 and 002
> first.

> **Where the answer lives.** `zod-migration-tutorial.md`, Phase 3, has a
> `### ✅ Solution` section with the finished factory. **Do not open it until
> Step 3.6.** This is the phase where reading ahead costs you the most, because
> the whole lesson is a trap you have to walk into.

**Drift check, run this first:**

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
git diff --stat 12b44d2..HEAD -- src/lib/loop.ts src/lib/tools.test.ts
grep -n "export function toParameters" src/lib/toolSchemas.ts || echo "STOP: do ETH-43 first"
```

Expected: no output from the `git diff` (the loop and the test file are untouched
since the plan was written), and `toParameters` present.

**Goal:** One `makeValidator(toolName, schema)` factory replacing ten
hand-written `validate*` functions — starting with one — while keeping the
thrown message useful to the language model that reads it.

**Learning style:** You will write a version that passes the entire existing test
suite and is nonetheless wrong. Then you will find out how. Then you will write
the test nobody wrote.

**Prerequisites:** ETH-42 and ETH-43 complete. You know what `try/catch` does. You
do not need to have used `safeParse`.

**Estimated time:** ~2h. The factory is about ten lines. Step 3.3 is the hour.

---

## Status

- **Initial priority:** P2
- **Effort:** M (3 points)
- **Risk:** **MED — and it is a specific kind of MED.** This is the phase that can
  pass every test while silently losing behaviour. Do not treat green as done.
- **Depends on:** ETH-42 (001), ETH-43 (002)
- **Blocks:** ETH-45 (004), ETH-46 (005) — both build validators from this factory
- **Category:** refactor
- **Planned at:** commit `12b44d2`, 2026-08-24

---

## Why this matters

`src/lib/loop.ts:120-127` is the reason this phase exists:

```ts
} catch (error) {
  // Tool-layer error: feed the reason back so the model can self-correct
  // next step, and continue - do not abort the turn.
  const message = error instanceof Error ? error.message : String(error);
  hooks.onToolStatus({ phase: "error", tool: toolCall.name, message });
  wire.push(toolErrorMessage(toolCall.id, message));
}
```

That `error.message` is not a log line. It is **pushed onto the wire** as a
`role: "tool"` message and handed straight back to the model, which reads it and
tries again. It is an input to another system. Changing its shape is an API
change.

The loop's three-way error policy is documented at `loop.ts:8-13` and it is
correct: a _tool_ error feeds back and the loop continues; MAX_STEPS ends with a
note; only an _LLM-channel_ error aborts the turn. This phase must not touch any
of that.

Here is the problem. The current helpers produce messages like:

```
getAggregateStats: unknown argument: days
getAggregateStats: `after` must be a number
```

A raw `ZodError.message` produces something like:

```
Unrecognized key: "days"
```

Accurate, and useless. **Twelve tools are registered.** A model that receives
`Unrecognized key: "days"` cannot tell which of its calls was wrong, so its next
step is a guess. And `loop.ts:129-135` caps the loop at five steps — you do not
have spare round trips to burn on ambiguity.

---

## Current state

Ten near-identical validators in `src/lib/tools.ts`, at lines `106`, `173`,
`233`, `308`, `358`, `417`, `458`, `549`, `648`, `788`. Each is built from four
shared helpers defined at `tools.ts:56-98`:

```ts
function asArgsRecord(raw: unknown, tool: string): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${tool} args must be an object`);
  }
  return raw as Record<string, unknown>;
}

function assertKnownKeys(record, known, tool): void {
  for (const key of Object.keys(record)) {
    if (!known.includes(key)) {
      throw new Error(`${tool}: unknown argument: ${key}`);
    }
  }
}
// optionalNumber / optionalString follow the same shape
```

Read the comment block above them at `tools.ts:51-54`. It states the convention
in one sentence: _"throws on ANY unknown key, naming it so the loop can feed the
reason back and the model can self-correct."_ That is the behaviour you are
preserving.

**Note `asArgsRecord`'s first line** (`tools.ts:57`): `undefined` and `null`
become `{}` rather than throwing. `tools.test.ts:63` pins that
(`validateTokenUsage(undefined)`).
Zod does not do this. Keep it in mind for Step 3.4.

---

## Commands You'll Need

| Purpose                          | Command                                                          | Expected on success                |
| -------------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| **Your gate** — errors in `src/` | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^src/"`    | `0`                                |
| Backend errors (must not grow)   | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^convex/"` | `6`                                |
| Tools tests while iterating      | `./node_modules/.bin/vitest run src/lib/tools.test.ts`           | `44 passed` or higher              |
| Full suite                       | `npm test`                                                       | `Tests 141 passed (141)` or higher |
| Lint                             | `npm run lint`                                                   | `0 errors`                         |
| Probe                            | `npm run probe:backend`                                          | `12 tools checked`                 |
| **See a real message**           | `npx tsx -e "..."` — Step 3.3                                    | a string you read with your eyes   |

That last row is the one that matters in this phase.

---

## Files You'll Touch

| Path                     | Role                 | What it holds                                           | You                   |
| ------------------------ | -------------------- | ------------------------------------------------------- | --------------------- |
| `src/lib/toolSchemas.ts` | Data + Calculation   | Gains `makeValidator`                                   | **Build**             |
| `src/lib/tools.ts`       | Calculation + Action | `validateAggregateStats` becomes three lines            | **Build**             |
| `src/lib/tools.test.ts`  | Calculation          | 279 lines pinning behaviour — plus the one test you add | **Read**, then extend |
| `src/lib/loop.ts`        | Orchestration        | Reads `error.message` at line 123                       | **Read only**         |

---

## Scope

**In scope:** `src/lib/toolSchemas.ts`, `src/lib/tools.ts` (one validator),
`src/lib/tools.test.ts` (one new test).

**Out of scope:**

- **`src/lib/loop.ts`.** The three-way policy at `loop.ts:8-13` is correct and must
  not change. **If you find yourself editing `loop.ts`, your message shape is
  wrong — fix the message, not the loop.**
- **The other nine validators.** ETH-46. One first, so a wrong factory is found
  once rather than ten times.
- **The `ToolResult` union and the `App.tsx` switch.** Return types are not
  changing. Only the argument boundary.
- **Deleting the four helpers.** They still have nine callers. ETH-46 deletes them,
  on evidence.

---

## Git workflow

```bash
git commit -m "refactor: build validateAggregateStats from a Zod factory"
```

One commit. If you split the test out, put it in the same commit as the factory —
the test is the deliverable here, not a follow-up.

---

## Background Concept: the error message is not for you

Most error messages have one reader: a human, later, with the source open. That
reader has enormous context. They can be told `Invalid input` and figure it out.

This message has a different reader. A language model, five hundred milliseconds
later, with no source, no filesystem, and four remaining steps. It has just made
twelve tools' worth of possible calls collapse into one wrong one, and the only
thing it will ever learn about the mistake is the string you hand it.

Think about a script supervisor's note to an actor between takes. _"That was
wrong"_ is true and worthless. _"You said 'Tuesday', the line is 'Thursday'"_
gets a correct take next time. Same information content in a formal sense;
completely different number of takes.

So the design question for this phase is not "does it throw" but **"can the
reader act on it in one step?"** Which decomposes into three:

1. **Which tool?** Twelve registered. The message must say.
2. **Which field?** Zod gives you this for free, in `error.issues[].path`.
3. **How many problems?** If you report only the first, a call with three bad
   fields takes three round trips against a five-step cap.

**Category note:** `makeValidator` is a **Calculation that returns a
Calculation** — a factory. The returned function is `unknown` in, typed args or a
throw out. No side effects, no world. The throw is its single failure exit, and
keeping it single is why the plan file prefers `safeParse` over `parse` in a
`try/catch`: with `safeParse` the failure is a value you inspect and then convert
into exactly one throw you control.

---

## Phase 3: Rebuild one validator on a factory

### Step 3.1: The stub

Add to `src/lib/toolSchemas.ts`:

```ts
/**
 * CATEGORY: Calculation (factory) - returns a Calculation.
 *
 * Builds a validator for one tool. The returned function takes untyped LLM JSON
 * and returns typed args, or throws a message the MODEL will read via
 * loop.ts:123. See the tutorial's Background section for what that message owes
 * its reader.
 */
export function makeValidator</* TODO(you): type param */>(
  toolName: string,
  schema: /* TODO(you) */,
): (raw: unknown) => /* TODO(you): what comes out? */ {
  return (raw: unknown) => {
    // TODO(you):
    //   1. Parse. Use the Zod method that returns a RESULT rather than throwing
    //      — a validation failure is the graded path here, not an exception,
    //      and you want the failure as a value you can shape.
    //   2. On success, return the parsed data.
    //   3. On failure, throw ONE Error whose message answers all three questions
    //      from the Background section. The issues are on the error object; look
    //      at what each issue carries before you decide on a format.
    throw new Error("not implemented");
  };
}
```

The return type is a real question. `z.infer<S>` is the obvious answer — check
whether it actually matches what `validateAggregateStats` is declared to return
today (`AggregateStatsArgs`), and whether ETH-42's bind makes that guaranteed or
merely true right now.

### Step 3.2: Rebuild `validateAggregateStats`

Keep the export name. Call sites and the existing tests must not change.

```ts
// src/lib/tools.ts — replaces the fifteen-line version at :106-119
export const validateAggregateStats = makeValidator(/* TODO(you) */);
```

The plan file says this should end up "three lines". If yours is more, ask what
the extra lines are doing and whether they belong in the factory instead.

### Step 3.3: The trap — read this before you feel finished

Run the tools tests.

```bash
./node_modules/.bin/vitest run src/lib/tools.test.ts
```

**They pass.** All of them. Including `tools.test.ts:56-58`:

```ts
it("throws on an unknown key, naming it so the LLM can self-correct", () => {
  expect(() => validateAggregateStats({ days: 7 })).toThrow(/days/);
});
```

Now look at that assertion closely. It is `toThrow(/days/)` — a regex on the
field name. A bare `schema.parse(raw)` throws `Unrecognized key: "days"`, which
matches `/days/` perfectly. **The test whose name says "naming it so the LLM can
self-correct" does not check that the tool is named.**

The same is true of the other error assertions in the file: `/failed/`,
`/chatJid/`. Every one is a regex on a field or a word, none on the tool name.

So: go and actually look at what your factory produces.

```bash
npx tsx -e "
import { validateAggregateStats } from './src/lib/tools';
try { validateAggregateStats({ days: 7, after: 'nope' }); }
catch (e) { console.log(JSON.stringify(e.message)); }
"
```

Read the string. Then answer:

```text
Does it name the tool?                          yes / no
Does it name every bad field, or just the first? ______
How many round trips does a model need to fix
  a call with two bad fields, given this message? ______
Would the existing suite have caught it if the
  answer to line 1 were "no"?                    yes / no
```

**Why this matters more than the code.** You could have shipped this. The suite
was green, the diff was small, and the thing that broke would have shown up as
"the model seems worse at recovering from tool errors lately" — three weeks later,
with no failing test to point at.

**A green suite proves you broke nothing that was tested.** Read the assertions to
find out what was never tested.

### Step 3.4: Two behaviours Zod does not give you for free

Check both before you call this done.

**`undefined` and `null` args.** `asArgsRecord` at `tools.ts:57-58` returns `{}`
for both rather than throwing, and `tools.test.ts:63` pins it
(`validateTokenUsage(undefined)` must equal `{ after: 0 }`). What does
`z.strictObject({...}).safeParse(undefined)` do? Try it. If it fails, your factory
needs to normalise before parsing — and that normalisation is exactly one line of
the old `asArgsRecord`, which is fine to reproduce.

**Non-object args.** `asArgsRecord` throws `${tool} args must be an object` for
arrays and primitives. What does Zod say for `safeParse([1,2,3])`? Is the message
as clear to the model? If not, is that worth special-casing, or is the Zod message
good enough? Decide on purpose and leave a comment.

### Step 3.5: Write the test nobody wrote

Add to `src/lib/tools.test.ts`, in the `validateAggregateStats` describe block:

```ts
it("names the tool in the message, so the model knows WHICH call was wrong", () => {
  // TODO(you): assert on the tool name, not the field name.
  //   - The existing test uses toThrow(/days/). Yours must fail if the tool
  //     name is removed and pass if it is present.
  //   - Prefer asserting the message STARTS with the tool name over asserting
  //     it merely contains it — "contains" would also be satisfied by a stack
  //     trace or an unrelated mention.
  //   - Then verify your own test: delete the prefix from makeValidator, watch
  //     this go red, put it back, watch it go green. A test you have not seen
  //     fail is not a test.
});
```

Consider a second one for the multi-issue case: a call with two bad fields should
produce a message naming **both**, so the model fixes them in one step rather than
two. Whether to add it is your call; the plan file's Approach section argues for
reporting all issues, and an assertion is how that survives ETH-46.

### Step 3.6: Quiz yourself

Answer in writing before opening anything.

1. `loop.ts:123` does `error instanceof Error ? error.message : String(error)`.
   Your factory throws a `new Error`. What would happen if you threw the
   `ZodError` directly instead — would `loop.ts` handle it, and would the model
   see something useful?

   i think a ZodError object would give us more useful primitives.

2. The plan file says `safeParse` "leaves the function a Calculation with a single
   throwing exit". What is the _second_ exit you get if you use `parse` inside a
   `try/catch` and re-throw? Why does that matter for the message contract?

   i can't find safeParse in the zod docs

3. `loop.ts:129-135` caps the loop at five steps. You have a call with three bad
   fields. Compare total round trips for (a) first-issue-only messages and
   (b) all-issues messages. At what number of bad fields does (a) exhaust the cap?

   if we were using first-issue-only then it doesn't matter how many bad fields an object has
   you would throw and still have 4 tries left with first-issue-only turned on.

4. Your message format is now a contract with a model. If ETH-46 migrates the
   other nine tools and one of them formats differently, what breaks — and would
   any test catch it?

   this is where i was thinking ahead. having a discriminated union of all the possible types would prevent things
   from breaking b/c you would see the error before your proram runs.

5. The existing suite's error assertions are all regexes on field names. Now that
   you know that, is `toThrow(/days/)` a bad test? Argue both sides before
   deciding.

   i personally think this is a bad pattern, but the error we get back is a string literal, not an object.

<details>
<summary>Hints — open only if stuck for more than fifteen minutes</summary>

- **`safeParse` shape:** returns `{ success: true, data }` or
  `{ success: false, error }`. The error is a `ZodError` and its `issues` array is
  what you want — each issue has `path` (an array) and `message`.
- **Formatting:** joining issues with `; ` and prefixing `` `${toolName}: ` ``
  answers all three Background questions in one line. Rendering `path` needs a
  `join(".")` because it is an array; an empty path means the problem is with the
  root object rather than a field, which is worth handling.
- **Step 3.4, undefined:** `safeParse(undefined)` on a `strictObject` fails —
  `undefined` is not an object. Normalise with the same
  `raw ?? {}` idea `asArgsRecord` uses. One line, at the top of the returned
  function.
- **Q1:** `ZodError` extends `Error`, so `loop.ts` would pass it through and the
  model would get `error.message` — which is the raw, tool-less message. It
  "works" and loses the thing this phase exists to keep. That is the trap again,
  wearing a different hat.
- **Q2:** re-throwing inside a catch means the throw site and the shaping site are
  different places, and it becomes easy to add a second `throw` later that skips
  the shaping. One exit, one format.
- **Q5:** a defensible answer is that `toThrow(/days/)` is a _fine_ test of the
  thing it names in its assertion and a _badly named_ test, since its title
  promises more than it checks. Renaming it is arguably part of this ticket.

</details>

### Step 3.7: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
./node_modules/.bin/vitest run src/lib/tools.test.ts   # → passes, count +1 or +2
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"   # → 0
npm test                                                # → 141 or higher
npm run lint                                            # → 0 errors
npm run probe:backend                                   # → 12 tools checked
```

Then the one that is not a command: paste your error message for
`{ days: 7, after: "nope" }` into the commit message. A reviewer needs to see the
string, because no assertion shows it to them.

**Only now** open `zod-migration-tutorial.md` Phase 3's `### ✅ Solution`. Compare
formats. If yours differs, the question is not which is prettier — it is which one
a model can act on in fewer steps.

### ✅ Phase 3 complete

- `validateAggregateStats` is three lines built from `makeValidator`.
- A test pins the tool name, and you have watched it fail with the prefix removed.
- `loop.ts` is untouched.
- You can state, from memory, why the pre-existing suite could not have caught
  this regression.

---

## Test plan

1. `./node_modules/.bin/vitest run src/lib/tools.test.ts` → passes, count
   unchanged or higher.
2. **The new tool-name test fails if the prefix is removed.** Do this, watch it,
   restore.
3. `npm test` → `Tests 141 passed (141)` or higher.
4. `./node_modules/.bin/tsc -b --noEmit` → `0` in `src/`, `6` in `convex/`.
5. `npm run lint` → `0 errors`.
6. `git diff --stat src/lib/loop.ts` → empty.
7. Manual: the `npx tsx` snippet from Step 3.3, message pasted into the commit.

---

## Done criteria

- `validateAggregateStats` is three lines built from the factory, and its export
  name is unchanged.
- `makeValidator` is exported from `toolSchemas.ts`, is generic, and has no `any`.
- A test pins the tool name in the message.
- `undefined` and `null` args still produce `{}` rather than throwing (or the
  behaviour change is deliberate, tested, and noted).
- `git diff` touches exactly three files.

---

## STOP conditions

- `toParameters` is missing from `toolSchemas.ts` — ETH-43 is not done.
- You are editing `src/lib/loop.ts`. Stop. The message shape is wrong instead.
- An **existing** assertion in `tools.test.ts` needs changing to pass. That test is
  pinning behaviour the model depends on; changing it is how this phase goes
  wrong. Report rather than edit.
- `npm test` drops below 141.
- You cannot make your new tool-name test fail by removing the prefix. Then it is
  not testing the prefix, and you have reproduced the exact bug this phase is
  about — at one level up.

---

## What You Should Know Now

1. An error message that another system reads is an interface, and changing its
   shape is an API change.
2. A green suite proves you broke nothing _tested_. Read the assertions to find
   out what was never tested — here, ten error tests and not one checked the tool
   name.
3. A test whose title promises more than its assertion checks is worse than no
   test, because it stops anyone from writing the real one.
4. `safeParse` turns a failure into a value, which lets you keep exactly one
   throwing exit and therefore exactly one message format.
5. When the reader has a step budget, reporting all problems at once is not
   thoroughness — it is arithmetic.

---

## Reference

### Troubleshooting

**Problem:** `validateTokenUsage(undefined)` now throws.
**Solution:** Step 3.4. Zod will not treat `undefined` as `{}`; normalise before parsing.

**Problem:** Your factory's return type is `unknown` at the call site.
**Solution:** The generic parameter is not constrained to a Zod type, so `z.infer` cannot resolve. Constrain it.

**Problem:** The new tool-name test passes even with the prefix removed.
**Solution:** Your regex is too loose. `/getAggregateStats/` will match anywhere in the string, including inside a field name or a path. Anchor it.

**Problem:** `probe:backend` reports drift after this phase.
**Solution:** Unexpected here — this phase does not touch `parameters`. If it drifted, check whether you changed the schema rather than the validator.

### Key takeaways

1. Know who reads your error message before you decide what it says.
2. One throwing exit, one format.
3. Break your own new test once, immediately.
4. `ZodError extends Error`, so the wrong thing compiles and runs.

**End of Tutorial**
