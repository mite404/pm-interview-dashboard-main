// The undo-send window (PR 3): a send is not fired immediately - it is deferred
// by a grace period during which an "undo" pill can cancel it. This is the whole
// mechanism, a pure wrapper over `setTimeout`, so it is testable with fake
// timers and reused by any surface that wants a cancellable send (the direct-
// message composer here; enqueue is inert on the preview, so the deferral is the
// showcase). The React composer owns the pill + pending state; this owns only
// the timer.

/** How long (ms) a send waits before firing, cancellable via `undo`. */
export const UNDO_WINDOW_MS = 5000;

// ponytail: one pending send at a time - a plain timer, no queue. A composer
// only exposes one undo pill, so there is never more than one in flight.
export interface PendingSend {
  /** Cancel the deferred action if still within the window (idempotent). */
  undo: () => void;
}

/**
 * Defers `action` by `delayMs`, returning a handle to cancel it.
 *
 * The action fires exactly once when the window elapses, and never if `undo` is
 * called first. `undo` is safe to call more than once and safe to call after the
 * action has already fired (a no-op) - `clearTimeout` on a stale id is harmless.
 *
 * @param action - the send to run when the window elapses (e.g. the Convex call)
 * @param delayMs - the grace period in ms (default {@link UNDO_WINDOW_MS})
 * @returns a {@link PendingSend} whose `undo` cancels the pending action
 */
export function scheduleWithUndo(
  action: () => void,
  delayMs: number = UNDO_WINDOW_MS,
): PendingSend {
  const id = setTimeout(action, delayMs);
  return {
    undo: () => {
      clearTimeout(id);
    },
  };
}
