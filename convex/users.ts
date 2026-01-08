import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const syncUser = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        clerkID: v.string(),
        avatar: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existingUser = await ctx.db
            .query("users")
            .filter(q => q.eq(q.field("clerkID"), args.clerkID))
            .first();

        if (existingUser) return;

        return await ctx.db.insert("users", args);
    },


});