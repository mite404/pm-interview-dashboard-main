---
linear: ETH-43
linear_url: https://linear.app/mite404-workspace/issue/ETH-43/generate-the-model-facing-json-schema-from-the-zod-schema
github: 22
filed: 2026-08-24
parent: ETH-41
plan: 002-zod-generate-model-parameters.md
---

# Generate the model-facing JSON Schema from the Zod schema

_For the executor: this is the hands-on sheet for `002-zod-generate-model-parameters.md`.
The plan file says what to build. This says what to try and how to know you got
it right._

> **Blocked until ETH-42 lands.** This phase imports `aggregateStatsSchema` from
> `src/lib/toolSchemas.ts`, which ETH-42 creates. If that file does not exist
> yet, stop and do `001-zod-bind-schema-to-backend-tutorial.md` first.

> **Where the answer lives.** `zod-migration-tutorial.md`, Phase 2, has a
> `### ✅ Solution` section with the finished function. **Do not open it until
> Step 2.5.** The whole exercise here is one function and one line, and reading
> ahead removes both.

**Drift check, run this first:**

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
test -f src/lib/toolSchemas.ts && echo "ETH-42 landed" || echo "STOP: do ETH-42 first"
git diff --stat 12b44d2..HEAD -- src/lib/tools.ts
```

**Goal:** Delete the sixteen-line `parameters` literal on `getAggregateStatsTool`
and replace it with a call to a new pure function `toParameters(schema)`.

**Learning style:** One pure function. The interesting part is not writing it —
it is deciding what "correct" means when the consumer is an external system that
cannot complain.

**Prerequisites:** ETH-42 complete. You can read a JSON Schema object.

**Estimated time:** ~1h. The function is three lines. The hour is Step 2.2.

---

## Status

- **Initial priority:** P2
- **Effort:** S (1 point)
- **Risk:** LOW, with one external unknown — see Notes.
- **Depends on:** ETH-42 (001)
- **Blocks:** nothing directly, but ETH-46 deletes twelve of these literals using the function you write here.
- **Category:** refactor
- **Planned at:** commit `12b44d2`, 2026-08-24

---

## Why this matters

`RegisteredTool.parameters` — declared at `src/lib/types.ts:175` as
`Record<string, unknown>` — is the model's **only** description of what a tool
accepts. It leaves the process at `src/lib/tools.ts:869-878`, where
`toOpenRouterTools` copies it straight onto the wire.

Today it is a sixteen-line object literal typed by hand. It is the copy most
likely to drift, for a specific reason: **nothing in this repo reads it.** The
tests do not assert on it. The validator does not consult it. The only consumer
is an external system that will happily accept a stale description and then send
you arguments shaped by it.

A drift check run on 2026-08-22 walked all twelve tools and found `0 drift(s)`.
The copies agree. They agree because someone was careful — which works until tool
thirteen.

Deleting the literal makes drift impossible rather than detectable. That is the
whole trade this phase makes.

---

## Current state

`src/lib/tools.ts:148-163` — the literal, verbatim, is the thing you are deleting:

```ts
  parameters: {
    type: "object",
    properties: {
      after: {
        type: "number",
        description:
          "Optional unix-ms lower bound on a run's creation time. Omit for " +
          "all-time, which is the usual case.",
      },
      groupFolder: {
        type: "string",
        description: "Optional group folder to scope to. Omit for all groups.",
      },
    },
    additionalProperties: false,
  },
```

Every field name and every description string in there already exists in
`aggregateStatsSchema` after ETH-42 — you carried them over verbatim, which is
why ETH-42 insisted on `.describe()`.

---

## Commands You'll Need

| Purpose                                   | Command                                                          | Expected on success                  |
| ----------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| **Your gate** — errors in `src/`          | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^src/"`    | `0`                                  |
| Backend errors (must not grow)            | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^convex/"` | `6`                                  |
| Prove the tools still advertise correctly | `npm run probe:backend`                                          | `12 tools checked`                   |
| Tools unit tests                          | `./node_modules/.bin/vitest run src/lib/tools.test.ts`           | passes, unchanged                    |
| Full suite                                | `npm test`                                                       | `Tests 141 passed (141)`             |
| Count remaining hand-written literals     | `grep -c "additionalProperties" src/lib/tools.ts`                | **one less** than before your change |
| Eyeball what Zod actually emits           | `npx tsx -e "..."` — see Step 2.2                                | a JSON object                        |

Take the "before" number for the `grep -c` row **now**, before you edit anything.

---

## Files You'll Touch

