import { query } from "./_generated/server";
import { v } from "convex/values";

export const listMarketingMatchesPaginated = query({
  args: {
    paginationOpts: v.object({
      cursor: v.union(v.string(), v.null()),
      numItems: v.number(),
    }),
    sortBy: v.optional(
      v.union(v.literal("citationId"), v.literal("messageHitCount")),
    ),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("monsterCitationCache")
      .order("desc")
      .paginate(args.paginationOpts);

    const page = results.page.map((c) => ({
      citationId: c.citationId,
      emailQuestion: c.emailQuestion,
      recipientEmail: c.recipientEmail,
      matchCount: c.messageHitCount ?? 0,
      matched: (c.messageHitCount ?? 0) > 0,
    }));

    if (args.sortBy === "citationId") {
      page.sort((a, b) => a.citationId.localeCompare(b.citationId));
    } else {
      page.sort((a, b) => b.matchCount - a.matchCount);
    }

    return { ...results, page };
  },
});
