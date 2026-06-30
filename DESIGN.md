# Design Documentation

## Unbounded Agent Loop

Goal: Prevent agent from silently failing and looping indefinitely?

Why: MAX_STEPS guarantees termination & caps cost per message.

## Audience call

## Validate Boundary

## Two-Store Separation

## Undo Send on enqueue Only

## No Chained Mutations

Goal: Prevent write -> write tool chains

Why: Not allowing chained mutations removes partial write recovery edge case.

## Conversation Context: Stubbing rather than re-sending everything

Goal: Keep conversation in LLM array. Once a turn completes, replace heavy
tool-result with a stub (e.g. [chart data rendered]). Tool results stay only within multi-step turn.

Alternative: Append everything and re-send entire array each turn. Also considered
sliding window and summarization.

Why: Re-sending tool call payloads increases token spend and uses context window capacity.
Windowing/summarization is the production answer but overkill for short admin sessions. Scaled solution.

## Hand-written tool registry (`validate`/`run` per tool) over letting the LLM hit `api.*` directly

Gives one chokepoint to catch hallucinated args.

## 14. react-markdown + remark-gfm for tables

Alternative: over markdown-ui or a table lib

Why: the LLM already emits GFM; markdown-ui would put format-correctness burden on the model.
