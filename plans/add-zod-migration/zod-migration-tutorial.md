---
linear: ETH-41
linear_url: https://linear.app/mite404-workspace/issue/ETH-41/migrate-tool-argument-validation-to-zod
github: 20
filed: 2026-08-24
---

# Start here (parent ticket)

## Migrate tool argument validation to Zod

_For the executor: work this top to bottom. Run the drift check before anything
else. If it prints changes to `src/lib/tools.ts`, stop and re-read the Current
state section against the file as it exists now._

**Drift check, run this first:**

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
git diff --stat 12b44d2..HEAD -- src/lib/tools.ts src/lib/types.ts src/lib/tools.test.ts
```

Expected: no output. Any output means this document was planned against a
different `tools.ts` than the one on disk.

**Goal:** Replace ten hand-written `validate*` functions and twelve hand-written
JSON Schema blocks with one Zod schema per tool, bound at compile time to the
Convex-derived argument types, without changing what the language model reads
when it gets a call wrong.

**Learning style:** Visual analogy first, then the jargon. Every code block is
labelled Data, Calculation, Action, or Orchestration. Stubs leave the thinking
to you.

**Prerequisites:** You can read a TypeScript generic. You have run `vitest`
before. You do not need to have used Zod.

---

## Status

- **Initial priority:** P2. Nothing is broken. This removes a class of future breakage.
- **Effort:** L
- **Risk:** MED. `src/lib/tools.ts` is imported by the loop, the dispatcher, and every tool. The 141-test suite is the net.
- **Depends on:** nothing
- **Category:** refactor, contract consolidation
- **Planned at:** `12b44d2` (2026-07-06), planned on 2026-08-24
- **Covers:** 12 registered tools, 10 `validate*` exports, 1 helper family (`asArgsRecord` / `assertKnownKeys` / `optionalNumber` / `optionalString`)

---

## Why this matters

Every tool in this repo declares its argument shape three times.

Take `getAggregateStats`. The shape `{ after?: number, groupFolder?: string }`
appears at:

1. `src/lib/tools.ts:148-163`, as a JSON Schema object the language model reads
2. `src/lib/tools.ts:104`, as the string array `["after", "groupFolder"]` passed to `assertKnownKeys`
3. `src/lib/types.ts:122`, as `AggregateStatsArgs`

Copy 3 is derived. `FunctionArgs<typeof api.invocations.getAggregateStats>`
reads the real Convex function signature, so it updates itself when the backend
changes. Copies 1 and 2 are typed by hand and update when someone remembers.

Nothing connects them. Add a `lane` parameter to the Convex function and copy 3
changes on its own, while copies 1 and 2 keep advertising and accepting the old
shape. The compiler says nothing, because two string arrays and a JSON object
literal are all valid on their own terms.

A probe run on 2026-08-22 walked all 12 tools and found `0 drift(s)`. The copies
currently agree. They agree because someone was careful, which works until tool
thirteen.

One Zod schema per tool collapses copies 1 and 2 into a single declaration and
lets a compile-time assertion tie it to copy 3. Three hand-maintained artefacts
become one declaration and one line that fails the build.

---

## Current state

The validator for the simplest tool in the registry, `src/lib/tools.ts:102-116`:

```ts
export function validateAggregateStats(raw: unknown): AggregateStatsArgs {
  const record = asArgsRecord(raw, "getAggregateStats");
  assertKnownKeys(record, ["after", "groupFolder"], "getAggregateStats");
  const args: AggregateStatsArgs = {};
  const after = optionalNumber(record.after, "after", "getAggregateStats");
  if (after !== undefined) args.after = after;
  const groupFolder = optionalString(
    record.groupFolder,
    "groupFolder",
    "getAggregateStats",
  );
  if (groupFolder !== undefined) args.groupFolder = groupFolder;
  return args;
}
```

Fifteen lines to check two optional fields. The same fifteen-line shape repeats,
with different field names, nine more times.

The block the model reads, `src/lib/tools.ts:148-163`:

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

And the exemplar to imitate, `src/lib/types.ts:122-124`:

```ts
export type AggregateStatsArgs = FunctionArgs<
  typeof api.invocations.getAggregateStats
>; // -> { after?: number; groupFolder?: string }
```

This is the pattern the whole migration is trying to extend: a type that reads
its shape from the thing it has to agree with, rather than restating it.

**Do NOT edit anything under `convex/`.** That directory is the slice supplied
with the original brief. `tsc -b` already reports 6 pre-existing errors in it,
and they are not yours to fix. Your typecheck gate is "zero errors in `src/`",
not "zero errors".

---

## Commands You'll Need

| Purpose                                               | Command                                                          | Expected on success                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Preflight: Zod is installed                           | `node -e "console.log(require('zod/package.json').version)"`     | `4.4.3` or higher                                     |
| Preflight: Node runs ESM                              | `node --version`                                                 | `v20` or higher                                       |
| Typecheck, ignoring the given backend slice           | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^src/"`    | `0`                                                   |
| Count the pre-existing backend errors (must not grow) | `./node_modules/.bin/tsc -b --noEmit 2>&1 \| grep -c "^convex/"` | `6`                                                   |
| Unit tests                                            | `npm test`                                                       | `Test Files 24 passed (24)`, `Tests 141 passed (141)` |
| One test file while iterating                         | `./node_modules/.bin/vitest run src/lib/tools.test.ts`           | `Tests 44 passed` or higher                           |
| Lint                                                  | `npm run lint`                                                   | `0 errors`, 21 warnings                               |
| Run the app                                           | `npm run dev`                                                    | Vite serves on `localhost:5173`                       |
| End-to-end, after the app runs                        | `npm run test:e2e`                                               | all Playwright specs pass                             |
| Prove a tool still advertises correctly               | `npm run probe:backend`                                          | `12 tools checked`                                    |

---

## Concepts You'll Need

- **`z.strictObject` versus `z.object`.** `z.object()` deletes unknown keys and
  returns success. The whole point of `assertKnownKeys` is that an unknown key
  must throw, because it is how the model finds out it hallucinated a parameter.
  Getting this wrong silently disables the feature the brief grades. Nothing at
  the type level can catch that mistake, because the two constructors infer the
  same TypeScript type. The bind you build in Phase 1 is blind to it, and a
  runtime unknown-key test is the only thing that enforces it. Taught in Phase 1.
- **`z.toJSONSchema`.** Zod 4 can print a schema as the JSON Schema object
  OpenRouter's `tools` parameter expects, which is what makes copy 1 derivable
  rather than hand-written. Its `io` option decides whether it describes the
  parser's input or its output, and `parameters` needs the input. Taught in
  Phase 2.
- **A compile-time equality assertion.** A type-level check that fails the build
  when the Zod schema and the Convex-derived args disagree. This is the piece
  that turns "someone was careful" into "the compiler refuses". Taught in Phase 1.
- **Why `extends` is nearly useless on all-optional objects.** The obvious way to
  write that assertion silently passes. You need to know why before you write it.
  Taught in Phase 1, by negative space.
