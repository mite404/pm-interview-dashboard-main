import { query, action } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const getReadableByInvocation = query({
  args: { invocationId: v.id("agentInvocations") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("invocationEvents")
      .withIndex("by_invocationId_seq", (q) =>
        q.eq("invocationId", args.invocationId),
      )
      .order("asc")
      .collect();

    return events.map((e) => ({
      invocationId: String(e.invocationId),
      groupFolder: e.groupFolder,
      chatJid: e.chatJid,
      seq: e.seq,
      type: e.type,
      subtype: e.subtype,
      summary: e.summary,
      turnIndex: e.turnIndex,
      tokens: {
        inputTokens: e.inputTokens ?? 0,
        outputTokens: e.outputTokens ?? 0,
        totalTokens: e.totalTokens ?? 0,
        cacheCreationInputTokens: e.cacheCreationInputTokens ?? 0,
        cacheReadInputTokens: e.cacheReadInputTokens ?? 0,
      },
      createdAt: e.createdAt,
    }));
  },
});

export const getMetricsByInvocation = query({
  args: { invocationId: v.id("agentInvocations") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("invocationEvents")
      .withIndex("by_invocationId_seq", (q) =>
        q.eq("invocationId", args.invocationId),
      )
      .collect();

    const usage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    const typeCounts: Record<string, number> = {};

    for (const e of events) {
      usage.inputTokens += e.inputTokens ?? 0;
      usage.outputTokens += e.outputTokens ?? 0;
      usage.totalTokens += e.totalTokens ?? 0;
      usage.cacheCreationInputTokens += e.cacheCreationInputTokens ?? 0;
      usage.cacheReadInputTokens += e.cacheReadInputTokens ?? 0;
      typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
    }

    return {
      invocationId: String(args.invocationId),
      eventCount: events.length,
      turnCount: new Set(events.map((e) => e.turnIndex).filter((t) => t !== undefined)).size,
      tokenUsage: usage,
      typeCounts,
      firstEventAt: events[0]?.createdAt,
      lastEventAt: events[events.length - 1]?.createdAt,
    };
  },
});

export const getMetricsBatch = action({
  args: { invocationIds: v.array(v.id("agentInvocations")) },
  handler: async (ctx, args) => {
    const results = [];
    for (const invocationId of args.invocationIds) {
      const events = await ctx.db
        .query("invocationEvents")
        .withIndex("by_invocationId_seq", (q) => q.eq("invocationId", invocationId))
        .collect();

      if (events.length === 0) continue;

      const usage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      const typeCounts: Record<string, number> = {};

      for (const e of events) {
        usage.inputTokens += e.inputTokens ?? 0;
        usage.outputTokens += e.outputTokens ?? 0;
        usage.totalTokens += e.totalTokens ?? 0;
        usage.cacheCreationInputTokens += e.cacheCreationInputTokens ?? 0;
        usage.cacheReadInputTokens += e.cacheReadInputTokens ?? 0;
        typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
      }

      results.push({
        invocationId: String(invocationId),
        eventCount: events.length,
        turnCount: new Set(events.map((e) => e.turnIndex).filter((t) => t !== undefined)).size,
        tokenUsage: usage,
        typeCounts,
        firstEventAt: events[0]?.createdAt,
        lastEventAt: events[events.length - 1]?.createdAt,
      });
    }
    return results;
  },
});

export const getAggregateTokenUsage = action({
  args: {
    after: v.number(),
    groupFolder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const usage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    for await (const e of ctx.db
      .query("invocationEvents")
      .withIndex("by_groupFolder_createdAt", (q) =>
        q.gte("createdAt", args.after),
      )) {
      if (args.groupFolder && e.groupFolder !== args.groupFolder) continue;
      usage.inputTokens += e.inputTokens ?? 0;
      usage.outputTokens += e.outputTokens ?? 0;
      usage.totalTokens += e.totalTokens ?? 0;
      usage.cacheCreationInputTokens += e.cacheCreationInputTokens ?? 0;
      usage.cacheReadInputTokens += e.cacheReadInputTokens ?? 0;
    }

    return usage;
  },
});
