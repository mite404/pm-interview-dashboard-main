// Phase 1 action tier (T3): the one real Convex client the app injects into a
// tool's `run`. Constructed once at module scope (per the Convex README), never
// inside a component, so every render shares the same client.
//
// The URL is inlined from the VITE_-prefixed env at build time. Browser-direct
// in Phase 1 - in production this call would move to a Convex action with the
// key set via `npx convex env set` (noted in DESIGN.md). Tests never import
// this module; they inject a fake `{ convex }` into `run` instead.

import { ConvexHttpClient } from "convex/browser";

export const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