- **Error messages as an interface.** `src/lib/loop.ts:123` reads `error.message`
  and feeds it to the model. The message is not a log line, it is an input to
  another system. Taught in Phase 3.

---

## Files You'll Touch

Build order is leaf to trunk: schemas before the validators that use them, before
the registry that holds them, before the tests that pin them.

| Path                     | Role                 | What it holds                                                                                                          | You                   |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `package.json`           | Main                 | Zod is present only via the `eslint-plugin-react-hooks` devDependency; this promotes it to a direct runtime dependency | **Build**             |
| `src/lib/types.ts`       | Data                 | `RegisteredTool`, and the `FunctionArgs<>` arg types the schemas bind to                                               | **Build**             |
| `src/lib/toolSchemas.ts` | Data                 | New file. One Zod schema per tool, plus the compile-time binds                                                         | **Build**             |
| `src/lib/tools.ts`       | Calculation + Action | The `validate*` functions, the `parameters` blocks, the registry                                                       | **Build**             |
| `src/lib/tools.test.ts`  | Calculation          | 279 lines already asserting the behaviour you must preserve                                                            | **Read**, then extend |
| `src/lib/loop.ts`        | Orchestration        | Reads `error.message` at line 123 and feeds it to the model                                                            | **Read only**         |
| `convex/`                | given                | The brief's backend slice, 6 pre-existing type errors                                                                  | **Do not touch**      |

---

## Scope

**In scope:**

- `src/lib/toolSchemas.ts` (new)
- `src/lib/tools.ts`
- `src/lib/types.ts`
- `src/lib/tools.test.ts`
- `package.json`

**Out of scope:**

- **`convex/`.** It is the supplied brief slice and its 6 type errors predate you. Fixing them is a separate ticket and would confuse the typecheck gate here.
- **`src/lib/loop.ts`.** The error-routing policy is correct and this migration must not change it. If you find yourself editing `loop.ts`, your message shape is wrong. Fix Phase 3 instead.
- **The `ToolResult` union and the App.tsx switch.** Return types are not changing. Only the argument boundary is.
- **`assets/drift-check.ts` in the teaching workspace.** It becomes redundant once the compile-time bind lands, but retiring it is a note in Maintenance, not a step here.
- **Prompt or tool-description wording.** The `description` strings move into the schema, verbatim. Improving them is a different ticket, and mixing it in makes the diff unreviewable.

---

## Git workflow

```bash
git switch -c refactor/zod-tool-schemas
# one commit per phase
git commit -m "refactor: bind getAggregateStats args to a Zod schema"
# ...
```

Do not push until the full Test plan passes. Commit per phase, so a bad phase is
one `git revert` rather than a bisect.

---

## Background Concepts (First Principles)

### The three-copy problem, in film terms

You are grading a film. Three people hold a description of the same shot: the
gaffer's lighting notes, the DP's camera log, and the colourist's LUT. Nobody
compares them. The colourist grades to a description that stopped being true two
setups ago, and nobody notices until the screening.

The fix is not "be more careful". It is to make two of the three read from the
first one.

**Data / Calculation / Action / Orchestration**, the four buckets everything in
this migration falls into:

- **Data** is footage. Inert, no behaviour. A Zod schema object is Data. So is `AggregateStatsArgs`.
- **Calculation** is the LUT. Same input, same output, every time, no side effects. `validateAggregateStats` is a Calculation: `unknown` in, typed args or a throw out.
- **Action** is the live take. Depends on the world and changes it. `runAggregateStats` is an Action, because it calls Convex over the network.
- **Orchestration** is the edit. It wires the other three together in order. `execute` on each tool and `makeRunTool` at `tools.ts:878` are Orchestration.

The preference rule: **prefer Data to Calculations, and Calculations to
Actions.** This migration is one long application of that rule. Fifteen lines of
Calculation per tool become four lines of Data plus one generic Calculation
shared by all twelve.

### What Zod actually is

Zod is a library where you build a _value_ that describes a type, and then ask
that value questions.

- **What is it?** A schema object. `z.number()` is a value you can pass around, not a type annotation.
- **When do you reach for it?** When the same shape needs to exist in more than one form: a runtime check, a static type, and a JSON description for an external system. That is exactly this repo's situation.
- **What does it return?** `.parse(input)` returns the typed value or throws a `ZodError`. `z.infer<typeof S>` returns the static type. `z.toJSONSchema(S)` returns a plain JSON Schema object.

The reason it fits here is that all three come from the same declaration. You
cannot update one and forget the others, because there is only one.

---

## Phase 1: Bind one schema to the backend

**Concepts:** `z.strictObject`, `z.infer`, a compile-time equality assertion, and
why the obvious form of that assertion does not work.

### Concept: an assertion that reads two types and refuses to build

Think of a continuity supervisor on set. They do not shoot anything. Their only
job is to hold two things side by side and say "the coffee cup was in his left
hand." They produce no footage. They stop the take.

A compile-time equality assertion is that. It generates no JavaScript. It exists
so that `tsc` refuses to build when your Zod schema and the Convex function's
real arguments have drifted apart.

**What is it?** A `const` whose _type_ is computed from two other types, and
whose value can only be assigned if those types match.

**Why here?** Because `z.infer` gives you a type from the schema, and
`FunctionArgs` gives you a type from the backend, and nothing currently makes
those two agree. This is the line that makes them agree.

**How it works.** A conditional type resolves to `true` when the two match and
`never` when they do not. `const _bound: ... = true` then fails, because nothing
is assignable to `never`.

### Step 1.1: The stub

Create `src/lib/toolSchemas.ts`.

```ts
// CATEGORY: Data - schema values and the type-level assertions that pin them.
// No runtime behaviour lives here beyond constructing schema objects.

import { z } from "zod"; // → module
import type { AggregateStatsArgs } from "./types"; // → { after?: number; groupFolder?: string }

// TODO(you): build the schema for getAggregateStats.
//
//   - Both fields are optional. Look at types.ts:122-124 for the exact shape.
//   - An unknown key must THROW, not be dropped. Zod has two object
//     constructors and only one of them does that. Which default would let a
//     hallucinated `lane` through silently?
//   - Carry the two per-field description strings over verbatim: tools.ts:153-155
//     onto `after`, tools.ts:159 onto `groupFolder`. NOT the tool-level
//     `description` at tools.ts:143-147.
//     Zod has a method for attaching human-readable text to a field; you will
//     need it in Phase 2 and it costs nothing to add now.
export const getAggregateStatsSchema = z.strictObject({}); // → ZodObject, remove when implemented

// TODO(you): write the bind.
//
// Goal: `tsc` errors if getAggregateStatsSchema stops matching AggregateStatsArgs.
//
// Start with the shape below, then read Step 1.2 before you trust it.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
```

### Step 1.2: Work through it

**Conceptual process.**

Write the naive bind first and _try to break it_. Make a second schema that
declares `lane` where the real one declares `groupFolder`, assert it against
`AggregateStatsArgs`, and typecheck.

It compiles. No error.

