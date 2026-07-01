// Fixture transcript for the drill-in, lifted from the design source's `userDefs`
// (Maya Patel). The handoff's `msgs` carry "9:02 AM"-style strings; here they are
// real ms-epoch timestamps so the pure `withTimeGaps` rule has something to bite
// on. The thread is Maya's five real messages plus one follow-up ~67 min later,
// so the transcript demonstrates a time-gap separator (the tight morning burst is
// one sitting, the follow-up opens a second).
//
// STUB: this stands in for `messages.listByChatJid` until PR 2 lands the synthesis
// flow that supplies real transcript data. The shape already matches the backend.

import type { TranscriptContact, TranscriptMessage } from "./transcript";

// Sunday-morning anchor; the date pill label below is the design's verbatim text.
const DAY = Date.UTC(2026, 5, 28, 0, 0, 0);
function at(hour: number, minute: number): number {
  return DAY + (hour * 60 + minute) * 60 * 1000;
}

export const fixtureContact: TranscriptContact = {
  name: "Maya Patel",
  jid: "15234567890@c.us",
  initials: "MP",
  avatarBg: "#0B3A54",
};

export const fixtureDateLabel = "Tuesday · Jun 28";

export const fixtureMessages: TranscriptMessage[] = [
  {
    id: "mp-1",
    isFromMe: true,
    timestamp: at(9, 2),
    text: "Hey Monty, what backsplash tile pairs with a matte black quartz counter?",
  },
  {
    id: "mp-2",
    isFromMe: false,
    timestamp: at(9, 2),
    text: "A few crew favorites: a soft white 3×12 subway keeps it clean and high-contrast, or a warm greige zellige if you want texture. Both hide grout lines well against black.",
  },
  {
    id: "mp-3",
    isFromMe: true,
    timestamp: at(9, 5),
    text: "Go with the zellige. Can you pull a takeoff for a 24 sq ft run?",
  },
  {
    id: "mp-4",
    isFromMe: false,
    timestamp: at(9, 5),
    text: "On it — 24 sq ft of zellige at ~10% waste = 27 sq ft to order. I flagged 3 suppliers with stock near your zip.",
  },
  {
    id: "mp-5",
    isFromMe: true,
    timestamp: at(9, 8),
    text: "Perfect, that's exactly what I needed.",
  },
  {
    id: "mp-6",
    isFromMe: true,
    timestamp: at(10, 15),
    text: "Actually — one more. Same job, can you price the matching bullnose trim?",
  },
];
