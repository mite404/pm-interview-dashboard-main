// The transcript drill-in's pure data layer (data -> calculation, no React, no
// network). A transcript is a flat list of messages with ms-epoch timestamps;
// the one calculation here derives where a time-gap separator belongs by
// looking at the gap between consecutive messages. Rendering (bubbles, the date
// pill, formatting a gap into human text) lives in the component - this file
// only decides *where* the breaks go, so the rule is unit-testable without a DOM
// and applies unchanged to the real `messages.listByChatJid` data after PR 2.

// One message in a transcript. `isFromMe` drives the two-sided layout: true ->
// navy bubble, right-aligned (the contact/admin side); false -> white-bordered
// bubble, left-aligned (Monty). `timestamp` is a unix-ms epoch, the shape the
// backend (getReplyLineage, listByChatJid) returns - the design's "9:02 AM"
// strings are a presentation of this, formatted in the component.
export interface TranscriptMessage {
  id: string;
  text: string;
  isFromMe: boolean;
  timestamp: number;
}

// The person the transcript belongs to - drives the modal header and avatar.
// `avatarBg` is a hex from the design's avatar palette; `jid` is the WhatsApp
// chat id the real `messages.listByChatJid` is keyed by.
export interface TranscriptContact {
  name: string;
  jid: string;
  initials: string;
  avatarBg: string;
}

// The render list `withTimeGaps` produces: each message, with a `gap` marker
// spliced in before any message that opened more than the threshold after the
// previous one. `gap` carries `at` (the following message's timestamp) so the
// component can format a caption, and `gapMs` for good measure.
export type TranscriptItem =
  | { kind: "message"; message: TranscriptMessage }
  | { kind: "gap"; gapMs: number; at: number };

// A conversation that pauses longer than this reads as a new sitting, so we
// break it with a separator. The handoff calls for ~20-30 min; 25 sits in the
// middle. Exposed as the default arg so tests (and future config) can override.
export const DEFAULT_GAP_MS = 25 * 60 * 1000;

/**
 * Splices a time-gap separator before every message that follows a pause longer
 * than `gapThresholdMs`. Pure: same input -> same output, no side effects.
 *
 * Assumes `messages` is already in chronological order (the backend returns it
 * sorted); it compares each message only to its immediate predecessor.
 *
 * @param messages - the transcript, oldest first
 * @param gapThresholdMs - a pause strictly greater than this inserts a separator
 * @returns the messages interleaved with `gap` markers, in render order
 */
export function withTimeGaps(
  messages: TranscriptMessage[],
  gapThresholdMs: number = DEFAULT_GAP_MS,
): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  let previousTimestamp: number | null = null;

  for (const message of messages) {
    if (
      previousTimestamp !== null &&
      message.timestamp - previousTimestamp > gapThresholdMs
    ) {
      items.push({
        kind: "gap",
        gapMs: message.timestamp - previousTimestamp,
        at: message.timestamp,
      });
    }
    items.push({ kind: "message", message });
    previousTimestamp = message.timestamp;
  }

  return items;
}
