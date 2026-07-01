// 07 · Task Control - the reference pattern for any action surface: a card that
// pauses/resumes a scheduled task with immediate (optimistic) feedback, then
// reconciles with the mutation result. It owns only presentation + optimistic
// UI state (`paused`, `toast`); the real Convex write is injected via `onToggle`
// so this component stays testable without a network and the shell decides how
// the write happens (through the chat loop's tools, or a direct client call).
//
// Border idiom: this is a *sheet block*, so hard edges - `border-2`, radius 0
// (`rounded-none`) - deliberately NOT the shadcn/nav 8px-radius idiom. Keep the
// two distinct (see the handoff README).

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** The task copy the card renders (name + mono schedule subline). */
export interface TaskControlTask {
  /** Display name, e.g. "Daily Project Accounting". */
  name: string;
  /** Mono subline, e.g. "intelligenceTaskDefs · runs 06:00 UTC". */
  schedule: string;
}

interface TaskControlProps {
  task: TaskControlTask;
  /** Initial status; the card tracks its own optimistic status after a toggle. */
  status: "active" | "paused";
  /**
   * Runs the real pause/resume mutation. Called optimistically - the card has
   * already flipped when this runs; if it rejects, the card reverts.
   * @param next - the status the user toggled TO ("paused" on pause, else "active")
   * @returns optionally a promise (the mutation) - the card awaits it to reconcile
   */
  onToggle: (next: "active" | "paused") => unknown;
  /** Fire the task once, now (the secondary action). */
  onRunNow: () => void;
}

// The mono success line shown after a toggle (spec 07). Keyed by the status the
// user moved to, so the copy derives from state rather than being passed in.
const TOAST: Record<"active" | "paused", string> = {
  paused: "✓ intelligenceTaskDefs.pause — task suspended",
  active: "✓ intelligenceTaskDefs.resume — task re-armed",
};

/**
 * Renders a scheduled task with an optimistic pause/resume toggle + Run Now.
 * Badge, primary-button copy/color, and toast all derive from the live status.
 */
export function TaskControl({
  task,
  status,
  onToggle,
  onRunNow,
}: TaskControlProps) {
  const [paused, setPaused] = useState(status === "paused");
  const [toast, setToast] = useState<string | null>(null);

  async function toggle() {
    const next = paused ? "active" : "paused";
    // Optimistic: flip and show the toast immediately, then reconcile.
    setPaused(!paused);
    setToast(TOAST[next]);
    try {
      // Normalize sync/async: `Promise.resolve` flattens a returned mutation
      // promise (awaiting its rejection) and no-ops a plain void return.
      await Promise.resolve(onToggle(next));
    } catch {
      // The write failed: revert to the truth and drop the premature toast.
      setPaused(paused);
      setToast(null);
    }
  }

  return (
    <div className="rounded-none border-2 border-dc-border-neutral bg-dc-surface p-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="hd-cond text-[17px] text-dc-navy">{task.name}</div>
          <div className="mt-1 font-mono text-[11.5px] text-dc-faint">
            {task.schedule}
          </div>
        </div>
        <span
          className={cn(
            "hd-cond inline-flex items-center gap-[6px] px-[10px] py-[4px] text-[11px]",
            paused
              ? "bg-dc-warning-bg text-dc-warning-fg"
              : "bg-dc-success-bg text-dc-success-fg",
          )}
        >
          {paused ? (
            <Pause className="size-[11px] fill-current stroke-none" />
          ) : (
            <span className="inline-block size-[7px] rounded-full bg-current" />
          )}
          {paused ? "Paused" : "Active"}
        </span>
      </div>

      <div className="mt-[18px] flex gap-[10px]">
        <button
          type="button"
          onClick={() => void toggle()}
          className={cn(
            "hd-cond flex-1 rounded-none px-4 py-[10px] text-[13px] text-white transition-colors",
            paused
              ? "bg-dc-orange hover:bg-dc-orange-hover"
              : "bg-dc-navy hover:bg-dc-navy-hover",
          )}
        >
          {paused ? "Resume Task" : "Pause Task"}
        </button>
        <button
          type="button"
          onClick={onRunNow}
          className="hd-cond inline-flex items-center gap-[6px] rounded-none border-2 border-dc-navy px-4 py-[10px] text-[13px] text-dc-navy transition-colors hover:bg-dc-card"
        >
          <Play className="size-[13px]" />
          Run Now
        </button>
      </div>

      {toast && (
        <div className="mt-[14px] rounded-none border border-dc-success-border bg-dc-success-bg px-3 py-2 font-mono text-[11.5px] text-dc-success-fg">
          {toast}
        </div>
      )}
    </div>
  );
}
