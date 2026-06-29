import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const WEB_JID_SUFFIX = "@web";

export const listWebUserTurns = query({
  args: {
    after: v.optional(v.number()),
    groupFolder: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const turns: Array<{
      _id: string;
      _creationTime: number;
      msgId?: string;
      chatJid: string;
      groupFolder: string;
      groupId?: string;
      personId?: string;
      laneKey?: string;
      sender: string;
      senderName: string;
      content: string;
      timestamp: number;
      replyMsgId?: string;
      replyContent?: string;
      replySourceKind?: "smart_reply" | "agent";
      replyInvocationId?: string;
    }> = [];

    const folderByGroupId = new Map<string, string | undefined>();
    const getFolder = async (groupId: Id<"registeredGroups"> | undefined) => {
      if (!groupId) return undefined;
      const key = String(groupId);
      if (folderByGroupId.has(key)) return folderByGroupId.get(key);
      const group = await ctx.db.get(groupId);
      folderByGroupId.set(key, group?.folder);
      return group?.folder;
    };

    for await (const msg of ctx.db.query("messages").order("desc")) {
      if (args.after !== undefined && msg._creationTime < args.after) break;
      if (msg.isFromMe) continue;
      if (!msg.chatJid.endsWith(WEB_JID_SUFFIX)) continue;

      const folder = await getFolder(msg.groupId);
      if (args.groupFolder && folder !== args.groupFolder) continue;
      if (!folder) continue;

      const userMsgId = msg.msgId ?? String(msg._id);
      const candidates = await ctx.db
        .query("messages")
        .withIndex("by_chatJid_and_timestamp", (q) =>
          q.eq("chatJid", msg.chatJid).gte("timestamp", msg.timestamp),
        )
        .take(8);

      let reply = candidates.find(
        (c) => c.isFromMe && (c.replyToMsgId === userMsgId || c.agentResultRootMsgId === userMsgId),
      );
      if (!reply) reply = candidates.find((c) => c.isFromMe);

      turns.push({
        _id: String(msg._id),
        _creationTime: msg._creationTime,
        ...(msg.msgId ? { msgId: msg.msgId } : {}),
        chatJid: msg.chatJid,
        groupFolder: folder,
        ...(msg.groupId ? { groupId: String(msg.groupId) } : {}),
        ...(msg.personId ? { personId: String(msg.personId) } : {}),
        ...(msg.laneKey ? { laneKey: msg.laneKey } : {}),
        sender: msg.sender,
        senderName: msg.senderName,
        content: msg.content,
        timestamp: msg.timestamp,
        ...(reply?.msgId ? { replyMsgId: reply.msgId } : {}),
        ...(reply?.content ? { replyContent: reply.content } : {}),
        ...(reply?.agentResultSourceKind
          ? { replySourceKind: reply.agentResultSourceKind }
          : {}),
        ...(reply?.agentResultInvocationId
          ? { replyInvocationId: String(reply.agentResultInvocationId) }
          : {}),
      });

      if (turns.length >= limit) break;
    }

    return turns;
  },
});

export const dailyUniqueUsers = query({
  args: {
    days: v.optional(v.number()),
    groupFolder: v.optional(v.string()),
    lane: v.optional(
      v.union(
        v.literal("web"),
        v.literal("whatsapp"),
        v.literal("imessage"),
        v.literal("sms"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const days = Math.max(1, Math.min(args.days ?? 30, 90));
    const now = Date.now();
    const cutoff = now - days * 86_400_000;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .collect();

    const byDay = new Map<string, Set<string>>();

    for (const msg of messages) {
      if (msg.isFromMe) continue;

      if (lane) {
        const msgLane = msg.laneKey ?? inferLane(msg.chatJid);
        if (msgLane !== args.lane) continue;
      }

      const dayKey = new Date(msg.timestamp).toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) byDay.set(dayKey, new Set());
      byDay.get(dayKey)!.add(String(msg.personId));
    }

    const results: Array<{ day: string; uniqueUsers: number }> = [];
    for (let d = days - 1; d >= 0; d -= 1) {
      const day = new Date(now - d * 86_400_000).toISOString().slice(0, 10);
      results.push({ day, uniqueUsers: byDay.get(day)?.size ?? 0 });
    }

    return results;
  },
});

function inferLane(chatJid: string): string {
  if (chatJid.endsWith("@web")) return "web";
  if (chatJid.endsWith("@s.whatsapp.net") || chatJid.endsWith("@g.us"))
    return "whatsapp";
  if (chatJid.endsWith("@imsg")) return "imessage";
  if (chatJid.endsWith("@sms")) return "sms";
  return "other";
}
