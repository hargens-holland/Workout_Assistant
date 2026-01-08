import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
            .withIndex("byClerkID", (q) => q.eq("clerkID", args.clerkID))
            .first();

        if (existingUser) return existingUser._id;

        return await ctx.db.insert("users", args);
    },
});

export const getUserByClerkID = query({
    args: {
        clerkID: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("byClerkID", (q) => q.eq("clerkID", args.clerkID))
            .first();
    },
});