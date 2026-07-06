import { describe, expect, it } from "vitest";
import { assembleContext, estimateTokens } from "./context";
import type { ChatMessage } from "./types";

function msg(role: "user" | "assistant", text: string): ChatMessage {
  return { id: crypto.randomUUID(), role, text };
}

describe("estimateTokens", () => {
  it("approximates tokens as chars/4, rounding up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("assembleContext", () => {
  it("maps chat messages to wire role/content, in order, when under budget", () => {
    const history = [msg("user", "hi"), msg("assistant", "hello")];
    expect(assembleContext(history, 1000)).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("drops the oldest messages first to fit the token budget", () => {
    // Each text is 40 chars => 10 tokens. Budget 25 fits the 2 newest (20 tokens),
    // not all 3 (30 tokens), so the oldest is dropped.
    const history = [
      msg("user", "a".repeat(40)), // oldest - dropped
      msg("assistant", "b".repeat(40)),
      msg("user", "c".repeat(40)), // newest
    ];
    const wire = assembleContext(history, 25);
    expect(wire.map((m) => m.content)).toEqual([
      "b".repeat(40),
      "c".repeat(40),
    ]);
  });

  it("always keeps the newest message, even if it alone exceeds the budget", () => {
    // The current turn's question must never be dropped.
    const history = [msg("user", "x".repeat(4000))]; // ~1000 tokens
    const wire = assembleContext(history, 10);
    expect(wire).toHaveLength(1);
    expect(wire[0].content).toBe("x".repeat(4000));
  });

  it("preserves chronological order after windowing", () => {
    const history = [
      msg("user", "one"),
      msg("assistant", "two"),
      msg("user", "three"),
    ];
    expect(assembleContext(history, 1000).map((m) => m.content)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("returns an empty array for an empty history", () => {
    expect(assembleContext([], 1000)).toEqual([]);
  });
});
