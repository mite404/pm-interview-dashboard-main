import { query } from "./_generated/server";
import { v } from "convex/values";

export const listByChatJid = query({
  args: {
    chatJid: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 200);
    return await ctx.db
      .query("messages")
      .withIndex("by_chatJid_and_timestamp", (q) =>
        q.eq("chatJid", args.chatJid),
      )
      .order("asc")
      .take(limit);
  },
});

export const getByMsgId = query({
  args: { msgId: v.string(), chatJid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_msgId_and_chatJid", (q) =>
        q.eq("msgId", args.msgId).eq("chatJid", args.chatJid),
      )
      .first();
  },
});

export const getReplyLineage = query({
  args: {
    chatJid: v.string(),
    replyToMsgId: v.string(),
    maxMessages: v.optional(v.number()),
    maxChars: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxMessages = args.maxMessages ?? 8;
    const maxChars = args.maxChars ?? 4000;
    const lineage: Array<{
      msgId?: string;
      content: string;
      role: "assistant" | "user";
      timestamp: number;
    }> = [];

    let currentMsgId: string | undefined = args.replyToMsgId;
    let totalChars = 0;

    for (let i = 0; i < maxMessages && currentMsgId; i += 1) {
      const msg = await ctx.db
        .query("messages")
        .withIndex("by_msgId_and_chatJid", (q) =>
          q.eq("msgId", currentMsgId!).eq("chatJid", args.chatJid),
        )
        .first();

      if (!msg) break;

      const content =
        totalChars + msg.content.length > maxChars
          ? msg.content.slice(0, Math.max(0, maxChars - totalChars))
          : msg.content;

      lineage.unshift({
        msgId: msg.msgId,
        content,
        role: msg.isFromMe ? "assistant" : "user",
        timestamp: msg.timestamp,
      });

      totalChars += content.length;
      if (totalChars >= maxChars) break;
      currentMsgId = msg.replyToMsgId;
    }

    return lineage;
  },
});
