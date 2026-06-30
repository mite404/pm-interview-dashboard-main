/**
 * Backend reachability check.
 *
 * Answers one question fast: can this repo still talk to the deployed Convex
 * preview backend? Run it whenever the app cannot load data and you need to
 * know whether the fault is the connection or your own frontend code:
 *
 *   bun run check:backend
 *
 * It exercises both call types we depend on (a query and an action) and exits
 * non-zero on the first failure, so it is safe to use as a gate.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Mirrors VITE_CONVEX_URL in .env.local. Kept as a literal so this diagnostic
// has zero dependency on env loading. If the deployment URL changes, edit both.
const CONVEX_URL = "https://utmost-poodle-412.convex.cloud";

const client = new ConvexHttpClient(CONVEX_URL);

async function checkBackend(): Promise<void> {
  console.log(`Checking backend at ${CONVEX_URL}\n`);

  // 1. Query path: the simplest read on the api surface.
  const t0 = Date.now();
  const groups = await client.query(api.groups.getAll, {});
  console.log(
    `  [query]  groups.getAll              ok  ${String(groups.length)} groups  (${String(Date.now() - t0)}ms)`,
  );

  // 2. Action path: must be called with .action(), not .query().
  const t1 = Date.now();
  const usage = await client.action(
    api.invocationEvents.getAggregateTokenUsage,
    { after: 0 },
  );
  console.log(
    `  [action] getAggregateTokenUsage     ok  ${String(usage.totalTokens)} total tokens  (${String(Date.now() - t1)}ms)`,
  );
}

try {
  await checkBackend();
  console.log("\nPASS - backend reachable, all checks succeeded.");
} catch (err) {
  console.error("\nFAIL - could not reach the backend.");
  console.error(err instanceof Error ? err.message : String(err));
  // Re-throw as an Error so the process exits non-zero.
  throw err instanceof Error ? err : new Error(String(err));
}
