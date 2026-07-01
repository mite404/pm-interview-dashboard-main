// Pure mapping (data in -> data out) from the domain `ToolStatus` (Phase 1's
// calling/done/error, driven by the loop's actual lifecycle - see types.ts)
// to the four visual states the tool-call-status chip (02) renders. `queued`
// has no domain equivalent yet: nothing in the loop enqueues a tool before
// calling it, so it stays a chip-only state for now, used directly by future
// callers (e.g. the agent-runs table's pre-start rows) rather than derived
// here. A `switch` over the discriminated union (not an object lookup) so a
// future `ToolStatus` phase fails to compile here instead of silently falling
// through.

import type { ToolStatus } from "./types";

export type ChipStatus = "queued" | "running" | "success" | "failed";

/**
 * Maps a domain `ToolStatus` (calling/done/error) to the chip's display state.
 * @returns "running" for `calling`, "success" for `done`, "failed" for `error`.
 */
export function toChipStatus(status: ToolStatus): ChipStatus {
  switch (status.phase) {
    case "calling":
      return "running";
    case "done":
      return "success";
    case "error":
      return "failed";
  }
}
