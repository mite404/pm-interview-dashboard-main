---
linear: ETH-46
linear_url: https://linear.app/mite404-workspace/issue/ETH-46/migrate-the-remaining-eight-tools-and-delete-the-hand-rolled-helpers
github: 25
filed: 2026-08-24
parent: ETH-41
plan: 005-zod-finish-registry-delete-helpers.md
---

# Migrate the remaining eight tools and delete the hand-rolled helpers

_For the executor: this is the hands-on sheet for `005-zod-finish-registry-delete-helpers.md`.
The plan file says what to build. This says what to try, in what order, and how to
know you got it right. This is the last phase — when it lands, the migration is
one complete thing._

> **Blocked until ETH-45 lands.** Two of the eight tools reuse patterns 004
> establishes (an enum, a required-not-optional field). Do 004 first.

> **Where the answer lives.** `zod-migration-tutorial.md`, Phase 5, has a
> `### ✅ Solution`, and the "Full reference implementation" section near the end
> of that document sketches the finished registry entry shape. **Do not open
> either until Step 5.7.** By this phase you have written the pattern four times;
> the value here is doing it eight more times _without_ the reference, and
> noticing the three that do not fit.

**Drift check, run this first:**

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
grep -c "^export const .*Schema" src/lib/toolSchemas.ts   # → 4 or more (001-004)
grep -rn "asArgsRecord" src/lib/ | wc -l                  # take this number NOW
git status --porcelain                                    # → clean
```

Write down that `asArgsRecord` count. Step 5.6 compares against it.

**Goal:** Every one of the twelve registry entries derives its `parameters` and
its validator from one Zod schema, and the four hand-written helpers at
`src/lib/tools.ts:56-98` are deleted — on evidence.

**Learning style:** Eight repetitions, one commit each, deliberately unglamorous.
Three of the eight are not what they look like. The last step is a deletion you
have to earn.

**Prerequisites:** ETH-42 through ETH-45 complete.

**Estimated time:** ~3h. Eight small migrations plus one careful deletion. The
suite runs in 1.55 seconds, which is why one-commit-per-tool costs you nothing.

---

## Status

- **Initial priority:** P2
- **Effort:** M (3 points)
- **Risk:** MED, **spread across twelve sites rather than concentrated**. No single
  step is dangerous; the danger is doing eight at once and bisecting later.
- **Depends on:** ETH-45 (004)
- **Blocks:** nothing. This closes ETH-41.
- **Category:** refactor
- **Planned at:** commit `12b44d2`, 2026-08-24

---

## Why this matters

Until all twelve are migrated, the codebase carries **both systems**, which is
worse than either one alone.

Concretely: the helpers at `tools.ts:56-98` stay reachable and stay imported.
A thirteenth tool written next month against the old pattern would look
completely normal in review — there would be nine examples of it in the same
file. Nothing signals which pattern is current.

Half a migration is not half the benefit. It is the old system plus a new system
plus the question "which one applies here?", asked forever.

The deletion at the end is the actual deliverable. Everything before it is
setup.

---

## Current state

The registry, `src/lib/tools.ts:853-866`, holds twelve tools. Four are done
(ETH-42 through ETH-45). **Eight remain:**

| Tool               | Validator               | Bind target                                 | Note                              |
| ------------------ | ----------------------- | ------------------------------------------- | --------------------------------- |
| `listAll`          | `tools.ts:417`          | `ListAllArgs` (`types.ts:136`) → `{}`       | same shape as `listConversations` |
| `pause`            | `tools.ts:458` (shared) | `PauseArgs` (`types.ts:146`)                | see Step 5.3                      |
| `resume`           | `tools.ts:458` (shared) | `ResumeArgs` (`types.ts:147`)               | see Step 5.3                      |
| `enqueue`          | `tools.ts:549`          | `EnqueueArgs` (`types.ts:150`)              |                                   |
| `getReplyLineage`  | `tools.ts:648`          | `ReplyLineageArgs` (`types.ts:155-157`)     | four fields, two optional caps    |
| `listCostRollups`  | **not in `tools.ts`**   | `CostRollupsArgs` (`types.ts:159-161`)      | see Step 5.4                      |
| `dailyUniqueUsers` | `tools.ts:788`          | `DailyUniqueUsersArgs` (`types.ts:163-165`) | carries a `lane` enum             |

That is seven rows for eight tools, because `pause` and `resume` share one
validator.

The four helpers to delete, all at `src/lib/tools.ts:56-98`:
`asArgsRecord`, `assertKnownKeys`, `optionalNumber`, `optionalString`.

---

## Commands You'll Need

| Purpose                            | Command                                                                         | Expected on success       |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| **Your gate**                      | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^src/"`                   | `0`                       |
| Backend errors                     | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^convex/"`                | `6`                       |
| Tools tests (run after EVERY tool) | `./node_modules/.bin/vitest run src/lib/tools.test.ts`                          | all pass                  |
| Full suite                         | `npm test`                                                                      | `141 passed` or higher    |
| Lint                               | `npm run lint`                                                                  | `0 errors`, ≤21 warnings  |
| Probe                              | `npm run probe:backend`                                                         | `12 tools checked`        |
| **The deletion gate**              | `grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/` | see Step 5.6              |
| Count remaining literals           | `grep -c "additionalProperties" src/lib/tools.ts`                               | `0` at the end            |
| End-to-end                         | `npm run dev` + `npm run test:e2e`                                              | all Playwright specs pass |

