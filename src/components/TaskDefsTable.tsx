// 18 · Task list - the read-only companion view for the pause/resume flow.
// Purely presentational: it takes already-shaped `TaskRow[]` (see
// `lib/taskDefs.ts`'s `toTaskRows`), same split as `AgentRunsTable`. Read-only
// by design: this is the "what tasks exist" surface, NOT the Task Control card
// (design 07), which owns the pause/resume controls - so no action buttons here.

import { cn } from "@/lib/utils";
import type { TaskRow, TaskStatus } from "@/lib/taskDefs";

// The lifecycle color map (a small presentational token table, like
// ToolCallStatus's PALETTE): active reads as healthy, paused as a warning,
// cancelled as inert. Task status is its own three-state enum, distinct from
// the tool-call chip's four states, so it does not reuse StatusChip.
const STATUS_CHIP: Record<TaskStatus, string> = {
  active: "text-dc-success-fg bg-dc-success-bg",
  paused: "text-dc-warning-fg bg-dc-warning-bg",
  cancelled: "text-dc-faint bg-dc-queued-bg",
};

export function TaskDefsTable({ rows }: { rows: TaskRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="border-2 border-dc-border-neutral bg-dc-surface p-4 text-[13px] text-dc-muted">
        No scheduled tasks.
      </p>
    );
  }

  return (
    <div
      data-testid="task-defs-table"
      className="overflow-hidden border-2 border-dc-border-neutral bg-dc-surface"
    >
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="hd-cond border-b-2 border-dc-navy text-[11px] text-dc-muted">
            <th className="px-3 py-2">Task</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Schedule</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-dc-border-hairline align-top last:border-b-0"
            >
              <td className="px-3 py-2 text-dc-navy">
                <div className="font-semibold">{row.name}</div>
                <div className="text-dc-muted">{row.query}</div>
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "hd-cond inline-flex items-center px-[10px] py-[5px] text-[11px]",
                    STATUS_CHIP[row.status],
                  )}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-dc-muted">
                {row.schedule}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
