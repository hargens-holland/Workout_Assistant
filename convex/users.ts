import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncUser = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        clerkId: v.string(),
        avatar: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (existingUser) return existingUser._id;

        return await ctx.db.insert("users", args);
    },
});

export const getUserByClerkId = query({
    args: {
        clerkId: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();
    },
});

export const updateUser = mutation({
    args: {
        clerkId: v.string(),
        name: v.string(),
        email: v.string(),
        avatar: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!existingUser) {
            throw new Error("User not found");
        }

        await ctx.db.patch(existingUser._id, {
            name: args.name,
            email: args.email,
            avatar: args.avatar,
        });

        return existingUser._id;
    },
});