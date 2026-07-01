import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNDO_WINDOW_MS, scheduleWithUndo } from "./undoSend";

describe("scheduleWithUndo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the action exactly once when the window elapses", () => {
    const action = vi.fn();
    scheduleWithUndo(action);

    // Nothing fires before the window is up.
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(action).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledOnce();

    // No second firing afterwards.
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 2);
    expect(action).toHaveBeenCalledOnce();
  });

  it("never fires the action if undo is called within the window", () => {
    const action = vi.fn();
    const { undo } = scheduleWithUndo(action);

    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    undo();
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 2);

    expect(action).not.toHaveBeenCalled();
  });

  it("undo after the action fired is a harmless no-op", () => {
    const action = vi.fn();
    const { undo } = scheduleWithUndo(action);

    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(action).toHaveBeenCalledOnce();

    // Calling undo late (and twice) must not throw or double-invoke.
    expect(() => {
      undo();
      undo();
    }).not.toThrow();
    expect(action).toHaveBeenCalledOnce();
  });
});