Sit with that for a second, because it is the most useful thing in this
document. `AggregateStatsArgs` is `{ after?: number; groupFolder?: string }` and
every field is optional. A type with an extra optional property is still
assignable to one without it, and a type missing an optional property is still
assignable to one that has it. Both directions of `extends` pass. Your
continuity supervisor was reading an empty page.

**Why this approach?** Because a check you have not tried to break is not a
check. This one _looks_ right, produces no error, and would have shipped.

Two ways out, and you should reason about which you prefer before looking at the
solution:

- Compare the _keys_ rather than the whole shape. `keyof` on an all-optional object still gives you a real union of string literals.
- Strip the optionality first, then compare shapes.

Both work. One of them also catches a type change on an existing key. Which?

**Verify:** with the deliberately drifted schema in place,
`./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` prints a number
greater than `0`. Then delete the drifted schema and it prints `0`.

### Step 1.3: Quiz yourself

1. `z.object({ after: z.number().optional() }).parse({ after: 1, lane: "x" })` returns a value rather than throwing. What is in that value, and which line of `docs/PLAN.md` does that behaviour violate?
2. Your bind uses `Exact<keyof A, keyof B>`. A teammate changes `after` from `number` to `string` in the Zod schema but leaves the name alone. Does your bind catch it? If not, what would?
3. Why does `[A] extends [B]` get wrapped in a tuple at all? What would `A extends B` do differently if `A` were a union?

### ✅ Solution

```ts
// CATEGORY: Data - schema values and the type-level assertions that pin them.

import { z } from "zod"; // → module
import type { AggregateStatsArgs } from "./types"; // → { after?: number; groupFolder?: string }

export const getAggregateStatsSchema = z.strictObject({
  // → ZodObject
  after: z
    .number()
    .describe(
      "Optional unix-ms lower bound on a run's creation time. Omit for " +
        "all-time, which is the usual case.",
    )
    .optional(), // → ZodOptional<ZodNumber>
  groupFolder: z
    .string()
    .describe("Optional group folder to scope to. Omit for all groups.")
    .optional(), // → ZodOptional<ZodString>
});

// The bind. Fails the build when the schema and the backend args disagree.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

type Bound<S, Args> = Exact<Required<S>, Required<Args>>; // → true | never

const _aggregateStatsBound: Bound<
  z.infer<typeof getAggregateStatsSchema>,
  AggregateStatsArgs
> = true; // → true
```

`Required<>` is the version that catches both failures. Renaming `groupFolder`
to `lane` changes the key set, and changing `number` to `string` changes the
property type. `keyof` alone catches only the first.

**What it still cannot catch, and never will.** Swap `z.strictObject` for
`z.object` above and the bind stays green, because `z.infer` produces the same
type for both. Strictness is a property of the parser, not of the type it
describes. That leaves the guarantee at `docs/PLAN.md:78` resting on one thing,
a runtime test that feeds in an unknown key and asserts a throw. Phase 4 writes
one per tool and Phase 5 sweeps for stragglers. Until then, `tsc` passing is not
evidence about this.

**Why split it this way?** `Bound<>` is its own named type rather than an inline
expression because it is about to be repeated twelve times. Naming it means the
error message says `Bound`, and it means a future improvement to the check lands
in one place. It stays in the Data bucket: it is a description, not a
computation over runtime values.

### Step 1.4: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"
```

**Expected output:** `0`

**If it fails:** read the error. `Type 'true' is not assignable to type 'never'`
on the `_aggregateStatsBound` line means the schema really does disagree with
the backend. Print the inferred type by hovering `z.infer<typeof
getAggregateStatsSchema>` in your editor and compare it to the comment at
`types.ts:124`.

### ✅ Phase 1 complete

**You've learned:** how to make a schema and a backend-derived type fail the
build when they disagree, and why the obvious form of that check silently
passes on all-optional shapes.

**Next:** the schema now describes the shape twice over, but the model still
reads a hand-written JSON block. Phase 2 deletes it.

---

## Phase 2: Generate what the model reads

**Concepts:** `z.toJSONSchema`, and the difference between a type that describes
your code and a document that describes your API to something else.

### Concept: the schema as a publishable document

A shooting script exists so the crew agree with each other. A press kit exists so
people outside the production know what the film is. They describe the same film
and they are not the same document, but only one of them should be written twice.

`z.toJSONSchema` prints the press kit from the shooting script.

**What is it?** A function that turns a Zod schema value into a plain JSON
Schema object.

**Why here?** `RegisteredTool.parameters` at `types.ts:175` is typed
`Record<string, unknown>` and is sent to OpenRouter in `toOpenRouterTools` at
`tools.ts:864-874`. It is the model's only description of what a tool accepts.
Right now it is typed by hand, which is copy 1 of three.

**How it works.** Zod walks the schema and emits `type`, `properties`,
`required`, `additionalProperties`, and any `.describe()` text.

### Step 2.1: The stub

In `src/lib/toolSchemas.ts`:

```ts
// CATEGORY: Calculation - schema in, JSON Schema document out. Pure.

// TODO(you): write the function the registry will call instead of a literal.
//
//   - Input: a Zod schema. Output: the object that goes in `parameters`.
//   - Zod's emitter adds a `$schema` key. OpenRouter does not want it, and
//     leaving it in makes your diff against the old hand-written block noisy.
//     What is the cheapest way to drop one key from an object without mutating
//     the input?
//   - `RegisteredTool.parameters` is typed `Record<string, unknown>`. Match it.
export function toParameters(/* TODO(you) */): Record<string, unknown> {
  return {}; // remove when implemented
}
```

Then in `src/lib/tools.ts`:

```ts
export const getAggregateStatsTool: RegisteredTool = {
  name: "getAggregateStats",
  description: "...",                                     // → string, unchanged
  // TODO(you): replace the 16-line literal at tools.ts:148-163 with a call.
  parameters: { type: "object", properties: {} },         // remove when implemented
  execute: (rawArgs, deps) => /* unchanged for now */,
};
```

### Step 2.2: Work through it

**Conceptual process.**

Before you delete the hand-written block, prove the generated one matches it.
This is a refactor, and a refactor you cannot diff is a rewrite.

Print both and compare:

```bash
node --input-type=module -e "
import { z } from 'zod';
const S = z.strictObject({
  after: z.number().describe('Optional unix-ms lower bound...').optional(),
});
console.log(JSON.stringify(z.toJSONSchema(S, { io: 'input' }), null, 2));
"
```

You are looking for three things: `type: \"object\"`, the descriptions carried
through onto each property, and `additionalProperties: false`. That last one is
the JSON-Schema half of `strictObject`, and it is what tells the model not to
invent parameters in the first place. Phase 1 made a bad call _throw_. This makes
the model less likely to make it.

**About that `io: 'input'`.** It is not the default, and for this schema it
changes nothing. That is why it is worth explaining now rather than debugging in
Phase 4. Zod emits a different document depending on which side of the parser you
ask about, and the two diverge as soon as a schema does any work between its
input and its output. Verified on Zod 4.4.3:

