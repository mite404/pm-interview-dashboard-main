# PlanMonster Admin Dashboard — Interview Project

A conversational (chat-based) admin dashboard built on a Convex backend. You
are building the **frontend** — a chat interface through which an admin can
query user chat history, view visualizations, and explore platform data.

The Convex backend is already deployed, seeded with synthetic data, and its
source code is in the `convex/` directory of this repo. Your job is to build
a conversational UI that calls these functions.

## What's in this repo

```
convex/
  schema.ts                   Database schema (tables, fields, indexes)
  groups.ts                   Group/user queries + admin mutations
  invocations.ts              Agent invocation queries + aggregate stats
  messages.ts                 Chat message queries + reply lineage
  dashboard.ts                Web-turn analytics + daily active users
  invocationEvents.ts         Per-invocation event traces + token metrics
  overnightBriefRuns.ts       Go Deep cost rollups + per-run usage
  intelligenceTaskDefs.ts     Scheduled task definitions + lifecycle mutations
  adminDirectMessages.ts      Admin DM queue (list, enqueue)
  alerts.ts                   Go Deep brief delivery alerts
  monsterCitations.ts         Marketing citation match cache
  _generated/                 Auto-generated typed API (from codegen)
README.md                     This file
BRIEF.md                      Product brief and acceptance criteria
API.md                        Full function contract reference
.env.example                  Environment variables
```

## The backend

A Convex deployment is running at:

```
https://utmost-poodle-412.convex.cloud
```

It is seeded with synthetic data: 5 persons, 5 registered groups/chats across
web/WhatsApp/SMS/iMessage, ~22 messages with reply chains, ~31 agent
invocations (parent/child/composer), invocation events with token usage, 3 Go
Deep brief runs, 2 intelligence task definitions, admin DMs, and marketing
citations. No real customer data.

### Generating typed API bindings

The `convex/_generated/` directory is already checked in, but if you modify
backend functions you can regenerate types:

```bash
npx convex codegen
```

This produces `convex/_generated/api.d.ts` — a fully typed `api` object. You
import it in your frontend as:

```ts
import { api } from "../convex/_generated/api";
```

This gives you autocomplete and type checking on every function call. **Do not
use `anyApi`** — the typed `api` is the Convex best practice and is already
generated for you.

## Wiring up a frontend

### Option A: React + Vite (recommended)

```bash
npm create convex@latest my-dashboard -- -t react-vite-shadcn
```

Then replace the generated `convex/` directory with the one from this repo,
and point the app at the preview deployment.

### Option B: Add Convex to an existing React app

1. Install the Convex client:

```bash
npm install convex
```

2. Set the deployment URL in `.env.local`:

```
VITE_CONVEX_URL=https://utmost-poodle-412.convex.cloud
```

3. Wrap your app with `ConvexProvider` at the root:

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";

// Create the client ONCE at module scope, not inside a component.
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
```

4. Use `useQuery` and `useMutation` with the typed `api`:

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function Groups() {
  // Fully typed — args and return type are inferred from the Convex function.
  const groups = useQuery(api.groups.getAll, {});
  const deletePerson = useMutation(api.groups.deleteSignedUpUserForAdmin);

  if (!groups) return <div>Loading...</div>;

  return (
    <ul>
      {groups.map((g) => (
        <li key={g._id}>{g.name} — {g.jid}</li>
      ))}
    </ul>
  );
}
```

### Calling functions without React (server-side, scripts, or non-React UIs)

```ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient("https://utmost-poodle-412.convex.cloud");

// Typed query — args and return are inferred.
const groups = await client.query(api.groups.getAll, {});
const stats = await client.query(api.invocations.getAggregateStats, {
  after: Date.now() - 30 * 86400000,
});

// Typed mutation.
await client.mutation(api.intelligenceTaskDefs.pause, { taskDefId: "..." });

// Actions (functions that can page internally or have side effects) use .action().
const usage = await client.action(api.invocationEvents.getAggregateTokenUsage, {
  after: Date.now() - 30 * 86400000,
});
```

### Three functions are actions (not queries)

These must be called with `.action()` / `useAction()`, not `.query()` /
`useQuery()`, because they page internally:

| Function | Dot-path |
|---|---|
| Batch metrics | `api.invocationEvents.getMetricsBatch` |
| Aggregate token usage | `api.invocationEvents.getAggregateTokenUsage` |
| Invocation lineage | (not included in this trimmed backend) |

Everything else is a `query` or `mutation`.

## Conversational interface

The dashboard should be a **chat interface** where an admin types natural
language and gets back data, visualizations, and insights. Wire an LLM with
tool-calling that translates natural language into Convex function calls.

Suggested approach:
1. Define LLM tools that map 1:1 to `api.*` functions.
2. The LLM picks which tool to call based on the admin's request.
3. Execute the tool (call the Convex function), return the result to the LLM.
4. The LLM synthesizes a natural language response, potentially with inline
   visualizations.

See `BRIEF.md` for the full product brief and acceptance criteria.

## Development

```bash
npm install              # Install convex dependency
npx convex codegen       # Regenerate typed API (already checked in)
npm run dev              # Your frontend dev server (you set this up)
```

## Verification

You can verify the backend is reachable with a quick script:

```ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexHttpClient("https://utmost-poodle-412.convex.cloud");
const groups = await client.query(api.groups.getAll, {});
console.log(`${groups.length} groups found`);
```

## Time budget

This is a take-home exercise. Aim for 1-2 days of focused work. See `BRIEF.md`
for what's in-scope and what to skip.
