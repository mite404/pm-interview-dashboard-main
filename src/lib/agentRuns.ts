// 06 · Agent Runs table - the pure calc feeding the table render. Shapes raw
// `listRecent` docs into flat row view-models so the component stays dumb (same
// split as `toStatusBars`/`toTokenUsageSegments`): the status->chip mapping, the
// deterministic UTC timestamp, and the failed-only error pick all happen here,
// unit-tested without a DOM.

import { invocationStatusToChipStatus } from "./toolCallStatus";
import type { ChipStatus } from "./toolCallStatus";
import type { InvocationsList } from "./types";

export interface AgentRunRow {
  id: string;
  status: ChipStatus;
  /** The admin's prompt that kicked off the run. */
  prompt: string;
  /** The group/channel folder the run belongs to. */
  group: string;
  /** Creation time as `YYYY-MM-DD HH:mm` in UTC - deterministic, so the row test is timezone-stable. */
  when: string;
  /**
   * The raw failure text, present only on failed rows (the design's "failed
   * rows expand to the raw error"). Falls back to the result's user-facing
   * message when the structured `error` field is absent.
   */
  error?: string;
}

/**
 * Shapes a raw `listRecent` return into the table's rows.
 * @param rows - the typed Convex query return (`InvocationsList`, newest first)
 */
export function toAgentRunRows(rows: InvocationsList): AgentRunRow[] {
  return rows.map((run) => ({
    id: run._id,
    status: invocationStatusToChipStatus(run.status),
    prompt: run.prompt,
    group: run.groupFolder,
    when: new Date(run._creationTime)
      .toISOString()
      .slice(0, 16)
      .replace("T", " "),
    error:
      run.status === "failed"
        ? (run.error ?? run.result?.userMessage)
        : undefined,
  }));
}