---

## Files You'll Touch

| Path                     | Role                 | What it holds                                     | You           |
| ------------------------ | -------------------- | ------------------------------------------------- | ------------- |
| `src/lib/toolSchemas.ts` | Data + Calculation   | Eight more schemas and binds                      | **Build**     |
| `src/lib/tools.ts`       | Calculation + Action | Eight registry entries; then −43 lines of helpers | **Build**     |
| `src/lib/cost.ts`        | Calculation          | `validateCostRollups` lives here — see Step 5.4   | **Build**     |
| `src/lib/types.ts`       | Data                 | Bind targets, lines 136-165                       | **Read only** |
| `src/lib/tools.test.ts`  | Calculation          | The assertions you must not edit                  | **Read only** |

---

## Scope

**In scope:** `src/lib/toolSchemas.ts`, `src/lib/tools.ts`, `src/lib/cost.ts`.

**Out of scope:**

- **`assets/drift-check.ts` in the teaching workspace.** It becomes redundant once
  the bind covers all twelve, but it lives outside this repo. **Note it; do not
  delete silently.** After this lands it is checking that a value equals itself.
- **`convex/`** and its 6 pre-existing type errors.
- **Editing any existing assertion in `tools.test.ts`.** Same rule as ETH-45.
- **`src/lib/loop.ts`.**
- **Tool `description` strings.** They move verbatim. Rewording is a separate
  ticket.

---

## Git workflow

**One commit per tool.** Eight commits, then a ninth for the deletion.

```bash
git commit -m "refactor: bind listAll to a Zod schema"
# ... x8
git commit -m "refactor: delete the hand-rolled validation helpers"
```

The suite runs in 1.55 seconds. Batching buys you nothing and costs you bisect
time when tool six turns out to have been wrong.

---

## Background Concept: the check that outlives its reason

There is a specific failure mode at the end of a migration and it is worth naming
before you get there.

You are about to delete four functions. They have been correct for months. They
have tests passing around them. Nothing is _wrong_ with them — they have simply
been made redundant by something better. Deleting working code feels wrong in a
way that deleting broken code does not.

The discipline that makes it safe is one sentence: **delete on evidence, not on
belief.**

"I migrated all twelve tools, so nothing calls these any more" is a belief. It is
probably true. It is also exactly the reasoning that leaves a ninth caller in a
file you forgot about — which, in this repo, is a real risk, because one of your
eight tools validates in a **different file** (`src/lib/cost.ts`, imported at
`tools.ts:10`).

The evidence is a `grep` that returns only the definitions. Run it, read it, and
only then delete. That is the whole ceremony and it takes four seconds.

