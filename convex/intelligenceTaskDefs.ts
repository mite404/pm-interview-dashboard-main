import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("intelligenceTaskDefs").collect();
  },
});

export const getById = query({
  args: { taskDefId: v.id("intelligenceTaskDefs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskDefId);
  },
});

export const pause = mutation({
  args: { taskDefId: v.id("intelligenceTaskDefs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskDefId, { status: "paused", updatedAt: Date.now() });
    return await ctx.db.get(args.taskDefId);
  },
});

export const resume = mutation({
  args: { taskDefId: v.id("intelligenceTaskDefs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskDefId, { status: "active", updatedAt: Date.now() });
    return await ctx.db.get(args.taskDefId);
  },
});

export const cancel = mutation({
  args: { taskDefId: v.id("intelligenceTaskDefs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskDefId, { status: "cancelled", updatedAt: Date.now() });
    return await ctx.db.get(args.taskDefId);
  },
});

export const toggleStar = mutation({
  args: { taskDefId: v.id("intelligenceTaskDefs") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskDefId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskDefId, {
      starred: !task.starred,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.taskDefId);
  },
});
