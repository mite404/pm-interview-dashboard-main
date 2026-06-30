# Design Documentation

## The agentic loop: Iterate until done, errors as observations bounded by `MAX_STEPS`

Goal: To create a while loop that runs until the LLM stops calling tools.
This prevents an agent from silently failing and looping indefinitely.
We also need to treat a tool error as an observation the model can reason over and self-correct from.
Only an unreachable-LLM error aborts.

Alternative rejected: The naive design is try/catch -> abort

Why: Bounding an agent stuck in a loop by `MAX_STEPS` guarantees termination & caps cost per message.

## Wide default window `days: 90` and no `lane` filter

Goal: Query time-windowed tools with a wide default window and omit `lane`,
so seeded data alwyas returns non-zero results.

Alternative rejected: A narrow default window like `7d`

Why: Probing live deployment showed the seed data is frozen in a tight late-June
window and `lane` filtering returns all zeros against it. A narrow time window or `lane` filter returning
empty charts could read as bugs. A wide unfiltered call guarantees something will render while wiring up a frontend.

## Tool registry with a `validate` boundary (LLM never touches api directly)

Goal: Each tool is a hand-written object `{ name, description, parameters, validate, run }`
The LLM only names a tool, emits JSON args, our code looks it up and runs it.
`validate(rawArgs)` returns typed checked args or throws.

Alternative rejected: Let the LLM call api.* fns directly or pass its raw args directly to Convex.

Why: This was explict for evaluation "Does the LLM hallucinate arguments, or are args validated?"
Gives one chokepoint to catch hallucinated args. A `validate` throw is descriptive so this feeds our agentic loop.

## Undo Send on enqueue Only

Goal: A 5-second client-side cancel window before enqueueing a DM from admin -> user.

Alternative rejected: Confirm every mutation (bad UX) or a blanket guard on all `readonly: false` tools.

Why: A message to a person is hard to unsend so I took a page from modern email applications. The loop defers
the Convex call behind a timer, so nothing reaches the backend until the graceperiod has elapsed.

## No Chained Mutations

Goal: Prevent write -> write tool chains

Why: Flows are reads-then-one-terminal-write, so there is never a half-applied mutation to roll back removing partial write recovery edge case.

## Conversation Context Stubbing / Two store separation

Goal: Keep conversation in LLM array. Once a turn completes, replace heavy
tool-result with a stub (e.g. [chart data rendered]). Tool results stay only within multi-step turn.

Alternative: Append everything and re-send entire array each turn. Also considered
sliding window and summarization.

Why: Re-sending tool call payloads increases token spend and uses context window capacity.
Windowing/summarization is the production answer but out-of-scope for this assessment's timeline.

## Rendering: 2 Output paths (components for charts, markdown for text tables)

Goal: A tool result is rendered inline in one of two ways, a chart as a Recharts component
and the LLM's response as GFM tables. The UI picks the path by the result's shape.

Alternative rejected: Push everything via text. `markdown-ui` library style chart blocks what the model emits
or ASCII charts or some form of SVG.

Why: Tables are text and the LLM already emits GFM, so that path is free. It also doesn't require a sandbox
for rendering some HTML alternative. Making the model emit some chart syntax puts format correctness on a
non-deterministic path. Recharts is the shadcn preferred lib.
Assistant prose: `react-markdown`
Tables: `react-markdown` & `remark-gfm`
Charts: Recharts components

## System Prompt: Minimal with anti-fabrication as load-bearing rule

Decision: Compose a short prompt carrying 4-6 rules and injecting the date via `buildSystemPrompt({ now })`
The tool descriptions live in the tool schemas, not the prompt. If there's ambiguity
in the user's request ask for clarification. It will output a single-newline GFM-table output.
Only state figures returned by tools NEVER invent numbers.

Alternative rejected: A long prompt that lists every tool or includes examples of phrases or 'what good looks like'

Why: For a chat interface with LLMs a failure is a confident wrong number,
therefore 'anti-fabbrication rule' and 'reference figures returned from DB' are earned.
The tool schemas already feed the model tool definitions, duplicating them in a prompt will eventually drift and cost tokens.
Prompt bloat will dilute the rules the model needs to weigh as it's north star, only adding a rule when evidence shows that info is missing.

## Dropped `tsc` gate

Decision: I'm wiring up a frontend to a pre-existing backend Convex server that's already running.
There will be no build step for this repo so relying on ESLint for type safety.

Why: `convex/_generated/api.d.ts` drags the convex source into any `tsc` run
