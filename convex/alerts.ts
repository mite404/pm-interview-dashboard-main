import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const listRecentGoDeepBriefs = query({
  args: {
    taskDefId: v.optional(v.id("intelligenceTaskDefs")),
    after: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const alerts = args.after
      ? await ctx.db
          .query("systemAlerts")
          .withIndex("by_createdAt", (q) => q.gte("createdAt", args.after!))
          .order("desc")
          .take(500)
      : await ctx.db.query("systemAlerts").order("desc").take(50);

    const rows = [];
    for (const alert of alerts) {
      const isDelivery = alert.alertType.startsWith("go_deep_brief:");
      const isLog = alert.alertType.startsWith("go_deep_brief_log:");
      if (!isDelivery && !isLog) continue;

      let metadata: Record<string, unknown> | null = null;
      if (alert.metadata) {
        try {
          const parsed = JSON.parse(alert.metadata);
          if (parsed && typeof parsed === "object")
            metadata = parsed as Record<string, unknown>;
        } catch {
          // ignore parse errors
        }
      }

      rows.push({
        id: String(alert._id),
        createdAt: alert.createdAt,
        status: alert.status,
        recipientJid: alert.recipientJid,
        alertType: alert.alertType,
        message: alert.message,
        briefRunId: (metadata?.briefRunId as string) ?? null,
        taskDefId: (metadata?.taskDefId as string) ?? null,
      });
    }

    return rows;
  },
});

export const getAdminDeliveryPhone = query({
  args: {},
  handler: async (ctx) => {
    return { phone: null, options: [] };
  },
});

export const setAdminDeliveryPhone = mutation({
  args: { phone: v.string() },
  handler: async (_ctx, _args) => {
    throw new Error("Not configured on preview deployment");
  },
});
