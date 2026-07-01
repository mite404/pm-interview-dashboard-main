// Direct Message composer (PR 3): the enqueue showcase. It resolves one real
// group on mount, then lets an admin queue a message on a channel - but the send
// is DEFERRED by the undo window (scheduleWithUndo): for 5s an "Undo" pill can
// cancel it before the Convex call ever fires. Delivery itself is inert on the
// preview (no channel creds), so this demonstrates the judgment (a reversible,
// confirmable write), not a live send.
//
// State ownership: the pure timer lives in `scheduleWithUndo`; this component
// owns only the UI-facing pieces (draft, channel, the pending handle, the
// result toast). Sheet idiom - hard 2px edges, radius 0 - matching Task Control.

import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { convex } from "@/lib/convexClient";
import { UNDO_WINDOW_MS, scheduleWithUndo } from "@/lib/undoSend";
import type { PendingSend } from "@/lib/undoSend";
import { cn } from "@/lib/utils";

type Channel = "whatsapp" | "sms" | "imessage";
const CHANNELS: Channel[] = ["whatsapp", "sms", "imessage"];

interface Recipient {
  id: Id<"registeredGroups">;
  name: string;
}

export function DirectMessageComposer() {
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingSend | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Cancel any in-flight send if the component unmounts mid-window. The ref is
  // synced in an effect (never written during render) so the unmount cleanup
  // reads the latest pending handle without re-subscribing every window.
  const pendingRef = useRef<PendingSend | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => () => pendingRef.current?.undo(), []);

  useEffect(() => {
    void convex
      .query(api.adminDirectMessages.listRecipients, {})
      .then((groups) => {
        const first = groups.at(0);
        if (first) setRecipient({ id: first._id, name: first.name });
      })
      .catch((error: unknown) => {
        console.error("Failed to load a recipient for the composer:", error);
      });
  }, []);

  function send() {
    if (!recipient || body.trim().length === 0 || pending) return;
    const messageBody = body;
    setToast(null);
    // Defer the real write; the pill can cancel it during the window.
    const handle = scheduleWithUndo(() => {
      setPending(null);
      void convex
        .mutation(api.adminDirectMessages.enqueue, {
          groupId: recipient.id,
          selectedChannel: channel,
          messageBody,
        })
        .then(() => {
          setBody("");
          setToast(
            `✓ adminDirectMessages.enqueue — queued to ${recipient.name}`,
          );
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          setToast(`✗ enqueue failed: ${message}`);
        });
    }, UNDO_WINDOW_MS);
    setPending(handle);
  }

  function undo() {
    pending?.undo();
    setPending(null);
    setToast("Send cancelled.");
  }

  return (
    <div className="rounded-none border-2 border-dc-border-neutral bg-dc-surface p-[18px]">
      <div className="hd-cond text-[17px] text-dc-navy">Direct Message</div>
      <div className="mt-1 font-mono text-[11.5px] text-dc-faint">
        adminDirectMessages · {recipient ? recipient.name : "loading…"}
      </div>

      <div className="mt-[14px] flex gap-[10px]">
        <select
          value={channel}
          onChange={(event) => {
            setChannel(event.target.value as Channel);
          }}
          disabled={pending !== null}
          className="rounded-none border border-dc-border-neutral bg-dc-surface px-2 py-[6px] text-[13px] text-dc-navy"
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <textarea
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
          }}
          disabled={pending !== null}
          placeholder="Write a message…"
          rows={2}
          className="flex-1 rounded-none border-2 border-dc-border-neutral bg-dc-surface px-3 py-2 text-[14px] focus:border-dc-orange focus:outline-none"
        />
      </div>

      <div className="mt-[12px] flex items-center gap-[10px]">
        <button
          type="button"
          onClick={send}
          disabled={pending !== null || !recipient || body.trim().length === 0}
          className={cn(
            "hd-cond rounded-none px-4 py-[10px] text-[13px] text-white transition-colors",
            "bg-dc-orange hover:bg-dc-orange-hover disabled:opacity-40",
          )}
        >
          Send
        </button>
        {pending && (
          <span className="inline-flex items-center gap-[8px] rounded-none border border-dc-warning-border bg-dc-warning-bg px-3 py-2 font-mono text-[11.5px] text-dc-warning-fg">
            Sending in {UNDO_WINDOW_MS / 1000}s…
            <button
              type="button"
              onClick={undo}
              className="hd-cond underline underline-offset-2"
            >
              Undo
            </button>
          </span>
        )}
      </div>

      {toast && (
        <div className="mt-[14px] rounded-none border border-dc-success-border bg-dc-success-bg px-3 py-2 font-mono text-[11.5px] text-dc-success-fg">
          {toast}
        </div>
      )}
    </div>
  );
}
