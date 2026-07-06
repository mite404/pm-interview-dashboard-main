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
    const maxMessages = args.maxMessages ?? 8;                // hop at most 8 parents
    const maxChars = args.maxChars ?? 4000;                   // cap total characters
    const lineage: Array<{
      msgId?: string;
      content: string;
      role: "assistant" | "user";
      timestamp: number;
    }> = [];

    let currentMsgId: string | undefined = args.replyToMsgId; // start at the parent we're replying to
    let totalChars = 0;

    for (let i = 0; i < maxMessages && currentMsgId; i += 1) {
      const msg = await ctx.db
        .query("messages")
        .withIndex("by_msgId_and_chatJid", (q) =>            // the point read: exact (msgId, chatJid) lookup
          q.eq("msgId", currentMsgId!).eq("chatJid", args.chatJid),
        )
        .first();

      if (!msg) break;                                      // dangling pointer -> stop

      const content =
        totalChars + msg.content.length > maxChars          // would this message overflow the char budget?
          ? msg.content.slice(0, Math.max(0, maxChars - totalChars))  // yes -> keep only what fits
          : msg.content;                                    // no  -> keep it whole

      lineage.unshift({
        msgId: msg.msgId,
        content,
        role: msg.isFromMe ? "assistant" : "user",         // "me" = Monty = assistant
        timestamp: msg.timestamp,
      });

      totalChars += content.length;
      if (totalChars >= maxChars) break;                  // char budget exhausted -> stop
      currentMsgId = msg.replyToMsgId;                    // hop to the parent; undefined at a thread root ends the loop
    }

    return lineage;
  },
});