```
z.strictObject({ after: z.number().default(0) })
  output → { properties: { after: {...} }, required: ["after"], ... }
  input  → { properties: { after: {...} }, ... }
```

`parameters` is the model's instruction sheet for what to **send**, so it wants
the input side. Output mode would tell the model that `after` is mandatory, when
the entire reason the default exists is that it is optional. Phase 4 adds that
default to `getAggregateTokenUsage`.

A second effect, which does not change the code. In `output` mode `z.object` and
`z.strictObject` emit identical JSON, both carrying `additionalProperties: false`.
Only `input` mode distinguishes them. So the emitted document is evidence of your
Phase 1 constructor choice only in the mode you just picked for unrelated reasons.

**Why this approach?** The alternative is to keep the literal and add a test that
compares it to the generated version. That is more code and it can only tell you
about drift after someone writes the test. Deleting the literal makes drift
impossible rather than detectable.

**Why split it this way?** `toParameters` is a Calculation and it lives in
`toolSchemas.ts` next to the Data it operates on, not in `tools.ts`. The rule of
thumb: a pure function belongs beside the shapes it transforms, and `tools.ts` is
already the Action and Orchestration file. If you find yourself importing
`ConvexHttpClient` into `toolSchemas.ts`, you have put something in the wrong
file.

**Verify:** `./node_modules/.bin/vitest run src/lib/tools.test.ts` still passes,
and `npm run probe:backend` still prints `12 tools checked`.

### Step 2.3: Quiz yourself

1. `toParameters` strips `$schema`. What happens if you leave it in and send it to OpenRouter, and how would you find out cheaply without spending tokens?
2. `RegisteredTool.parameters` is `Record<string, unknown>`. Why not type it as the Zod schema itself and call `toJSONSchema` inside `toOpenRouterTools`?
3. Phase 1's `strictObject` makes a bad key throw. Phase 2's `additionalProperties: false` makes it less likely. Why keep both?

### ✅ Solution

```ts
// CATEGORY: Calculation - schema in, JSON Schema document out. Pure.

export function toParameters(schema: z.ZodType): Record<string, unknown> {
  // `io: "input"` is deliberate and not the default. `parameters` describes what
  // the model SENDS, which is the parser's input side. Default "output" mode
  // emits a `.default(0)` field as `required`, which would tell the model that
  // getAggregateTokenUsage's `after` is mandatory once Phase 4 adds it.
  const { $schema: _discard, ...rest } = z.toJSONSchema(schema, {
    io: "input",
  }) as Record<string, unknown>; // → Record<string, unknown>
  return rest; // → { type, properties, additionalProperties }
}
```

And the registry entry loses sixteen lines:

```ts
export const getAggregateStatsTool: RegisteredTool = {
  // → RegisteredTool
  name: "getAggregateStats",
  description: "Overall health of agent runs, all-time: ...",
  parameters: toParameters(getAggregateStatsSchema), // → Record<string, unknown>
  execute: (rawArgs, deps) =>
    runAggregateStats(validateAggregateStats(rawArgs), deps).then((data) => ({
      tool: "getAggregateStats",
      data,
    })),
};
```

On question 3, the answer worth keeping: `additionalProperties: false` is advice
to a system that is free to ignore it, and models do ignore it. `strictObject` is
enforcement at your boundary. Advice plus enforcement is the whole trust-boundary
pattern, and neither replaces the other.

### Step 2.4: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
npm run probe:backend
```

**Expected output:** `12 tools checked`

**If it fails:** the probe sends each advertised property to the tool. A failure
here means `toParameters` emitted a property name the validator rejects, which
means your schema and your `assertKnownKeys` list disagree. That is the exact
drift this migration exists to make impossible, so you have just caught a real
one.

### ✅ Phase 2 complete

**You've learned:** how to derive an external API description from an internal
schema, and why enforcement at your boundary is not replaced by advice in a
document.

**Next:** copy 2 is still there. `validateAggregateStats` is fifteen lines of
hand-written checking that Zod can now do in one call. Phase 3 replaces it, and
the hard part is not the parsing.

---

## Phase 3: Keep the message the model needs

**Concepts:** error messages as an interface, and one generic Calculation
replacing ten specific ones.

### Concept: the error message is not for you

A slate at the head of a take is not decoration. It is machine-readable input for
the edit: scene, take, roll. Write it badly and the assistant editor cannot sync
the audio.

`src/lib/loop.ts:120-125` does this:

```ts
    } catch (error) {
      // Tool-layer error: feed the reason back so the model can self-correct
      // next step, and continue - do not abort the turn.
      const message = error instanceof Error ? error.message : String(error);
      hooks.onToolStatus({ phase: "error", tool: toolCall.name, message });
      wire.push(toolErrorMessage(toolCall.id, message));
    }
```

`error.message` goes on the wire to the model. It is an input to another system,
which means changing its shape is an API change, not a cosmetic one.

**What is it?** The contract that a thrown validation error names the tool and
the offending field, in one line.

**Why here?** A raw `ZodError.message` is a JSON array. It names the key. It
never names the tool. With twelve tools in the registry, a model reading
`Unrecognized key: "days"` does not know which of its twelve calls was wrong.

**How it works.** Catch the `ZodError`, extract what matters, rethrow with the
tool name in front.

### Step 3.1: The stub

```ts
// CATEGORY: Calculation - unknown in, typed args or throw out. One function,
// all twelve tools. Replaces ten hand-written validators.

// TODO(you): write the generic validator factory.
//
//   - It takes the tool name and a schema, and returns a function shaped like
//     the existing validators: (raw: unknown) => Args.
//   - On success, return the parsed value. Zod's return type is already
//     correct; do not annotate over it.
//   - On failure, throw an Error whose message begins with the tool name.
//     Look at what tools.test.ts asserts before you decide what goes after it:
//     the tests use regexes, not equality, so find out what they actually
//     require.
//   - Zod gives you a structured list of problems rather than one string.
//     Which property holds it, and what is on each entry that would help a
//     model fix its call?
export function makeValidator<S extends z.ZodType>(
  toolName: string, // → string
  schema: S, // → ZodType
): (raw: unknown) => z.infer<S> {
  // → (unknown) => Args
  return (raw) => schema.parse(raw); // remove when implemented
}
```

### Step 3.2: Work through it

**Conceptual process.**

Read `src/lib/tools.test.ts` first. All ten unknown-key tests are shaped like
this:

```ts
it("throws on an unknown key, naming it so the LLM can self-correct", () => {
  expect(() => validateAggregateStats({ days: 7 })).toThrow(/days/);
});
```

`toThrow(/days/)` is a regex against the message. It does not care about
formatting. That means the existing suite is already a migration harness: it
pins the _property_ you must preserve (the offending field appears in the
message) without pinning the prose.

I checked this against Zod 4.4.3 before writing this document. All five
representative assertions in the suite pass against raw `ZodError.message`:
`/days/`, `/failed/` for the enum case, `/chatJid/` for both the missing and
whitespace cases, and the non-object case. So a bare `schema.parse(raw)` would
turn the suite green.

**Which is exactly why you should not stop there.** A green suite means you have
not broken what was tested. It does not mean you have kept what mattered. The
tool name is not in any assertion, and it is in every current message, and the
model needs it. This is the gap between passing tests and preserving behaviour,
and it is the single most useful habit in this document.

**Why this approach?** Ten Calculations become one Calculation plus ten Data
declarations. Reread the preference rule: prefer Data to Calculations. A schema
is inert and diffable. A hand-written validator is code that can be wrong in
ways a schema cannot.

**Why split it this way?** `makeValidator` is a factory rather than a function
taking three arguments at each call site because the call site is a registry
entry, and a registry entry should hold a value, not a partial application
spelled out twelve times. The bucket did not change: it is still a Calculation,
now parameterised.

**Verify:** `./node_modules/.bin/vitest run src/lib/tools.test.ts` passes, and
your new test asserting the tool name appears in the message also passes.

### Step 3.3: Quiz yourself

1. The suite would go green with a one-line `schema.parse(raw)`. Name the behaviour that would be lost, and the test that should have caught it but does not exist.
2. `makeValidator` returns `(raw: unknown) => z.infer<S>`. Why is `z.infer<S>` better here than annotating each call site with `AggregateStatsArgs`?
3. A `ZodError` for `{ after: "soon", groupFolder: 5 }` contains two issues. Should the thrown message carry both or just the first? Argue it from what the model does next, not from what reads nicer.

### ✅ Solution

```ts
// CATEGORY: Calculation - unknown in, typed args or throw out.

