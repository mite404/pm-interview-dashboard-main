// Context-window assembly (pure). The admin's chat history grows unbounded, and
// sending all of it every turn wastes tokens and eventually overflows the model's
// window. `assembleContext` bounds it: a recency window that keeps the newest
// turns under a token budget and drops the oldest first. Pure and network-free,
// so the budgeting logic is unit-tested without React or a live LLM.
//
// This is Tier 1 (recency) of the memory design in DESIGN.md. Tiers 2-3 (reply
// lineage, summary backfill) are product-side: they read the end-user message
// store (`getReplyLineage`, `messages.classification`), not the admin's own chat,
// which carries no pre-computed summaries to fall back to.

import type { WireMessage } from "./openrouter";
import type { ChatMessage } from "./types";

// Rough token estimate: ~4 characters per token for English prose.
// ponytail: chars/4 heuristic, swap for a real tokenizer if budgets get tight.
const CHARS_PER_TOKEN = 4;

/** Approximates the token cost of a string as chars/4, rounded up. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// The admin chat message as the LLM sees it: role + prose only. A ChatMessage's
// rendered artifact (chart/table) never goes on the wire, so it is dropped here.
function toWire(message: ChatMessage): WireMessage {
  return { role: message.role, content: message.text };
}

/**
 * Bounds the chat history to a token budget, newest-first.
 *
 * Walks from the most recent message backwards, keeping each until the next would
 * exceed `budgetTokens`, then returns the kept messages in chronological order.
 * The newest message is always kept - even if it alone exceeds the budget - so
 * the current turn's question is never dropped.
 *
 * @param history - the on-screen chat messages, oldest first
 * @param budgetTokens - the approximate token ceiling for the returned window
 * @returns the windowed wire messages, oldest first
 */
export function assembleContext(
  history: ChatMessage[],
  budgetTokens: number,
): WireMessage[] {
  const kept: WireMessage[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const wire = toWire(history[i]);
    const cost = estimateTokens(wire.content ?? "");
    if (kept.length > 0 && used + cost > budgetTokens) break;
    kept.push(wire);
    used += cost;
  }
  return kept.reverse();
}