| Path                     | Role                 | What it holds                                                       | You                                |
| ------------------------ | -------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `src/lib/toolSchemas.ts` | Data → + Calculation | Gains `toParameters`                                                | **Build**                          |
| `src/lib/tools.ts`       | Calculation + Action | One registry entry changes                                          | **Build** (one line, one deletion) |
| `src/lib/types.ts`       | Data                 | `RegisteredTool.parameters` at line 175 — the type you must satisfy | **Read only**                      |
| `scripts/probe-tools.ts` | Action               | What `npm run probe:backend` runs                                   | **Read** — worth five minutes      |

---

## Scope

**In scope:** `src/lib/toolSchemas.ts`, and exactly one registry entry in
`src/lib/tools.ts`.

**Out of scope:**

- **The tool `description` strings** (the top-level one on the registry entry, not the per-field ones). They stay where they are.
- **The other eleven `parameters` literals.** That is ETH-46. Doing them here makes the diff unreviewable and hides whether the function is right.
- **`src/lib/loop.ts`.**
- **`validateAggregateStats`.** Argument _validation_ is ETH-44. This phase only touches what the model _reads_.

---

## Background Concept: the schema as a publishable document

You have two audiences for the same fact.

Inside the process, "what does `getAggregateStats` accept?" is answered by a Zod
schema — a live object you can call `.parse()` on. It has behaviour.

Outside the process, OpenRouter needs the same fact as **inert JSON**. It cannot
call your schema. It gets a description, reads it, and shapes its tool calls
around it.

Think of a shooting script versus the call sheet. Same production, same facts,
two documents with different jobs — and the call sheet is the one that goes to
people who are not in the room and cannot ask a follow-up question. When they
diverge, the crew shows up at the wrong location and nobody finds out until
morning.

The move in this phase is to stop typing the call sheet and start **printing** it
from the script.

**Category shift, worth naming:** `toParameters` is the first **Calculation** in
`toolSchemas.ts`. Everything ETH-42 put there was Data — inert schema values and
type aliases. This is a function: same schema in, same JSON out, no side effects,
every time. Keeping it in the same file is deliberate — it belongs next to the
thing it transforms — but it is a different category and the file's header
comment should stop claiming otherwise.

---

## Phase 2: Print the call sheet

### Step 2.1: The stub

Add to `src/lib/toolSchemas.ts`:

```ts
/**
 * CATEGORY: Calculation - schema in, JSON Schema out. No side effects.
 *
 * Emits the JSON Schema object that OpenRouter's `tools[].function.parameters`
 * expects, derived from the Zod schema rather than hand-written.
 */
export function toParameters(schema: /* TODO(you): what type? */): Record<string, unknown> {
  // TODO(you):
  //   1. Zod 4 has a top-level function that renders a schema as JSON Schema.
  //      Find it. (It is not a method on the schema.)
  //   2. Its output contains one key that OpenRouter does not want and that the
  //      current hand-written literal does not have. Compare the two before you
  //      decide what to strip — do NOT guess from this comment.
  //   3. Return type must satisfy `RegisteredTool.parameters` at types.ts:175.
  throw new Error("not implemented");
}
```

The parameter type is a real question, not a formality. It has to accept
`aggregateStatsSchema` today and eleven more schemas of different shapes in
ETH-46. Pick something that does not force a cast at every call site.

### Step 2.2: Look before you write

**Do this before implementing.** Print what Zod actually emits and diff it, by
eye, against the literal at `tools.ts:148-163`:

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
npx tsx -e "
import { z } from 'zod';
import { aggregateStatsSchema } from './src/lib/toolSchemas';
console.log(JSON.stringify(z.toJSONSchema(aggregateStatsSchema), null, 2));
"
```

Write down, in your own words, every difference between that output and the
literal. There should be **exactly one** if ETH-42's descriptions were carried
over verbatim. If you find more than one, that is a finding — ETH-42 lost
something, and you should fix it there rather than paper over it here.

The one expected difference is a top-level key that JSON Schema uses for
versioning. OpenRouter does not want it.

**Now the real question, and the point of the hour:** how do you remove it?

- Destructure it off and spread the rest?
- `delete` it from the returned object?
- Filter the keys?

They produce the same JSON. They do **not** have the same properties. One of them
mutates an object that Zod may or may not be caching between calls. Work out
which, and whether it matters here. (`z.toJSONSchema` returning a fresh object
each call is an implementation detail you have not verified — write the version
that is correct either way.)

**The second decision, which will not announce itself.** `z.toJSONSchema` takes
an options object with an `io` field. It defaults to `"output"`. Run the Step 2.2
probe again with `{ io: 'input' }` and diff the two. For _this_ schema they are
byte-identical, which is why the choice is easy to skip. Now run the shape ETH-45
is about to add:

```bash
node -e "
const { z } = require('zod');
const S = z.strictObject({ after: z.number().default(0) });
for (const io of ['output', 'input'])
  console.log(io, JSON.stringify(z.toJSONSchema(S, { io })));