The same discipline applies one level up, to `assets/drift-check.ts`. After this
phase it is a test that a value equals itself — a check whose reason has
evaporated. It is out of scope to delete (different repo), but the honest move is
to write down that it is now vacuous, because a vacuous test that nobody knows is
vacuous is worse than no test.

---

## Phase 5: Finish the registry, then earn the deletion

### Step 5.1: The repetition, and what to watch for

Six of the eight are straightforward repetitions of what you built in ETH-42
through ETH-45. Do them in this order, easiest first, so that if your pattern is
subtly wrong you find out on a one-line tool rather than a four-field one:

1. `listAll` — `{}`, same as `listConversations`. One line.
2. `pause` — see Step 5.3 before you start.
3. `resume` — falls out of 2.
4. `enqueue`
5. `getReplyLineage` — four fields, two of them optional caps with documented
   defaults (`maxMessages` default 8, `maxChars` default 4000, per the
   `description` strings at `tools.ts:722-729`). Are those defaults enforced
   anywhere, or only advertised? Check before you decide whether the schema needs
   `.default()`.
6. `listCostRollups` — see Step 5.4.
7. `dailyUniqueUsers` — see Step 5.5.

For each, the registry entry collapses to this shape:

```ts
export const someTool: RegisteredTool = {
  name: "someTool",
  description: "...", // unchanged, moved verbatim
  parameters: toParameters(someSchema), // was a 16-line literal
  execute: (rawArgs, deps) =>
    runSomeTool(validateSomeTool(rawArgs), deps).then((data) => ({
      tool: "someTool",
      data,
    })),
};
```

**Verify after every single one:**

```bash
./node_modules/.bin/vitest run src/lib/tools.test.ts && git commit
```

### Step 5.2: A running checklist

Keep this in `/tmp` and tick as you go. It is also your bisect map.

```text
tool                 schema  bind  parameters  validator  tests  committed
listAll                ___    ___      ___        ___      ___      ___
pause                  ___    ___      ___        ___      ___      ___
resume                 ___    ___      ___        ___      ___      ___
enqueue                ___    ___      ___        ___      ___      ___
getReplyLineage        ___    ___      ___        ___      ___      ___
listCostRollups        ___    ___      ___        ___      ___      ___
dailyUniqueUsers       ___    ___      ___        ___      ___      ___

helpers deleted (Step 5.6)                                          ___
```

### Step 5.3: `pause` and `resume` share one argument

`tools.ts:458` is not shaped like the others:

```ts
export function validateTaskDefId(
  toolName: string,
  raw: unknown,
): { taskDefId: Id<"intelligenceTaskDefs"> } {
```

Two parameters, `toolName` first — because two tools share it and the tool name
differs only in the error message.

Read the comment above it at `tools.ts:451-457`. It explains that the cast to the
branded `Id` **is the trust boundary**: runtime JSON can only prove the value is a
non-empty string, and Convex verifies the id server-side and 404s a bad one, which
the loop feeds back for self-correction.

```ts
// TODO(you): ONE shared taskDefIdSchema, TWO validators built from it.
//
//   - Two separate schemas would let two tools that must accept identical
//     arguments drift apart. Do not write two.
//   - The tool name differs only in the error message — which is exactly what
//     makeValidator's first parameter is for. That is not a coincidence; it is
//     why the factory takes a name rather than reading one off the schema.
//   - The branded Id<"intelligenceTaskDefs"> cast: Zod validates a string.
//     Where does the brand come from now? Does your bind against PauseArgs
//     accept a plain string where a branded Id is expected, and if it does,
//     is that a hole or is it the same trust boundary the comment describes?
//     Answer in a comment on the schema.
export const taskDefIdSchema = /* TODO(you) */;
```

**Verify:** both `pause` and `resume` tests pass, and their error messages name
the right tool each. Trigger both deliberately once and read the strings — this is
the one place where a shared schema could produce a message naming the wrong tool.

### Step 5.4: `listCostRollups` is not where you expect it

Look at `tools.ts:10`:

```ts
import { runCostBreakdown, validateCostRollups } from "./cost";
```

