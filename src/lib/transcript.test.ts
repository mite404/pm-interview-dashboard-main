import { describe, expect, it } from "vitest";
import type { TranscriptMessage } from "./transcript";
import { DEFAULT_GAP_MS, withTimeGaps } from "./transcript";

const MIN = 60 * 1000;

// Build a chronological transcript from minute offsets so the gaps are obvious.
function messagesAtMinutes(offsets: number[]): TranscriptMessage[] {
  const base = Date.UTC(2026, 5, 28, 9, 0, 0); // Sun Jun 28 2026, 09:00 UTC
  return offsets.map((minutes, index) => ({
    id: `m${String(index)}`,
    text: `message ${String(index)}`,
    isFromMe: index % 2 === 0,
    timestamp: base + minutes * MIN,
  }));
}

describe("withTimeGaps", () => {
  it("returns an empty list for no messages", () => {
    expect(withTimeGaps([])).toEqual([]);
  });

  it("never inserts a separator for a single message", () => {
    const items = withTimeGaps(messagesAtMinutes([0]));
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("message");
  });

  it("keeps a tight conversation gap-free", () => {
    // 0, 3, 6, 9 min apart - all well under the 25-min threshold.
    const items = withTimeGaps(messagesAtMinutes([0, 3, 6, 9]));
    expect(items.map((item) => item.kind)).toEqual([
      "message",
      "message",
      "message",
      "message",
    ]);
  });

  it("splices a separator before the message that follows a long pause", () => {
    // A 67-min pause opens before the last message (9:08 -> 10:15).
    const messages = messagesAtMinutes([0, 3, 6, 8, 75]);
    const items = withTimeGaps(messages);

    expect(items.map((item) => item.kind)).toEqual([
      "message",
      "message",
      "message",
      "message",
      "gap",
      "message",
    ]);
    const gap = items[4];
    if (gap.kind !== "gap") throw new Error("expected a gap marker");
    expect(gap.gapMs).toBe(67 * MIN);
    expect(gap.at).toBe(messages[4].timestamp);
  });

  it("treats a gap exactly at the threshold as no break (strictly greater)", () => {
    const base = Date.UTC(2026, 5, 28, 9, 0, 0);
    const messages: TranscriptMessage[] = [
      { id: "a", text: "a", isFromMe: true, timestamp: base },
      { id: "b", text: "b", isFromMe: false, timestamp: base + DEFAULT_GAP_MS },
    ];
    expect(withTimeGaps(messages).map((item) => item.kind)).toEqual([
      "message",
      "message",
    ]);
  });

  it("honors a custom threshold", () => {
    // 10-min gaps break under a 5-min threshold but not the 25-min default.
    const messages = messagesAtMinutes([0, 10, 20]);
    expect(withTimeGaps(messages).map((item) => item.kind)).toEqual([
      "message",
      "message",
      "message",
    ]);
    expect(withTimeGaps(messages, 5 * MIN).map((item) => item.kind)).toEqual([
      "message",
      "gap",
      "message",
      "gap",
      "message",
    ]);
  });
});