"
```

Verified on the installed Zod 4.4.3:

```
output {... "properties":{"after":{"default":0,"type":"number"}},"required":["after"], ...}
input  {... "properties":{"after":{"default":0,"type":"number"}}, ...}
```

The default exists so the model can _omit_ `after`. Output mode advertises it as
`required`, the opposite instruction. Decide which mode describes the document
you are publishing. `parameters` tells the model what to **send**, and what it
sends is the parser's input, not its output. Pass that mode explicitly now, while
both emit the same thing and a wrong choice costs nothing, rather than in ETH-45
when it starts lying to the model.

A second effect, which does not change the code but is worth knowing. In `output`
mode `z.object` and `z.strictObject` emit identical JSON, both carrying
`additionalProperties: false`. In `input` mode only `strictObject` does. So the
mode you just picked for unrelated reasons is also the only one where your Phase 1
constructor choice shows up in the emitted document.

**Why this approach, deleting the literal rather than testing it?** The
alternative is to keep the hand-written block and add a conformance test that
compares it to the schema. `assets/drift-check.ts` in the teaching workspace
already does exactly that, and it found `0 drift`. But a test detects drift
_after_ someone writes it and only for the tools it covers. Deleting the literal
means there is no second copy to drift. Prefer removing the failure mode to
detecting it.

### Step 2.3: Swap the registry entry

In `src/lib/tools.ts`, replace the entire `parameters: { ... }` block on
`getAggregateStatsTool` with a call to your function. Import from `./toolSchemas`.

One line replaces sixteen. Do not touch `description`, `name`, or `execute`.

### Step 2.4: Quiz yourself

1. `RegisteredTool.parameters` is typed `Record<string, unknown>`. Your function returns something Zod produced. What guarantees those are compatible, and what would happen if Zod's return type were narrower?
2. `npm run probe:backend` prints `12 tools checked`. Read `scripts/probe-tools.ts`. What exactly does it check — and would it notice if `toParameters` dropped the `properties` key entirely?
3. Nothing in `src/lib/tools.test.ts` asserts on `parameters`. After this change, what is the **first** thing that would break if `toParameters` were wrong, and how long after your commit does that happen?
4. Your answer to (3) is probably "nothing, until a live model call". Given that: is `probe:backend` passing sufficient evidence to merge this? What would you add?
5. `.describe()` on a Zod field and `description` in JSON Schema — is that mapping guaranteed by Zod, or is it something you verified once and are now depending on? Which is it, and does the distinction change what you'd do?
6. You passed `io` explicitly even though both modes emit the same thing for every schema that exists today. Name the check in this repo that would fail if you had left it defaulted.

<details>
<summary>Hints — open only if stuck for more than fifteen minutes</summary>

- **Step 2.1, the parameter type:** you want something that accepts any Zod schema. `z.ZodType` is the broad base. Narrower options exist but will fight you in ETH-46 when the shapes diverge.
- **Step 2.2, the extra key:** it starts with a `$`.
- **Step 2.2, the `io` mode:** `parameters` describes what the model sends you. Defaults, coercion and transforms all sit between a schema's input and its output, so the two are different documents whenever a schema uses any of them. Pick the side of the parser the model is on.
- **Q6:** there is no such check, and that is the answer. Nothing asserts on `parameters`, so the explicit argument is the only thing standing in for a test.
- **Step 2.2, removal:** destructuring-and-rest gives you a new object and never touches the original. `delete` mutates whatever you were handed. Only one of those is safe against a caching implementation you have not read.
- **Q1:** `Record<string, unknown>` is wide. Anything object-shaped satisfies it. The risk runs the other way — you could return something structurally wrong and the type system would be fine with it. That is exactly why Q3 and Q4 are on this list.
- **Q4:** the cheapest real evidence is a snapshot or equality assertion in `src/lib/tools.test.ts` comparing `getAggregateStatsTool.parameters` to the literal you deleted — pasted in from git history. It pins the emitter's output to the thing that demonstrably worked in production. That is one test and about ten minutes, and it is not in the plan file's Steps. Deciding whether to add it anyway is a legitimate judgement call; make it deliberately.

</details>

### Step 2.5: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"    # → 0
npm run probe:backend                                          # → 12 tools checked
./node_modules/.bin/vitest run src/lib/tools.test.ts           # → passes, unchanged
grep -c "additionalProperties" src/lib/tools.ts                # → one less than your "before"
npm test                                                       # → 141 passed
```

**Only now** open `zod-migration-tutorial.md` Phase 2's `### ✅ Solution`. If your
removal strategy differs from the one there, work out what each protects against
before deciding whose you prefer.

