// The message-history drill-in (design handoff: "Message History Modal", block
// 08). A centered modal - NOT the right-side Sheet the plan first sketched; the
// handoff is the source of truth. Presentational: it takes a contact + a message
// array and paints the transcript. It owns no data fetching - the caller supplies
// the messages (a fixture now, `messages.listByChatJid` after PR 2).
//
// Border idiom: this is a SHEET block, so hard edges - `border-2 border-dc-navy`,
// radius 0. That is deliberately distinct from the sidebar nav (09), which uses
// the shadcn 8px idiom. Keep the two apart.

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { withTimeGaps } from "@/lib/transcript";
import type { TranscriptContact, TranscriptMessage } from "@/lib/transcript";

export interface TranscriptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: TranscriptContact;
  messages: TranscriptMessage[];
  /** Date-pill divider text at the top of the thread, e.g. "Tuesday · Jun 28". */
  dateLabel: string;
  /** Meta-strip channel cell. Defaults to the design's "WhatsApp". */
  channel?: string;
  /** Meta-strip last-active cell. Defaults to the design's "2d ago". */
  lastActive?: string;
  /** Meta-strip count. Defaults to the number of messages shown. */
  messageCount?: number;
  /** Forwarded to `withTimeGaps`; omit for the ~25-min default. */
  gapThresholdMs?: number;
}

// ── pure formatters (presentation only) ──────────────────────────────────
// Times render in UTC so a fixture with UTC-anchored timestamps looks the same
// on every machine (and in tests) instead of drifting with the local zone.
function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// A time-gap separator caption, e.g. "1h 7m later" / "45m later".
function formatGap(gapMs: number): string {
  const totalMinutes = Math.round(gapMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    hours > 0 ? `${String(hours)}h` : "",
    minutes > 0 ? `${String(minutes)}m` : "",
  ].filter(Boolean);
  return `${parts.join(" ")} later`;
}

// ── presentational pieces ────────────────────────────────────────────────
function Bubble({ message }: { message: TranscriptMessage }) {
  if (message.isFromMe) {
    return (
      <div className="max-w-[80%] self-end">
        <div className="bg-dc-navy px-3.5 py-2.5 text-sm leading-normal text-white">
          {message.text}
        </div>
        <div className="mono mt-[3px] text-right text-[10px] text-dc-placeholder">
          {formatClock(message.timestamp)}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[80%] self-start">
      <div className="border-2 border-dc-border-neutral bg-white px-3.5 py-2.5 text-sm leading-normal text-dc-navy">
        {message.text}
      </div>
      <div className="mono mt-[3px] text-[10px] text-dc-placeholder">
        Monty · {formatClock(message.timestamp)}
      </div>
    </div>
  );
}

function MetaCell({
  value,
  label,
  divider,
  numeric,
}: {
  value: string;
  label: string;
  divider?: boolean;
  // The count cell is condensed-but-not-uppercased mono digits (design source);
  // the channel / last-active cells are the uppercase `hd-cond` treatment.
  numeric?: boolean;
}) {
  return (
    <div
      className={`flex-1 px-[18px] py-3 ${divider ? "border-r border-dc-border-hairline" : ""}`}
    >
      <div
        className={`text-lg font-bold text-dc-navy ${numeric ? "mono" : "hd-cond"}`}
      >
        {value}
      </div>
      <div className="text-[11px] text-dc-muted">{label}</div>
    </div>
  );
}

// ── the modal ─────────────────────────────────────────────────────────────
/**
 * Renders a contact's chat transcript in a centered modal (design: "Message
 * History Modal"). Radix `Dialog` supplies the backdrop, focus trap, and
 * esc-to-close; time-gap separators come from the pure {@link withTimeGaps}.
 *
 * @param props - see {@link TranscriptProps}
 */
export function Transcript({
  open,
  onOpenChange,
  contact,
  messages,
  dateLabel,
  channel = "WhatsApp",
  lastActive = "2d ago",
  messageCount,
  gapThresholdMs,
}: TranscriptProps) {
  const items = withTimeGaps(messages, gapThresholdMs);
  const count = messageCount ?? messages.length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,58,84,0.55)] p-10">
          <Dialog.Content
            aria-describedby={undefined}
            className="flex max-h-[86vh] w-[min(640px,100%)] flex-col border-2 border-dc-navy bg-white shadow-[0_30px_60px_-20px_rgba(11,58,84,0.6)] focus:outline-none"
          >
            {/* header */}
            <div className="flex items-center gap-3.5 border-b-2 border-dc-navy bg-dc-navy px-[22px] py-[18px] text-white">
              <div
                className="hd-cond flex size-11 flex-none items-center justify-center text-base font-bold text-white"
                style={{ background: contact.avatarBg }}
              >
                {contact.initials}
              </div>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="hd-cond text-[19px] font-bold tracking-[0.02em]">
                  {contact.name}
                </Dialog.Title>
                <div className="mono text-[11.5px] text-white/60">
                  {contact.jid}
                </div>
              </div>
              <Dialog.Close
                aria-label="Close transcript"
                className="flex size-[34px] items-center justify-center border border-white/40 text-white transition-colors hover:bg-white/15"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            {/* meta strip */}
            <div className="flex border-b-2 border-dc-border-neutral">
              <MetaCell
                value={String(count)}
                label="Messages"
                divider
                numeric
              />
              <MetaCell value={channel} label="Channel" divider />
              <MetaCell value={lastActive} label="Last active" />
            </div>

            {/* transcript */}
            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto bg-dc-thread px-[22px] py-5">
              <div className="text-center">
                <span className="hd-cond bg-dc-page px-3 py-1 text-[10.5px] font-bold tracking-[0.06em] text-dc-placeholder">
                  {dateLabel}
                </span>
              </div>
              {items.map((item) =>
                item.kind === "message" ? (
                  <Bubble key={item.message.id} message={item.message} />
                ) : (
                  <div key={`gap-${String(item.at)}`} className="text-center">
                    <span className="mono text-[10px] text-dc-placeholder">
                      — {formatGap(item.gapMs)} —
                    </span>
                  </div>
                ),
              )}
            </div>

            {/* footer - a greyed, read-only action row: these mutations belong to
                PR 2's synthesis/DM flow, so they are inert placeholders here. */}
            <div className="flex items-center gap-2.5 border-t-2 border-dc-navy bg-dc-card px-[22px] py-3.5">
              {/* STUB: wire Summarize Chat + Send DM to the real backend after PR 2. */}
              <button
                type="button"
                disabled
                className="hd-cond cursor-not-allowed bg-dc-orange px-[18px] py-2.5 text-[13px] font-bold tracking-[0.03em] text-white opacity-60"
              >
                Summarize Chat
              </button>
              <button
                type="button"
                disabled
                className="hd-cond cursor-not-allowed border-2 border-dc-navy bg-white px-4 py-2 text-[13px] font-bold tracking-[0.03em] text-dc-navy opacity-60"
              >
                Send DM
              </button>
              <span className="mono ml-auto text-[11px] text-dc-faint">
                messages.listByChatJid
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