export function makeValidator<S extends z.ZodType>(
  toolName: string, // → string
  schema: S, // → ZodType
): (raw: unknown) => z.infer<S> {
  return (raw) => {
    const result = schema.safeParse(raw); // → SafeParseReturnType
    if (result.success) return result.data; // → z.infer<S>

    const detail = result.error.issues // → ZodIssue[]
      .map((issue) =>
        issue.path.length
          ? `\`${issue.path.join(".")}\` ${issue.message}` // → string
          : issue.message,
      )
      .join("; "); // → string
    throw new Error(`${toolName}: ${detail}`);
  };
}
```

`safeParse` rather than `parse` and a try/catch, because the failure is expected
here. It is the graded path, not an exception. Using the return value instead of
control flow keeps the function a Calculation with one exit that throws, rather
than a Calculation wrapped in error handling.

On question 3: carry all of them. The model gets one message and takes one more
step. Reporting one problem at a time turns a single correction into three round
trips, and `loop.ts:129-135` caps the loop at five steps.

Then in `tools.ts`:

```ts
export const validateAggregateStats = makeValidator(
  // → (unknown) => AggregateStatsArgs
  "getAggregateStats",
  getAggregateStatsSchema,
);
```

Fifteen lines to three, and the export name is unchanged, so `tools.test.ts` and
every registry entry keep working.

### Step 3.4: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
./node_modules/.bin/vitest run src/lib/tools.test.ts
```

**Expected output:** all tests pass, count unchanged or higher.

**If it fails:** a `/pattern/` assertion that no longer matches tells you which
property of the old message you dropped. That is the suite doing its job. Read
the pattern, not the message.

### ✅ Phase 3 complete

**You've learned:** that a green test suite proves you broke nothing tested, not
that you preserved everything that mattered, and how to tell the difference by
reading the assertions rather than the results.

**Next:** `getAggregateStats` was the easy one. Four tools have shapes Zod
expresses differently, and one of them cannot bind to `FunctionArgs` at all.

---

## Phase 4: The four shapes that are not two optional fields

**Concepts:** `z.enum`, `.trim().min(1)`, `.default()`, the empty strict object,
and an argument that exists only in your app.

### Concept: when the derived type is not the right target

Not every prop on set comes from the art department. Sometimes the director adds
one on the day. Your continuity notes still have to include it, and looking it up
in the art department's list will not find it.

`src/lib/types.ts:138-141`:

```ts
type ListRecentToolArgs = ListRecentArgs & { status?: InvocationStatus };
```

`status` is not a Convex argument. `runListRecent` at `tools.ts:249-257` strips
it and filters the result in your own code. So the bind for this tool must target
the intersection, not `FunctionArgs` directly. Bind it to `ListRecentArgs` and
the compiler will reject your schema for declaring a field the backend does not
have, and it will be right.

### Step 4.1: The stub

```ts
// CATEGORY: Data - the four schema shapes the simple case did not cover.

// TODO(you): listRecent. Three optional fields, one of which is a closed set.
//   - INVOCATION_STATUSES already exists in this repo. Find it, and prefer
//     deriving the schema's allowed values from it over retyping four strings.
//     Retyping them would recreate the exact problem this migration removes.
//   - Which type does the bind target? Not the one the other tools use.
export const listRecentSchema = z.strictObject({}); // remove when implemented

// TODO(you): listByChatJid. A required string that must not be blank.
//   - tools.test.ts:143-146 requires that "" and "   " both throw. A plain
//     required string rejects only one of those. What has to happen to the
//     value before the length is checked, and does Zod give you that as a
//     method on the string schema or as a separate step?
export const listByChatJidSchema = z.strictObject({}); // remove when implemented

// TODO(you): getAggregateTokenUsage. tools.test.ts:62-66 says `after` DEFAULTS
// to 0 when the model omits it.
//   - A defaulted field changes what `.parse()` returns versus what it accepts.
//     Your bind compares the OUTPUT type. Check whether `after` should be
//     optional in the bound type or required, and let the compiler tell you.
export const tokenUsageSchema = z.strictObject({}); // remove when implemented

// TODO(you): listConversations. Takes no arguments at all, and
// tools.test.ts:120-123 requires that ANY argument throws.
//   - This is one line. Make sure it is the line that throws rather than the
//     one that returns {}.
export const listConversationsSchema = z.strictObject({}); // remove when implemented
```

### Step 4.2: Work through it

**Conceptual process.**

Do `listConversations` first. It is one line and it will tell you immediately
whether you understood Phase 1, because `z.object({})` and `z.strictObject({})`
behave completely differently on `{ anything: 1 }` and only one of them satisfies
the test at `tools.test.ts:120`.

Then `getAggregateTokenUsage`, because the default is the subtle one. `z.number().default(0)`
produces a schema whose _input_ allows the field to be missing and whose _output_
guarantees a `number`. `z.infer` gives you the output type. If your bind fails
here, read the error before changing anything: it is telling you a true thing
about what the parsed value is.

Then `listByChatJid`. The whitespace test is the interesting one. Order matters,
and getting it backwards passes the empty-string test while failing the
whitespace test, and the failure gives you no hint that ordering is the cause.

Then `listRecent`, which is the one with the type wrinkle above.

**Why this approach?** Ordered by what each one teaches, not by their order in
the file. You want the fast feedback first.

**When not to extract:** you will notice all four schemas share `strictObject`
and nothing else. Do not write a `makeToolSchema` helper. Four call sites with
different fields are not duplication, they are four different things that happen
to start with the same word, and a wrapper here would hide the field list, which
is the only part anyone reads.