### ✅ Phase 2 complete

- No hand-written `parameters` literal remains on `getAggregateStatsTool`.
- `toParameters` is exported, pure, and typed to accept the other eleven schemas.
- The probe still reports 12 tools checked.
- You can state what evidence you have that the emitted object is _right_, not just _present_.

---

## Test plan

1. `tsc` gate: `0` in `src/`, `6` in `convex/`.
2. `npm run probe:backend` → `12 tools checked`.
3. `./node_modules/.bin/vitest run src/lib/tools.test.ts` passes unchanged.
4. `grep -c "additionalProperties" src/lib/tools.ts` drops by exactly one.
5. `npm test` → `Tests 141 passed (141)`.
6. Manual, and the only one that tests the _content_: run the `npx tsx` snippet from Step 2.2 and diff its output against the literal recovered from git history (`git show HEAD:src/lib/tools.ts | sed -n '143,158p'`). They should describe the same thing.

---

## Done criteria

- `getAggregateStatsTool.parameters` is a function call, not a literal.
- `toParameters` lives in `toolSchemas.ts`, is pure, and has no `any`.
- `toParameters` passes `io` to `z.toJSONSchema` explicitly rather than taking the default.
- `npm run probe:backend` reports 12 tools checked.
- `git diff` touches exactly two files.

---

## STOP conditions

- `src/lib/toolSchemas.ts` does not exist — ETH-42 is not done.
- The Step 2.2 diff shows **more than one** difference. Something was lost in ETH-42; fix it there.
- `probe:backend` reports drift. That is not a bug in the probe. It found a real disagreement between what a tool advertises and what its validator accepts — which is the thing the probe exists for. Fix the schema.
- You are tempted to migrate a second tool "while you are in here". Don't; that is ETH-46 and it is scoped separately on purpose.

---

## Notes / risk

Risk is LOW with one external unknown: `z.toJSONSchema` output has **not** been
sent to OpenRouter in production. If the probe passes but live tool calls
degrade, bring the emitted object back to something known-good rather than
guessing at a transform — the recovered literal is in git history and is proven.

The `io` mode is the one decision in this phase whose consequence lands in a
later ticket rather than this one. Every schema in `toolSchemas.ts` today is
plain optionals, so both modes emit identical JSON and no gate in the repo can
distinguish them. ETH-45 adds `after: z.number().default(0)` to
`getAggregateTokenUsage`, and from that commit on, `io: "output"` emits
`required: ["after"]` for a field the model is supposed to be free to omit. The
suite stays green through that, because nothing asserts on `parameters`.

---

## What You Should Know Now

- A copy that nothing internal reads is the copy most likely to be wrong, because there is no pressure keeping it honest.
- Deleting a duplicate beats testing it. A test detects drift; a deletion prevents it.
- A green suite proves you broke nothing _tested_. Read the assertions to find out what was never tested — here, `parameters` never was.
- `Record<string, unknown>` accepts almost anything, so the compiler is not your evidence in this phase. Know what is.
- Purity has a reason: `toParameters` must not mutate what it is handed, because you have not read whether Zod caches it.
- A default in an emitter is a decision someone made for you. `z.toJSONSchema` defaults to `io: "output"`; the document you are publishing describes input. Read the options object of anything you generate a contract from.
- The cheapest time to fix a wrong default is while it is still invisible. Once ETH-45's `.default(0)` lands, the same wrong default is a live instruction to the model and nothing in the suite objects.

---

## Reference

### Troubleshooting

**Problem:** `npx tsx -e` cannot resolve `./src/lib/toolSchemas`.
**Solution:** Use an absolute path, or run through vitest instead: put the `console.log` in a temporary `.test.ts` and `vitest run` it.

**Problem:** `probe:backend` reports drift after your change.
**Solution:** Real finding, not a false positive. Your emitted properties and your validator's accepted keys disagree — compare them field by field.

**Problem:** `tsc` complains your function's return type is not assignable to `Record<string, unknown>`.
**Solution:** Zod's emitted type is probably a named interface with optional index behaviour. Widen at the boundary rather than casting at the call site.

**Problem:** The emitted JSON is missing the field descriptions.
**Solution:** ETH-42's `.describe()` calls were dropped or placed after a wrapper that discards them. Fix in `toolSchemas.ts`, not here.

### Key takeaways

1. Print the document, do not retype it.
2. A conformance test and a deletion solve different problems; the deletion is stronger when you are allowed to take it.
3. When the only consumer is external, "the tests pass" is not evidence about correctness — name what is.
4. Never mutate an object you were handed by a library whose caching you have not read.

**End of Tutorial**
