// CATEGORY: Data - schema values and the type-level assertions that pin them.
// No runtime behaviour lives here beyond constructing schema objects.

import { z } from "zod"; // → module
import type { AggregateStatsArgs } from "./types"; // → { after?: number; groupFolder?: string }

export const getAggregateStatsSchema = z.strictObject({
  groupFolder: z
    .string()
    .optional()
    .describe("Optional group folder to scope to. Omit for all groups."),
  after: z
    .number()
    .optional()
    .describe(
      "Optional unix-ms lower bound on a run's creation time. Omit for " +
        "all-time, which is the usual case.",
    ),
});

type Exact<getAggregateStatsSchema, AggregateStatsArgs> = [
  getAggregateStatsSchema,
] extends [AggregateStatsArgs]
  ? [AggregateStatsArgs] extends [getAggregateStatsSchema]
    ? true
    : never
  : never;

type Bound<TSchema extends z.ZodType, TArgs> = Exact<
  Required<z.infer<TSchema>>,
  Required<TArgs>
>;

const _aggregateStatsBound: Bound<
  typeof getAggregateStatsSchema,
  AggregateStatsArgs
> = true;