**Verify:** `./node_modules/.bin/vitest run src/lib/tools.test.ts` passes all
existing assertions, including the whitespace pair at lines 143-146.

### Step 4.3: Quiz yourself

1. `z.string().min(1).trim()` and `z.string().trim().min(1)` differ on the input `"   "`. Which one throws, and why does the other not?
2. Why must `listRecentSchema` bind to `ListRecentToolArgs` rather than `ListRecentArgs`, and what would the compiler say if you got it backwards?
3. `z.number().default(0)` makes `after` required in the output type. `tools.test.ts:62` asserts the default applies. Does your `Bound<>` assertion pass against `AggregateTokenUsageArgs`, and if not, is that the bind being wrong or the backend type being different from what the tool actually returns?

### ✅ Solution

```ts
// CATEGORY: Data - one declaration per tool, each bound to its args type.

import { INVOCATION_STATUSES } from "./types"; // → readonly InvocationStatus[]

export const listRecentSchema = z.strictObject({
  limit: z.number().describe("Max rows to return.").optional(),
  after: z.number().describe("Unix-ms lower bound.").optional(),
  status: z
    .enum(INVOCATION_STATUSES) // → ZodEnum<InvocationStatus>
    .describe("Filter to one run status.")
    .optional(),
});
const _listRecentBound: Bound<
  z.infer<typeof listRecentSchema>,
  ListRecentToolArgs // the intersection, not FunctionArgs
> = true;

export const listByChatJidSchema = z.strictObject({
  chatJid: z.string().trim().min(1).describe("Conversation jid."), // → string
  limit: z.number().optional(),
});

export const tokenUsageSchema = z.strictObject({
  after: z.number().default(0).describe("Unix-ms lower bound; 0 is all-time."),
});

export const listConversationsSchema = z.strictObject({}); // any key throws
```

`.trim()` before `.min(1)`, because Zod applies them left to right. Trim first
and `"   "` becomes `""`, which fails the length check. Check the length first
and `"   "` has length 3, which passes, and the whitespace test at
`tools.test.ts:145` fails. This is the negative-space lesson of the phase: the
tempting order is the wrong one, and the test that catches it already exists.

`z.enum(INVOCATION_STATUSES)` rather than `z.enum(["pending", "running",
"succeeded", "failed"])`. Retyping the four strings would create a fourth copy of
a shape that already exists, in a document whose entire purpose is removing
copies.

**Why split it this way?** Each bind sits directly beneath its schema rather than
in a block at the bottom. When one fails, the thing it is talking about is on the
adjacent line. A block of twelve binds at the end would be tidier and worse.

### Step 4.4: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
./node_modules/.bin/vitest run src/lib/tools.test.ts
```

**Expected output:** all existing assertions pass, including `tools.test.ts:143-146`.

**If it fails on the whitespace case:** you have `.min(1).trim()`. Swap them.

### ✅ Phase 4 complete

**You've learned:** four Zod shapes, that method order is semantic rather than
stylistic, and that an app-level argument needs an app-level bind target.

**Next:** eight tools left, all variations on what you have already done, and
then the helpers that nothing calls any more.

---

## Phase 5: Finish the registry and delete the old machinery

**Concepts:** finishing a migration, and recognising when a safety net has become
dead weight.

### Concept: the check that outlives its reason

A stunt rig stays up until the shot is in the can. Leaving it up afterwards is
not extra safety, it is a thing in the frame.

`assets/drift-check.ts` in the teaching workspace walks all twelve tools at
runtime and compares each advertised property against its validator. It exists
because nothing checked those two copies against each other. After this
migration there is one copy, and `tsc` checks it against the backend. The probe
is now checking that a value equals itself.

### Step 5.1: The stub

```ts
// CATEGORY: Data - the eight remaining schemas.

// TODO(you): the remaining eight, in this order. Each is a variation on
// something you have already written.
//
//   listAll, pause, resume       - validateTaskDefId is SHARED by pause and
//                                  resume (tools.ts:454). Decide whether that
//                                  is one schema used twice or two schemas.
//                                  Look at what each tool advertises before
//                                  you decide.
//   enqueue                      - the largest arg shape; tools.ts:545
//   getReplyLineage              - tools.ts:644
//   listCostRollups              - note `after` is REQUIRED here; types.ts:160
//   dailyUniqueUsers             - has a lane enum; types.ts:164
//
// For each: schema, bind, then swap the registry entry's `parameters` and
// `validate*` in one commit. Run the tools test file after each one.
```

Then the deletions:

```ts
// TODO(you): once nothing imports them, delete from tools.ts:
//   asArgsRecord, assertKnownKeys, optionalNumber, optionalString
// Prove nothing imports them BEFORE deleting, not after.
```

### Step 5.2: Work through it

**Conceptual process.**

One tool per commit. The suite runs in 1.55 seconds, so there is no reason to
batch. A failing commit that touched one tool tells you where the problem is
without any thinking at all.

The `pause` / `resume` decision is the only real judgement call. `validateTaskDefId`
at `tools.ts:454` is shared, which means both tools currently accept exactly the
same arguments. Two schemas would let them drift apart, which nobody wants. One
schema referenced twice keeps them identical. But `makeValidator` takes the tool
name for the error message, so you need one schema and two validators built from
it, which is precisely what a factory is for.

Before deleting the helpers, prove they are unused:

```bash
grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/
```

Expect only the definitions themselves. Anything else is a call site you missed.

**Why this approach?** Deleting on evidence rather than on belief. `grep` costs
nothing and the alternative is finding out from a runtime error in a path the
tests do not cover.

**Verify:** the grep above returns only definition lines, then after deletion it
returns nothing, and the full suite still reports 141 tests or more.

### Step 5.3: Quiz yourself

1. After this phase, what still checks that `getAggregateStatsSchema` matches the real Convex function? Name the file and the mechanism.
2. Someone adds a `lane` parameter to `api.invocations.getAggregateStats` next month and does not touch `src/`. What is the first thing that fails, and at what moment?
3. `assets/drift-check.ts` becomes redundant. Name a change to this codebase that would make it useful again.

### ✅ Solution

The eight remaining schemas follow Phase 4's patterns exactly. The two decisions
worth recording:

```ts
// One schema, two validators. pause and resume take identical arguments and
// must keep taking identical arguments; the tool name differs only in the
// error message.
export const taskDefIdSchema = z.strictObject({
  taskDefId: z.string().trim().min(1).describe("The task definition id."),
});

