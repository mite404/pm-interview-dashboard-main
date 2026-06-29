/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminDirectMessages from "../adminDirectMessages.js";
import type * as alerts from "../alerts.js";
import type * as dashboard from "../dashboard.js";
import type * as groups from "../groups.js";
import type * as intelligenceTaskDefs from "../intelligenceTaskDefs.js";
import type * as invocationEvents from "../invocationEvents.js";
import type * as invocations from "../invocations.js";
import type * as messages from "../messages.js";
import type * as monsterCitations from "../monsterCitations.js";
import type * as overnightBriefRuns from "../overnightBriefRuns.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminDirectMessages: typeof adminDirectMessages;
  alerts: typeof alerts;
  dashboard: typeof dashboard;
  groups: typeof groups;
  intelligenceTaskDefs: typeof intelligenceTaskDefs;
  invocationEvents: typeof invocationEvents;
  invocations: typeof invocations;
  messages: typeof messages;
  monsterCitations: typeof monsterCitations;
  overnightBriefRuns: typeof overnightBriefRuns;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