Its validator lives in `src/lib/cost.ts`, not `tools.ts`. It is one of the eight,
and it is the reason Step 5.6's grep says `src/` rather than `src/lib/tools.ts`.

```text
Read src/lib/cost.ts. Answer before migrating:

Does validateCostRollups use the shared helpers from tools.ts?   yes / no
If yes, how does it import them — they are not exported...       ____________
Does `after` have a default, or is it genuinely required?
  (types.ts:159-161 says `{ after: number; ... }` — required.)   ____________
Does the schema belong in toolSchemas.ts or in cost.ts?          ____________
  Argue it: toolSchemas.ts keeps all twelve schemas in one place,
  cost.ts keeps the validator next to the thing it validates.
```

That last question is a genuine design call and the plan file does not settle it.
Pick one, and be consistent with what you tell ETH-41's reviewer.

**Verify:** `./node_modules/.bin/vitest run src/lib/cost.test.ts` passes, and
`tools.ts:10`'s import still resolves.

### Step 5.5: `dailyUniqueUsers` and the second enum

`tools.ts:786` declares its own tuple:

```ts
const LANES = ["web", "whatsapp", "imessage", "sms"] as const;
```

Note it is already `as const`, unlike `INVOCATION_STATUSES` at `tools.ts:44`
which you may have had to narrow in ETH-45. So `z.enum(LANES)` should work
directly.

```ts
// TODO(you): three fields — days?, groupFolder?, lane?.
//   - Reuse LANES. Do not retype the four lane strings.
//   - types.ts:163-165 gives the bind target. Note the `// ->` comment spells
//     the lane union out; confirm your z.infer matches it exactly, including
//     optionality.
//   - `days` has a documented default in its description string. Same question
//     as getReplyLineage: advertised, or enforced? Check runDailyUniqueUsers
//     before you add .default().
```

**Verify:** the `dailyUniqueUsers` tests pass, and
`grep -c '"whatsapp"' src/lib/` has not increased.

### Step 5.6: Earn the deletion

All twelve migrated. Now, and only now:

```bash
grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/
```

**Read the output line by line.** You are looking for exactly four lines — the
four `function` definitions at `tools.ts:56`, `:64`, `:76`, `:88`. Anything else
is a live caller.

```text
Lines returned:                                   ____
Are all of them the definitions?                  yes / no
If no, which file did you miss, and why did you
  not expect it? (Step 5.4 is a clue.)            ____________
Baseline count from the drift check at the top:   ____
```

Only when the grep returns four definition lines do you delete. Then:

```bash
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"   # → 0
npm test                                                      # → 141 or higher
grep -c "additionalProperties" src/lib/tools.ts               # → 0
```

`additionalProperties` reaching `0` is the other half of the deletion: it means no
hand-written `parameters` literal survives anywhere in the file.

**One sweep the greps cannot do for you.** Twelve schemas now exist and the
compiler is blind to the one property that made this migration worth doing.
`z.object` and `z.strictObject` infer the same TypeScript type, so a `Bound<>`
that passes tells you nothing about whether unknown keys throw. Confirm by
reading, then by running:

```bash
grep -c "z.strictObject" src/lib/toolSchemas.ts   # → 12
grep -c "z.object("     src/lib/toolSchemas.ts   # → 0
```

Then prove the runtime half rather than trusting the grep. Every `validate*` is
exported from `tools.ts`, so you can sweep them without going through `registry`
(whose `RegisteredTool` entries expose `execute`, which needs `deps`):

```bash
npx tsx -e "
import * as T from './src/lib/tools';
for (const [name, fn] of Object.entries(T)) {
  if (!name.startsWith('validate')) continue;
  try { fn({ __hallucinated: 1 }); console.log('LEAK', name); }
  catch { /* expected */ }
}
console.log('sweep done');
"
```

Any `LEAK` line is a tool where `docs/PLAN.md:78`'s guarantee is switched off and
nothing else in the repo would have said so.

**Read the sweep's limits before you trust it.** Four of the twelve declare a
required field: `listByChatJid` and `getReplyLineage` need `chatJid`,
`getReplyLineage` also needs `replyToMsgId`, `listCostRollups` needs `after`
(`types.ts` lines 143-166 carry the `// ->` shapes). For those, the throw you see
may be the missing field rather than the unknown key, so a silent `z.object`
there still passes this sweep. Treat it as a real check for the all-optional
tools only. The per-tool `"throws on an unknown key, naming it"` tests from
ETH-45 cover the rest, so count them:

