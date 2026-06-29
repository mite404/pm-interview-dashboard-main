import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listRecipients = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("registeredGroups").collect();
    return groups.map((g) => ({
      _id: g._id,
      jid: g.jid,
      name: g.name,
      folder: g.folder,
      personId: g.personId,
    }));
  },
});

export const listByTimeRange = query({
  args: {
    after: v.number(),
    groupId: v.optional(v.id("registeredGroups")),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("adminDirectMessages")
      .withIndex("by_requestedAt", (q) => q.gte("requestedAt", args.after))
      .order("desc")
      .take(500);

    return args.groupId
      ? rows.filter((r) => r.groupId === args.groupId)
      : rows;
  },
});

export const enqueue = mutation({
  args: {
    groupId: v.id("registeredGroups"),
    selectedChannel: v.union(
      v.literal("whatsapp"),
      v.literal("sms"),
      v.literal("imessage"),
    ),
    messageBody: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const wordCount = args.messageBody.trim().split(/\s+/).length;
    if (wordCount > 250) {
      throw new Error("Message exceeds 250-word limit");
    }

    return await ctx.db.insert("adminDirectMessages", {
      groupId: args.groupId,
      personId: group.personId,
      groupJid: group.jid,
      groupName: group.name,
      groupFolder: group.folder,
      selectedChannel: args.selectedChannel,
      messageBody: args.messageBody,
      messageWordCount: wordCount,
      status: "queued",
      requestedAt: Date.now(),
      source: args.source ?? "dashboard",
    });
  },
});
