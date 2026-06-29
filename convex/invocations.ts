import { query, action } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    after: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.after !== undefined) {
      return await ctx.db
        .query("agentInvocations")
        .filter((q) => q.gte(q.field("_creationTime"), args.after!))
        .order("desc")
        .take(args.limit ?? 1000);
    }
    return await ctx.db
      .query("agentInvocations")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const listRecentPaginated = query({
  args: {
    paginationOpts: v.object({
      cursor: v.union(v.string(), v.null()),
      numItems: v.number(),
    }),
    after: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("agentInvocations")
      .order("desc")
      .paginate(args.paginationOpts);

    if (args.after !== undefined) {
      return {
        ...results,
        page: results.page.filter((inv) => inv._creationTime >= args.after!),
      };
    }
    return results;
  },
});

export const listByGroup = query({
  args: {
    groupFolder: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("succeeded"),
        v.literal("failed"),
      ),
    ),
    limit: v.optional(v.number()),
    after: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("agentInvocations")
      .withIndex("by_groupFolder_status", (q) =>
        q.eq("groupFolder", args.groupFolder),
      )
      .order("desc");

    const rows = await q.take(args.limit ?? 50);
    return rows.filter(
      (inv) =>
        (!args.status || inv.status === args.status) &&
        (args.after === undefined || inv._creationTime >= args.after),
    );
  },
});

export const getById = query({
  args: { id: v.id("agentInvocations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getAggregateStats = query({
  args: {
    after: v.optional(v.number()),
    groupFolder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let rows;
    if (args.groupFolder) {
      rows = await ctx.db
        .query("agentInvocations")
        .withIndex("by_groupFolder_status", (q) =>
          q.eq("groupFolder", args.groupFolder!),
        )
        .collect();
    } else {
      rows = await ctx.db.query("agentInvocations").collect();
    }

    const filtered =
      args.after !== undefined
        ? rows.filter((r) => r._creationTime >= args.after!)
        : rows;

    const finished = filtered.filter(
      (r) => r.status === "succeeded" || r.status === "failed",
    );
    const succeeded = filtered.filter((r) => r.status === "succeeded");
    const active = filtered.filter(
      (r) => r.status === "pending" || r.status === "running",
    );

    const durations = finished
      .filter((r) => r.startedAt && r.finishedAt)
      .map((r) => r.finishedAt! - r.startedAt!);

    return {
      total: filtered.length,
      active: active.length,
      succeeded: succeeded.length,
      finishedCount: finished.length,
      avgDuration:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
    };
  },
});
