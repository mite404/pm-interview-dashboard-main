/**
 * Tool contract probe (commit 0).
 *
 * Calls every NON-MUTATION tool the admin dashboard wires, with the args the
 * LLM will really emit, and prints what the live deployment actually returns.
 * This printout is the real tool contract: the checked-in `convex/` source is a
 * sketch that does not match the deployment, so we trust observed behavior, not
 * the source.
 *
 *   bun run scripts/probe-tools.ts
 *
 * Read-only by construction. It never calls a mutation (pause / resume /
 * enqueue), so it is safe against the shared preview. Two call paths mirror the
 * app: `client.query()` for queries, and `client.action()` for
 * `getAggregateTokenUsage` (it pages internally, so it is an action - calling it
 * with `.query()` fails). Each probe is isolated: one tool failing does not stop
 * the rest, so you always see the full picture. Exits non-zero only on a real
 * call error (not on intentionally-empty data like the sparse daily-users seed).
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// Mirrors VITE_CONVEX_URL in .env.local (literal, zero env dependency).
const CONVEX_URL = "https://utmost-poodle-412.convex.cloud";
const ALL_TIME = 0; // `after: 0` = no lower bound, so frozen seed rows stay in range.

const client = new ConvexHttpClient(CONVEX_URL);

// ── types + state ─────────────────────────────────────────────────────
interface Outcome {
  hasData: boolean;
  detail: string;
  skipped?: boolean;
}
type State = "ok" | "skip" | "fail";
interface Result {
  label: string;
  state: State;
  detail: string;
  hasData?: boolean;
}

const results: Result[] = [];

// Resolved across probes, the way the LLM resolves a name before the real call.
let firstJid: string | undefined;
let firstMsgId: string | undefined;
let firstBriefRunId: Id<"overnightBriefRuns"> | undefined;

// ── helper ────────────────────────────────────────────────────────────
async function probe(
  label: string,
  call: "query" | "action",
  fn: () => Promise<Outcome>,
): Promise<void> {
  try {
    const { hasData, detail, skipped } = await fn();
    if (skipped) {
      results.push({ label, state: "skip", detail });
      console.log(`  [${call}]  ${label.padEnd(40)} skip   ${detail}`);
      return;
    }
    results.push({ label, state: "ok", detail, hasData });
    const flag = (hasData ? "data" : "EMPTY").padEnd(6);
    console.log(`  [${call}]  ${label.padEnd(40)} ok     ${flag} ${detail}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ label, state: "fail", detail });
    console.log(`  [${call}]  ${label.padEnd(40)} FAIL   ${detail}`);
  }
}

// ── orchestration ─────────────────────────────────────────────────────
async function probeTools(): Promise<void> {
  console.log(`Probing tool contract at ${CONVEX_URL}\n`);

  // Phase 1 anchor: dense, stable, all-time.
  await probe("invocations.getAggregateStats", "query", async () => {
    const s = await client.query(api.invocations.getAggregateStats, {});
    const failed = s.finishedCount - s.succeeded;
    return {
      hasData: s.total > 0,
      detail: `total ${String(s.total)} = succeeded ${String(s.succeeded)} / active ${String(s.active)} / failed ${String(failed)}; avg ${s.avgDuration.toFixed(1)}ms`,
    };
  });

  // Phase 2 chart tool: known-sparse against the frozen message timestamps.
  await probe("dashboard.dailyUniqueUsers", "query", async () => {
    const days = await client.query(api.dashboard.dailyUniqueUsers, {
      days: 90,
    });
    const nonzero = days.filter((d) => d.uniqueUsers > 0);
    return {
      hasData: nonzero.length > 0,
      detail: `${String(nonzero.length)}/${String(days.length)} non-zero days (sparse: frozen seed)`,
    };
  });

  await probe("invocations.listRecent", "query", async () => {
    const runs = await client.query(api.invocations.listRecent, { limit: 50 });
    const failed = runs.filter((r) => r.status === "failed").length;
    return {
      hasData: runs.length > 0,
      detail: `${String(runs.length)} runs (${String(failed)} failed)`,
    };
  });

  // Resolver (wired as listConversations): name -> jid bridge for synthesis.
  await probe("groups.getAll (listConversations)", "query", async () => {
    const groups = await client.query(api.groups.getAll, {});
    firstJid = groups[0]?.jid;
    return {
      hasData: groups.length > 0,
      detail: `${String(groups.length)} chats; e.g. ${groups[0]?.name ?? "(none)"} -> ${groups[0]?.jid ?? "(none)"}`,
    };
  });

  await probe("messages.listByChatJid", "query", async () => {
    if (!firstJid)
      return {
        hasData: false,
        detail: "no jid from groups.getAll",
        skipped: true,
      };
    const msgs = await client.query(api.messages.listByChatJid, {
      chatJid: firstJid,
      limit: 100,
    });
    firstMsgId = [...msgs].reverse().find((m) => m.msgId)?.msgId;
    return {
      hasData: msgs.length > 0,
      detail: `${String(msgs.length)} messages in ${firstJid}`,
    };
  });

  await probe("messages.getReplyLineage", "query", async () => {
    if (!firstJid || !firstMsgId)
      return {
        hasData: false,
        detail: "no msgId from listByChatJid",
        skipped: true,
      };
    const lineage = await client.query(api.messages.getReplyLineage, {
      chatJid: firstJid,
      replyToMsgId: firstMsgId,
    });
    return {
      hasData: lineage.length > 0,
      detail: `${String(lineage.length)} messages in thread from ${firstMsgId}`,
    };
  });

  await probe("intelligenceTaskDefs.listAll", "query", async () => {
    const tasks = await client.query(api.intelligenceTaskDefs.listAll, {});
    return {
      hasData: tasks.length > 0,
      detail: `${String(tasks.length)} task defs; e.g. ${tasks[0]?.name ?? "(none)"}`,
    };
  });

  await probe("overnightBriefRuns.listCostRollups", "query", async () => {
    const rows = await client.query(api.overnightBriefRuns.listCostRollups, {
      after: ALL_TIME,
    });
    firstBriefRunId = rows[0]?.briefRunId;
    return {
      hasData: rows.length > 0,
      detail: `${String(rows.length)} Go Deep runs`,
    };
  });

  await probe("overnightBriefRuns.getRunUsage", "query", async () => {
    if (!firstBriefRunId)
      return {
        hasData: false,
        detail: "no briefRunId from listCostRollups",
        skipped: true,
      };
    const usage = await client.query(api.overnightBriefRuns.getRunUsage, {
      briefRunId: firstBriefRunId,
    });
    return {
      hasData: usage.totalUsage.totalTokens > 0,
      detail: `${String(usage.totalUsage.totalTokens)} total tokens this run`,
    };
  });

  // The one action: must be .action(), not .query().
  await probe("invocationEvents.getAggregateTokenUsage", "action", async () => {
    const usage = await client.action(
      api.invocationEvents.getAggregateTokenUsage,
      {
        after: ALL_TIME,
      },
    );
    return {
      hasData: usage.totalTokens > 0,
      detail: `${String(usage.totalTokens)} total (in ${String(usage.inputTokens)} / out ${String(usage.outputTokens)})`,
    };
  });

  console.log(
    "\n  skipped (mutations / writes; proven at integration + E2E, never fired here):",
  );
  console.log(
    "    intelligenceTaskDefs.pause / resume, adminDirectMessages.enqueue",
  );
}

// ── runner ────────────────────────────────────────────────────────────
await probeTools();

const failed = results.filter((r) => r.state === "fail");
const empty = results.filter((r) => r.state === "ok" && r.hasData === false);
console.log(
  `\n${String(results.length)} probed - ${String(results.filter((r) => r.state === "ok").length)} ok, ` +
    `${String(empty.length)} empty, ${String(failed.length)} failed.`,
);

if (failed.length > 0) {
  console.error("\nFAIL - one or more tools errored (see FAIL lines above).");
  throw new Error(`${String(failed.length)} tool probe(s) failed`);
}
console.log("PASS - every non-mutation tool answered.");