```bash
grep -c "unknown key\|unknown argument" src/lib/*.test.ts | grep -v ":0"
```

Neither check is complete on its own. Knowing which tool each one actually
covers is the point of doing both.

### Step 5.7: Quiz yourself

1. You deleted four helpers. `tools.ts` is now roughly 43 lines shorter there, but
   `toolSchemas.ts` grew. Did the codebase get smaller overall? Measure it
   (`git diff --stat` across the whole ETH-41 branch). If it grew, was the
   migration still worth it — and what is the actual metric you were optimising?
2. `assets/drift-check.ts` now compares two things that are derived from the same
   declaration. Write the one sentence you would put in a comment there (or in
   ETH-41's closing note) so the next person knows it is vacuous rather than
   reassuring.
3. Twelve binds now exist. In ETH-45 Step 4.6 Q1 you established that at least one
   of them (`Bound<{}, {}>`) asserts nothing. How many of the twelve are actually
   load-bearing? Count them, and say what protects the rest.
4. A thirteenth tool gets added next month. What in the codebase now tells the
   author to use the Zod pattern? Is it "there are twelve examples", or is there
   something stronger? If there is nothing stronger, is that acceptable — and what
   would the cheapest stronger thing be?
5. `npm run probe:backend` has printed `12 tools checked` at every phase. After
   this one, what is it still checking that the compiler does not?

<details>
<summary>Hints — open only if stuck for more than fifteen minutes</summary>

- **5.3:** one `taskDefIdSchema`, then
  `makeValidator("pause", taskDefIdSchema)` and
  `makeValidator("resume", taskDefIdSchema)`. Two validators, one schema, correct
  names in both messages.
- **5.3, the brand:** Zod gives you `string`. The branded `Id<>` comes from the
  same cast as before — the trust boundary is unchanged, and saying so in a
  comment is the deliverable. Do not try to make Zod produce a branded type; that
  would be claiming a guarantee runtime JSON cannot provide.
- **5.4:** if `cost.ts` cannot import the helpers (they are not exported), it has
  its own copies or its own approach. Either is a finding worth a sentence.
- **Q1:** the metric is not line count. It is _number of places a shape is
  declared_ — twelve tools × three copies down to twelve × one. Say that out loud
  and the growth in `toolSchemas.ts` stops mattering.
- **Q4:** the cheapest stronger thing is a lint rule or a one-line comment at the
  top of the registry saying "every entry derives from a schema in
  `./toolSchemas`". The second one costs nothing and is 80% as effective.
- **Q5:** the probe exercises the tools at runtime against a real backend. The
  compiler proves the schema matches the _declared_ Convex signature; the probe
  proves the declared signature matches the _deployed_ function. Those are
  different claims.

</details>

### Step 5.8: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
npm test                                                       # → 141 or higher
npm run lint                                                   # → 0 errors, ≤21 warnings
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"     # → 0
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^convex/"  # → 6
npm run probe:backend                                          # → 12 tools checked
grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/   # → NOTHING
grep -c "additionalProperties" src/lib/tools.ts                # → 0
git status --porcelain                                         # → only files in scope
```

Then the end-to-end pass, which is the only check in the whole migration that
exercises a real model against a real backend:

```bash
npm run dev          # terminal 1
npm run test:e2e     # terminal 2
```

**Only now** open `zod-migration-tutorial.md` Phase 5's `### ✅ Solution` and the
"Full reference implementation" section.

### ✅ Phase 5 complete — and ETH-41 with it

- All twelve registry entries call `toParameters(...)` and a factory-built validator.
- The four helpers are gone, deleted on grep evidence.
- Breaking any one schema fails the typecheck. (Pick three at random and prove it.)
- `grep -c "z.object(" src/lib/toolSchemas.ts` returns `0`, and the Step 5.6 sweep prints no `LEAK`.
- `assets/drift-check.ts` is noted as vacuous rather than silently left in place.

---

## Test plan

1. `npm test` → `Tests 141 passed (141)` or higher.
2. `npm run lint` → `0 errors`, no more than 21 warnings.
3. `tsc -b` → `0` in `src/`, `6` in `convex/`.
4. `npm run probe:backend` → `12 tools checked`.
5. `npm run dev` + `npm run test:e2e` → all Playwright specs pass.
6. `git status --porcelain` lists only files in scope.
7. `grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/`
   → nothing.
8. **Deliberate-break sampling**: pick three of the twelve binds at random, rename
   a field in each, confirm `tsc` fails, restore. Three, not one — the point of
   twelve binds is that all twelve work.

---

## Done criteria

- `grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/`
  returns nothing.
- All twelve registry entries call `toParameters(...)` and a factory-built validator.
- `grep -c "additionalProperties" src/lib/tools.ts` → `0`.
- Breaking any one schema fails the typecheck (verified on three).
- No existing test assertion edited.
- `assets/drift-check.ts`'s new redundancy is written down somewhere a human will
  read it.
- Nine commits on the branch for this phase, not one.

---

## STOP conditions

- ETH-45 not landed.
- The Step 5.6 grep returns a caller you did not expect. **Do not delete.** Find
  out what it is first — that is the grep doing its job.
- An existing assertion in `tools.test.ts` needs editing. Report.
- `npm run test:e2e` fails and you cannot tie it to your change. The e2e suite is
  the only real-model check in the migration; a failure there is worth stopping
  for even if every unit test is green.
- You are tempted to do the last three tools in one commit because it is late.
  That is precisely when the bisect map earns its keep.
- The `convex/` error count moves off `6`.

---

## What You Should Know Now

1. Half a migration is worse than none: it leaves two patterns and no signal about
   which is current.
2. Delete on evidence, not on belief. The grep costs four seconds and it is the
   entire difference.
3. A shared schema plus a name parameter beats two schemas that must stay
   identical — the factory's first argument exists for exactly this.
4. Line count is the wrong metric for a consolidation. Count declarations of the
   same shape.
5. A check whose reason has evaporated is worse than no check, because it still
   reads as reassurance. Say so out loud when you notice one.
6. The compiler proves your schema matches the _declared_ backend signature. Only
   the probe and the e2e run prove anything about the _deployed_ one.

---

## Reference

### Troubleshooting

**Problem:** After deleting the helpers, `tsc` reports errors in `src/lib/cost.ts`.
**Solution:** Step 5.4. That file was a caller and you missed it in the grep — restore, migrate it, re-run the grep.

**Problem:** `pause` throws a message naming `resume`.
**Solution:** You passed the wrong tool name to one of the two `makeValidator` calls. Both share a schema; they must not share a name.

**Problem:** `probe:backend` reports drift on a tool you just migrated.
**Solution:** Real finding. The advertised properties and the accepted keys disagree — compare the schema against the literal you deleted (`git show HEAD~1:src/lib/tools.ts`).

**Problem:** `additionalProperties` count is not `0` but you migrated everything.
**Solution:** A `parameters` literal survived somewhere — likely a tool whose entry you edited but whose literal you left above it. `grep -n "additionalProperties" src/lib/tools.ts` names the line.

**Problem:** e2e fails after the migration but unit tests pass.
**Solution:** Something about the emitted JSON Schema changed what the model sends. Diff `toParameters(schema)` output against the git-history literal for the tool the failing spec exercises.

### Key takeaways

1. One commit per tool. The suite takes 1.55 seconds; bisecting does not.
2. Grep before you delete, and read the output rather than the exit code.
3. Two tools that must accept identical arguments get one schema, always.
4. Finish the migration or do not start it.

**End of Tutorial — and end of the ETH-41 Zod migration.**