export const validatePause = makeValidator("pause", taskDefIdSchema);
export const validateResume = makeValidator("resume", taskDefIdSchema);
```

```ts
// listCostRollups: `after` is required, not optional. types.ts:159-161.
export const listCostRollupsSchema = z.strictObject({
  after: z.number().describe("Unix-ms lower bound. Required."),
  groupFolder: z.string().optional(),
  limit: z.number().optional(),
});
```

On question 2, the answer that matters: `Bound<>` fails at `tsc`, on the next
typecheck, before anything runs. Today the same change produces a tool that
advertises the old shape to the model and keeps working until someone notices
the results are wrong.

### Step 5.4: Run it

```bash
cd /Users/ea/Programming/web/fractal/pm-interview-dashboard-main
npm test && npm run lint && ./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"
```

**Expected output:** `Tests 141 passed`, `0 errors` from eslint, and `0` from the
typecheck grep.

**If it fails:** `git log --oneline` and revert the last tool's commit. You have
one commit per tool for exactly this.

### ✅ Phase 5 complete

**You've learned:** how to land a twelve-site migration without a big-bang diff,
and how to tell when a runtime check has been made redundant by a compile-time
one.

**Next:** the Test plan.

---

## Test plan

Run in order, from `/Users/ea/Programming/web/fractal/pm-interview-dashboard-main`.

1. **Typecheck.** `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` prints `0`.
2. **The backend errors did not grow.** `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^convex/"` prints `6`. A different number means you edited something out of scope.
3. **Unit tests.** `npm test` prints `Test Files 24 passed (24)` and `Tests 141 passed (141)` or higher.
4. **Lint.** `npm run lint` prints `0 errors`. Twenty-one warnings are pre-existing; more than twenty-one means you added one.
5. **The advertised shapes still work.** `npm run probe:backend` prints `12 tools checked`.
6. **The bind actually binds.** Break one schema on purpose: rename `groupFolder` to `lane` in `getAggregateStatsSchema`. Step 1 must now print a number greater than `0`. Put it back and confirm it returns to `0`. A migration whose safety check you never saw fail is a migration with no safety check.
7. **End to end.** `npm run dev` in one terminal, `npm run test:e2e` in another. All Playwright specs pass.
8. **Teardown.** Stop the dev server. `git status` shows only the five files in Scope.

If step 3 fails, read which `/pattern/` assertion broke and fix the message, not
the test. If step 6 does not fail when you break the schema, your bind is the
naive `Exact<>` from Phase 1.2 and it is checking nothing.

---

## Done criteria

**Per step:**

- [ ] Phase 1: `src/lib/toolSchemas.ts` exists, and deliberately renaming a field in `getAggregateStatsSchema` makes `tsc -b --noEmit 2>&1 | grep -c "^src/"` print more than `0`
- [ ] Phase 2: `grep -c "additionalProperties" src/lib/tools.ts` prints `0`, and `npm run probe:backend` prints `12 tools checked`
- [ ] Phase 3: a test asserting the tool name appears in a validation error exists and passes: `./node_modules/.bin/vitest run src/lib/tools.test.ts -t "names the tool"`
- [ ] Phase 4: `./node_modules/.bin/vitest run src/lib/tools.test.ts` passes the whitespace pair at `tools.test.ts:143-146`
- [ ] Phase 5: `grep -rn "asArgsRecord\|assertKnownKeys\|optionalNumber\|optionalString" src/` returns nothing

**Final gates:**

- [ ] `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^src/"` prints `0`
- [ ] `./node_modules/.bin/tsc -b --noEmit 2>&1 | grep -c "^convex/"` prints `6`
- [ ] `npm test` prints `Tests 141 passed (141)` or higher
- [ ] `npm run lint` prints `0 errors` and no more than 21 warnings
- [ ] `npm run test:e2e` passes with the dev server running
- [ ] `git status --porcelain` lists only `package.json`, `src/lib/types.ts`, `src/lib/toolSchemas.ts`, `src/lib/tools.ts`, `src/lib/tools.test.ts`
- [ ] `zod` appears in `dependencies` in `package.json`, not only in the lockfile

---

## STOP conditions

Report back rather than improvising if any of these happen.

- **Drift.** The drift-check command at the top prints changes. This document describes a `tools.ts` that no longer exists.
- **The symptom is unchanged.** You finish Phase 5 and step 6 of the Test plan still passes when you deliberately break a schema. The bind is not binding, and every remaining benefit of this migration was the bind.
- **`convex/` error count moves off 6.** You have edited the supplied brief slice, which is out of scope in both directions.
- **A test needs its assertion changed rather than its subject.** If you find yourself editing `tools.test.ts:56` from `/days/` to match a new message, stop. That test is pinning behaviour the model depends on.
- **`z.toJSONSchema` emits something OpenRouter rejects.** This is the one step with an external dependency whose behaviour is not covered by the local suite. Do not guess at a transform; bring the emitted object back.
- **The `listRecent` bind will not satisfy any target type.** `status` is app-level and `ListRecentToolArgs` is an intersection. If neither the intersection nor `FunctionArgs` works, something about the tool's contract changed and needs a decision, not a cast.

---

## Maintenance notes

- **`assets/drift-check.ts` in the teaching workspace becomes redundant** once Phase 1's bind covers all twelve tools. It is not deleted by this work because it lives outside the repo. Note it in the workspace, do not delete it silently.
- **Deliberately deferred:** improving any `description` string. They move verbatim so the diff stays reviewable. Wording changes are a separate ticket, and they are the one thing here that actually changes model behaviour.
- **Deliberately deferred:** the 6 `convex/` type errors.
- **A reviewer should double-check** two things specifically. First, that `Bound<>` uses `Required<>` or a `keyof` comparison, because the naive version type-checks and does nothing. Second, that every thrown message still begins with the tool name, since no existing test asserts it and it is the property most likely to be lost.
- **Zod becomes a direct dependency.** Not tidy-up. Verified 2026-08-24: `zod@4.4.3` is in neither `dependencies` nor `devDependencies`, and `npm ls zod` traces it to `eslint-plugin-react-hooks@^7.1.1`, a devDependency. `convex@1.42.0` does not depend on zod at all. `toolSchemas.ts` is runtime code that ships in the Vite bundle, so an `npm ci --omit=dev` build drops the only provider of its import and fails to resolve it. Install it pinned (`npm install zod@4.4.3`) so the copy you add is the copy the lint plugin already resolves.

---

## What You Should Know Now

**You can now do, unaided:**

- Take a shape that is written down in three places and reduce it to one declaration plus one compile-time assertion, in any TypeScript codebase.
- Write a type-level equality check and, more importantly, verify that it fails when it should, instead of assuming it works because it compiles.
- Read a test suite as a specification of what a refactor must preserve, and identify the properties it does not pin.
- Decide whether an error message is a log line or an interface, by finding out who reads it.

**Now true about this codebase:**

- `AggregateStatsArgs` and its nine siblings are derived from the Convex function signatures. That derivation was always the strongest link in `tools.ts`, and it is now the anchor everything else is checked against.
- `status` on `listRecent` is app-level, not a backend argument. `runListRecent` strips it before the Convex call and filters in your own code.
- The existing `tools.test.ts` asserts on regexes rather than exact strings, which is why a validation-library swap was possible at all.
- `tsc -b` on this repo reports 6 errors in `convex/` and always has. That number is a gate, not a bug.

**Check yourself:**

1. A teammate adds a thirteenth tool next month and copies the pattern. What single line would tell them, at build time, that they got the argument shape wrong? What tells them today?
2. Your `Bound<>` uses `Required<>`. Someone simplifies it to a plain `extends` pair during a cleanup and all tests still pass. How would anyone find out?
3. `loop.ts:123` reads `error.message` and sends it to a model. Name one other place in a codebase you have worked on where a string you would call a log line is actually an interface.

