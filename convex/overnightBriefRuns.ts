import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const listCostRollups = query({
  args: {
    after: v.number(),
    groupFolder: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cap = args.limit ?? 1000;
    const runs = await ctx.db
      .query("overnightBriefRuns")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.after))
      .order("desc")
      .take(cap);

    const zeroUsage = () => ({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });

    const rows = [];
    for (const run of runs) {
      const group = await ctx.db.get(run.groupId);
      const groupFolder = group?.folder ?? "unknown";
      if (args.groupFolder && groupFolder !== args.groupFolder) continue;

      const task = await ctx.db.get(run.taskDefId);
      const taskName = task?.name ?? "(unknown task)";

      const invocations = await ctx.db
        .query("agentInvocations")
        .withIndex("by_briefRunId", (q) => q.eq("briefRunId", run._id))
        .collect();

      const invocationCounts = { parent: 0, child: 0, retry: 0, composer: 0 };
      for (const inv of invocations) {
        if (inv.invocationRole === "parent") invocationCounts.parent += 1;
        else if (inv.invocationRole === "composer") invocationCounts.composer += 1;
        else if (inv.invocationRole === "child" && inv.retryOfInvocationId)
          invocationCounts.retry += 1;
        else if (inv.invocationRole === "child") invocationCounts.child += 1;
      }

      rows.push({
        briefRunId: run._id,
        runKey: run.runKey,
        createdAt: run.createdAt,
        groupFolder,
        taskName,
        userJid: run.userJid,
        status: run.status,
        outputArtifact: run.outputArtifact,
        parentUsage: zeroUsage(),
        childUsage: zeroUsage(),
        retryUsage: zeroUsage(),
        composerUsage: zeroUsage(),
        totalUsage: zeroUsage(),
        invocationCounts,
      });
    }

    return rows;
  },
});

export const getRunUsage = query({
  args: { briefRunId: v.id("overnightBriefRuns") },
  handler: async (ctx, args) => {
    const invocations = await ctx.db
      .query("agentInvocations")
      .withIndex("by_briefRunId", (q) => q.eq("briefRunId", args.briefRunId))
      .collect();

    const zeroUsage = () => ({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });

    const parentUsage = zeroUsage();
    const childUsage = zeroUsage();
    const retryUsage = zeroUsage();
    const composerUsage = zeroUsage();
    const totalUsage = zeroUsage();

    for (const inv of invocations) {
      const events = await ctx.db
        .query("invocationEvents")
        .withIndex("by_invocationId_seq", (q) =>
          q.eq("invocationId", inv._id),
        )
        .collect();

      const usage = zeroUsage();
      for (const e of events) {
        usage.inputTokens += e.inputTokens ?? 0;
        usage.outputTokens += e.outputTokens ?? 0;
        usage.totalTokens += e.totalTokens ?? 0;
        usage.cacheCreationInputTokens += e.cacheCreationInputTokens ?? 0;
        usage.cacheReadInputTokens += e.cacheReadInputTokens ?? 0;
      }

      const target =
        inv.invocationRole === "parent"
          ? parentUsage
          : inv.invocationRole === "composer"
            ? composerUsage
            : inv.invocationRole === "child" && inv.retryOfInvocationId
              ? retryUsage
              : childUsage;

      target.inputTokens += usage.inputTokens;
      target.outputTokens += usage.outputTokens;
      target.totalTokens += usage.totalTokens;
      target.cacheCreationInputTokens += usage.cacheCreationInputTokens;
      target.cacheReadInputTokens += usage.cacheReadInputTokens;

      totalUsage.inputTokens += usage.inputTokens;
      totalUsage.outputTokens += usage.outputTokens;
      totalUsage.totalTokens += usage.totalTokens;
      totalUsage.cacheCreationInputTokens += usage.cacheCreationInputTokens;
      totalUsage.cacheReadInputTokens += usage.cacheReadInputTokens;
    }

    return { parentUsage, childUsage, retryUsage, composerUsage, totalUsage };
  },
});
