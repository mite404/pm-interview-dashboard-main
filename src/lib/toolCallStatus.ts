// Pure mapping (data in -> data out) from the domain `ToolStatus` (Phase 1's
// calling/done/error, driven by the loop's actual lifecycle - see types.ts)
// to the four visual states the tool-call-status chip (02) renders. `queued`
// has no domain equivalent yet: nothing in the loop enqueues a tool before
// calling it, so it stays a chip-only state for now, used directly by future
// callers (e.g. the agent-runs table's pre-start rows) rather than derived
// here. A `switch` over the discriminated union (not an object lookup) so a
// future `ToolStatus` phase fails to compile here instead of silently falling
// through.

import type { InvocationStatus, ToolStatus } from "./types";

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

/**
 * Maps a backend run status onto the chip's four states so the agent-runs
 * table (06) reuses the same visual vocabulary as the chat's tool pill. Only
 * the labels differ from the enum: "pending" -> "queued", "succeeded" ->
 * "success". A `switch` over the union so a new backend status fails to compile
 * here rather than falling through to a wrong color.
 */
export function invocationStatusToChipStatus(
  status: InvocationStatus,
): ChipStatus {
  switch (status) {
    case "pending":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "success";
    case "failed":
      return "failed";
  }
}
