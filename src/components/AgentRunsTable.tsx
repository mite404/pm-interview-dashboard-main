// 06 · Agent Runs table - the run-health surface. Purely presentational: it
// takes already-shaped `AgentRunRow[]` (see `lib/agentRuns.ts`'s
// `toAgentRunRows`, the transform off the real `listRecent` return), same split
// as the other renders. Reuses the 02 `StatusChip` per row so the table speaks
// the exact same four-state visual vocabulary as the chat's tool pill. Failed
// rows carry a native `<details>` disclosure to the raw error (zero-JS expand),
// per the design's "failed rows expand to the raw error".

import type { AgentRunRow } from "@/lib/agentRuns";
import { StatusChip } from "./ToolCallStatus";

export function AgentRunsTable({ rows }: { rows: AgentRunRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="border-2 border-dc-border-neutral bg-dc-surface p-4 text-[13px] text-dc-muted">
        No agent runs match.
      </p>
    );
  }

  return (
    <div
      data-testid="agent-runs-table"
      className="overflow-hidden border-2 border-dc-border-neutral bg-dc-surface"
    >
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="hd-cond border-b-2 border-dc-navy text-[11px] text-dc-muted">
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Prompt</th>
            <th className="px-3 py-2">Group</th>
            <th className="px-3 py-2 text-right">When (UTC)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-dc-border-hairline align-top last:border-b-0"
            >
              <td className="px-3 py-2">
                <StatusChip status={row.status} />
              </td>
              <td className="px-3 py-2 text-dc-navy">
                <div>{row.prompt}</div>
                {row.error !== undefined && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[12px] text-dc-error-fg">
                      View error
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-[12px] text-dc-error-fg">
                      {row.error}
                    </pre>
                  </details>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-dc-muted">{row.group}</td>
              <td className="px-3 py-2 text-right font-mono text-dc-muted">
                {row.when}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
