import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("registeredGroups").collect();
  },
});

export const getByJid = query({
  args: { jid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("registeredGroups")
      .withIndex("by_jid", (q) => q.eq("jid", args.jid))
      .first();
  },
});

export const getByFolder = query({
  args: { folder: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("registeredGroups")
      .withIndex("by_folder", (q) => q.eq("folder", args.folder))
      .first();
  },
});

export const listSignedUpUsersForAdmin = query({
  args: {},
  handler: async (ctx) => {
    const peopleById = new Map<Id<"persons">, Doc<"persons">>();
    for (const status of ["google_verified", "phone_verified"] as const) {
      const people = await ctx.db
        .query("persons")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(500);
      for (const person of people) peopleById.set(person._id, person);
    }

    const rows = [];
    for (const person of peopleById.values()) {
      const token = await ctx.db
        .query("gmailTokens")
        .withIndex("by_personId_status", (q) =>
          q.eq("personId", person._id).eq("status", "active"),
        )
        .order("desc")
        .first();

      const emailAddress = person.googleEmail ?? token?.emailAddress;
      const userName =
        person.displayName ??
        person.googleEmail?.split("@")[0] ??
        person.phoneE164 ??
        "Unknown";

      rows.push({
        personId: person._id,
        userName,
        ...(person.phoneE164 ? { phoneNumber: person.phoneE164 } : {}),
        ...(emailAddress ? { emailAddress } : {}),
        gmailScopes: token?.scopes ?? [],
        ...(token?.emailAddress ? { gmailEmailAddress: token.emailAddress } : {}),
        ...(token?.connectedAt ? { gmailConnectedAt: token.connectedAt } : {}),
        createdAt: person.createdAt,
        lastSeenAt: person.lastSeenAt,
      });
    }

    return rows.sort((a, b) =>
      a.userName.toLowerCase().localeCompare(b.userName.toLowerCase()),
    );
  },
});

export const deleteSignedUpUserForAdmin = mutation({
  args: { personId: v.id("persons") },
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person) throw new Error("Unknown signed-up user");

    const groups = await ctx.db
      .query("registeredGroups")
      .withIndex("by_personId", (q) => q.eq("personId", args.personId))
      .collect();
    for (const group of groups) await ctx.db.delete(group._id);

    const tokens = await ctx.db
      .query("gmailTokens")
      .withIndex("by_personId_status", (q) => q.eq("personId", args.personId))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);

    await ctx.db.delete(args.personId);
    return { ok: true };
  },
});
