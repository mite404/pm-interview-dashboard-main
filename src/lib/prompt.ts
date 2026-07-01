// Phase 2 (T2): the dynamic system prompt, a pure fn so it is unit-testable and
// the current date can be injected - the LLM resolves relative windows ("this
// week") against the seeded data's clock, not its training cutoff. Tool
// descriptions live in the tool schemas (the `tools` param), not here; this owns
// only cross-cutting behavior, kept minimal and load-bearing. Add a rule only
// when a test or a real interaction proves the model needs it - no few-shot
// examples, no tool list.

interface BuildSystemPromptOptions {
  now: Date;
}

/**
 * Builds the system message sent on every turn, with the current date injected.
 *
 * @param options.now - the current date, injected so relative time windows
 *   resolve against it (and so the prompt stays deterministic to test)
 * @returns the system prompt string (single-newline separated, per brief line 78)
 */
export function buildSystemPrompt({ now }: BuildSystemPromptOptions): string {
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return [
    "You are the admin assistant for the PlanMonster dashboard, an operator tool for monitoring agent activity across WhatsApp, iMessage, SMS, and web.",
    `Today is ${today}. Resolve relative time windows against this date: "this week" is the last 7 days, "this month" the last 30 days.`,
    "Rules:",
    "- Only state figures a tool returned. Never invent, estimate, or recall numbers from memory; if you have no tool result for something, say so.",
    "- If a request is ambiguous (which user? which time window? which task?), ask one brief clarifying question instead of guessing.",
    "- Before any action that changes state (pausing a task, sending a message), name the specific target you resolved and confirm it, unless the target is unambiguous.",
    "- Write concise prose with single newlines between lines, not double. Render any tabular data as GitHub-flavored Markdown tables.",
  ].join("\n");
}
