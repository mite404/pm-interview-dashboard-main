# Design Documentation

## Context

I'm building an admin dashboard for a product that provides contractors, tradespeople and designers
with a back office AI assistant. The goal is to have the majority of the functionality be
accessible purely through conversational tone with an LLM.

## Architecture at a glance

The app is a single chat surface over a pre-existing Convex backend. One turn flows in one direction:

admin message -> the LLM picks a tool (routing call) -> we validate the args -> run it against Convex
-> feed the result back into the loop (repeat until the model stops or `MAX_STEPS` is hit)
-> render the tool result inline as a typed component -> stream the model's text answer.

Two principles cut across every stage below:

- Injected side effects. The OpenRouter calls and the Convex client are passed in as parameters,
  so `App.tsx` is the only place real services are wired and everything else is tested against fakes.
- The LLM never touches Convex directly. It only names a tool and emits JSON args; our code validates
  them before anything runs.

## The loop - the conversational engine

### The agentic loop: iterate until done, errors as observations, bounded by `MAX_STEPS`

Goal: To create a while loop that runs until the LLM stops calling tools.
This prevents an agent from silently failing and looping indefinitely.
We also need to treat a tool error as an observation the model can reason over
and self-correct from.
Only an unreachable-LLM error aborts.

Alternative rejected: The naive design is try/catch -> abort

Why: Bounding an agent stuck in a loop by `MAX_STEPS` guarantees termination &
caps cost.

### Two-call turn: route non-streamed, then answer streamed

Goal: Each turn makes two distinct OpenRouter calls:
a non-streamed routing call (`tool_choice: auto`, `parallel_tool_calls: false`)
that returns at most one tool, then a streamed answer call once tools are done.

Alternative rejected: One streaming call that interleaves tool calls and text.

Why: The tool-picking step is invisible machinery, so don't dress it up with streaming.

### Conversation context: two-store separation

Goal: Keep the conversation in two stores - the on-screen chat list and the LLM wire array.
The wire is rebuilt from text each turn, so tool results stay only within the multi-step turn
and never persist across turns.

Alternative rejected: Append everything and re-send entire array each turn. Also considered
sliding window and summarization.

Why: Re-sending tool call payloads increases token spend and uses context window capacity.
Windowing/summarization is the production answer but out-of-scope for this assessment's timeline.

## The tool boundary - natural language to a safe Convex call

### Tool registry with a `validate` boundary (LLM never touches api directly)

Goal: Each tool is a hand-written object `{ name, description, parameters, validate, run }`
The LLM only names a tool, emits JSON args, our code looks it up and runs it.
`validate(rawArgs)` returns typed checked args or throws.

Alternative rejected: Let the LLM call api.* fns directly or pass its raw args directly to Convex.

Why: This was explict for evaluation "Does the LLM hallucinate arguments, or are args validated?"
Gives one chokepoint to catch hallucinated args. A `validate` throw is descriptive so this feeds our agentic loop.

## Keeping the model honest - guardrails

### System Prompt: Minimal with anti-fabrication as load-bearing rule

Decision: Compose a short prompt carrying 4-6 rules and injecting the date via `buildSystemPrompt({ now })`
The tool descriptions live in the tool schemas, not the prompt. If there's ambiguity
in the user's request ask for clarification. Only state figures returned by tools NEVER invent numbers.

Alternative rejected: A long prompt that lists every tool or includes examples of phrases or 'what good looks like'

Why: For a chat interface with LLMs a failure is a confident wrong number,
therefore 'anti-fabbrication rule' and 'reference figures returned from DB' are earned.
The tool schemas already feed the model tool definitions, duplicating them in a prompt will eventually drift and cost tokens.
Prompt bloat will dilute the rules the model needs to weigh as it's north star, only adding a rule when evidence shows that info is missing.

### Undo Send on enqueue Only

Goal: A 5-second client-side cancel window before enqueueing a DM from admin -> user.

Alternative rejected: Confirm every mutation (bad UX) or a blanket guard on all `readonly: false` tools.

Why: A message to a person is hard to unsend so I took a page from modern email applications. The loop defers
the Convex call behind a timer, so nothing reaches the backend until the graceperiod has elapsed.

## Rendering - data to screen

### Render dispatch: a discriminated ToolResult union

Goal: `ToolResult` is a discriminated union keyed on `tool` (types.ts), pairing
each tool with its exact `data` type. `ToolResultChart` switches on `tool`;
inside each case TypeScript narrows `data` to that tool's type, so the transform
and component for a result can't be mismatched. A `never` guard in `default`
makes the switch provably exhaustive: adding a tool without a render case fails
to compile.

Alternative rejected: One render path that inspects the result's shape at runtime.

Why: Shape-sniffing fails at render time, in the browser, on the one payload that
looks ambiguous. The tagged union moves that failure to compile time and gives
each tool a single, typed home. Adding a tool becomes a checklist the compiler
enforces, not a convention to remember.

The three render paths: charts -> Recharts components; tables/cards -> typed React components;
assistant text -> `react-markdown`. Recharts is the shadcn preferred lib.

## Engineering practice

### Dependency Injection / Composition Root

Goal: The loop and every tool take their services as injected parameters. App.tsx is
the only file that wires the real ones. The tests pass fakes.

Alternative rejected: Import `convex` and `fetch` directly where they're used.

Why: It splits the code into pure calculations (validate, transforms, SSE, parsers) and actions.
The calculations test deterministically with no network. The loop runs against fakes in `loop.test.ts`
Wiring lives in one place so there's one seam to reason about.

### Dropped `tsc` gate

Decision: No command-line `tsc --noEmit` gate. Type safety on the frontend comes
from strict TypeScript in the editor (the language server) plus the test suite; I
gate on ESLint and tests, not a project-wide typecheck.

Alternative rejected: Wire `tsc --noEmit` into the gate.

Why: A project-wide `tsc` also typechecks the `convex/` backend I was handed, which
does not pass under `strict`

### What I cut

`DailyUsersBarChart` + `toDailyUsersBarData` + tests. Dead code that satisfies no criteria,
duplicates a chart type I already have, and renders empty on the demo data.