---

## Stretch Goals

**Generate the tool descriptions from the Convex functions too**

The `description` strings on each tool are the last hand-written thing the model
reads, and they are the part most likely to be wrong in a way that changes
behaviour, because a stale description sends the model to the wrong tool
entirely. Convex function definitions can carry their own documentation.

> Copy this prompt to get a tutorial for it:
> `In /Users/ea/Programming/web/fractal/pm-interview-dashboard-main, each entry in the registry at src/lib/tools.ts carries a hand-written 'description' string sent to OpenRouter via toOpenRouterTools at tools.ts:864. The argument shapes are already derived from Convex via FunctionArgs and Zod schemas in src/lib/toolSchemas.ts, but descriptions are not. Write a tutorial for moving the descriptions to the Convex function definitions in convex/ and deriving them, or explain with evidence why that is not possible with Convex's current API and what the best alternative is.`

**Property-test the validators against the JSON Schema they advertise**

You now have one declaration producing both a runtime check and a document. A
generator can produce values from the JSON Schema and assert every one of them
parses, which catches emitter bugs that neither the unit tests nor the compiler
sees.

> Copy this prompt to get a tutorial for it:
> `In /Users/ea/Programming/web/fractal/pm-interview-dashboard-main, src/lib/toolSchemas.ts holds one Zod schema per tool, and toParameters() emits each as JSON Schema for OpenRouter. Write a tutorial for a property-based test using fast-check that generates values from each emitted JSON Schema and asserts the corresponding validator accepts them, so a z.toJSONSchema emitter bug fails locally. The project uses Vitest 4 and has 141 existing tests; do not change them.`

**Give the model structured repair hints instead of a message string**

`loop.ts:125` pushes a plain string. OpenAI-compatible tool protocols allow
richer error payloads, and a `ZodError` already carries `path` and `code` per
issue. A model handed the field path and the expected type corrects in one step
more reliably than one handed prose.

> Copy this prompt to get a tutorial for it:
> `In /Users/ea/Programming/web/fractal/pm-interview-dashboard-main, src/lib/loop.ts:120-126 catches tool errors and pushes error.message as a string via toolErrorMessage. Validation errors now come from Zod and carry structured issues (path, code, expected). Write a tutorial for feeding the model a structured repair hint rather than a flattened string, including how to measure whether it actually reduces the number of steps to a correct call. Keep loop.ts's three-way error policy (documented at loop.ts:8-12) unchanged.`

---

## Advanced Techniques & Alternate Solutions

**Keep the hand-written validators, add a generated conformance test.**

Instead of replacing anything, write one test that builds the expected JSON
Schema from each `validate*` function's behaviour and compares it to the
advertised `parameters` block.

```ts
it.each(registry)("$name advertises what it accepts", (tool) => {
  for (const key of Object.keys(tool.parameters.properties)) {
    expect(() => tool.execute({ [key]: probeValue }, fakeDeps)).not.toThrow(
      /unknown argument/,
    );
  }
});
```

This is roughly what `assets/drift-check.ts` already does. **Pick this over the
migration when you cannot add a dependency**, or when the codebase is being
handed off and a reviewer needs the smallest possible diff. It detects drift; it
does not prevent it, and it says nothing about the Convex signature. The
crossover is dependency freedom: if you may not add Zod, this is the best
available answer.

**Generate the schemas from Convex at build time.**

Convex knows every function's argument validators. A codegen step could emit
`toolSchemas.ts` rather than having you write it, removing the last hand-written
copy entirely.

```jsonc
// package.json
"scripts": { "codegen:tools": "bun run scripts/gen-tool-schemas.ts" }
```

**Pick this over hand-written schemas at around thirty tools**, or as soon as the
same person stops owning both sides. Below that, a generator is a build step, a
script to maintain, and a new failure mode, in exchange for deleting twelve short
declarations. At twelve tools it is worse than what this document builds. At
fifty it is obviously right, and the crossover is roughly where you stop being
able to hold the whole registry in your head.

**Use the AI SDK's `tool()` helper and delete the registry.**

`vercel/ai-chatbot` never has this problem. Its `app/(chat)/api/chat/route.ts:311`
passes an object of `tool({ inputSchema, execute })` values and `streamText`
handles dispatch, erasure, and schema publication.

**Considered and rejected for this repo.** Adopting it means adopting the `ai`
package's streaming on both ends, which replaces `src/lib/openrouter.ts` including
the SSE reassembly at `openrouter.ts:150-161`. That is a much larger change than
this one, and it trades a boundary you understand for one you do not. It is the
right call on a greenfield project and the wrong call on a finished one.

---

## Reference

### Common patterns

```ts
// Derive, don't restate
type Args = FunctionArgs<typeof api.module.fn>;

// Bind a schema to a derived type
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
type Bound<S, Args> = Exact<Required<S>, Required<Args>>;
const _bound: Bound<z.infer<typeof schema>, Args> = true;

// Reject unknown keys, don't drop them
z.strictObject({ ... });          // throws
z.object({ ... });                // silently strips
// ...and no bind can tell them apart: z.infer<> is identical. Test it at runtime.

// Publish the INPUT side, not the output
z.toJSONSchema(schema, { io: "input" });   // .default() field stays optional
z.toJSONSchema(schema);                    // io: "output" -> emits it as required

// Order is semantic
z.string().trim().min(1);         // "   " throws
z.string().min(1).trim();         // "   " passes
```

### Troubleshooting

**Problem:** `Type 'true' is not assignable to type 'never'` on a bind line.
**Solution:** The schema and the args type genuinely disagree. Hover
`z.infer<typeof schema>` and diff it against the `// ->` comment on the
`FunctionArgs` line in `types.ts`.

**Problem:** The bind compiles even with a deliberately wrong field name.
**Solution:** You are using bare `Exact<>` on all-optional shapes. Wrap both
sides in `Required<>`.

**Problem:** The whitespace test fails but the empty-string test passes.
**Solution:** `.min(1)` runs before `.trim()`. Swap them.

**Problem:** `npm run probe:backend` reports drift after Phase 2.
**Solution:** Not a bug in your code. The probe found a real disagreement
between the advertised properties and the validator, which is what it is for.
Fix the schema.

### Key takeaways

1. A shape written in three places is three chances to be wrong. Derive two of them.
2. A type-level check you have never seen fail is not a check.
3. `extends` is close to useless as an equality test on all-optional objects.
4. A green suite proves you broke nothing tested. Read the assertions to find out what was never tested.
5. An error message that another system reads is an interface, and changing it is an API change.

### Full reference implementation

The complete `src/lib/toolSchemas.ts` is the concatenation of the Phase 1, 3, 4,
and 5 solutions in that order: imports, the `Exact` and `Bound` type helpers,
`toParameters`, `makeValidator`, then twelve schema-and-bind pairs. Each registry
entry in `tools.ts` reduces to:

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

**End of Tutorial**
