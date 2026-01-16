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

export const getUserById = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.userId);
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

/**
 * Mutation to update user profile fields (height, weight, experience, equipment, injuries, preferences)
 * These fields are user-confirmed and change rarely. Must NOT be written by AI.
 */
export const updateProfile = mutation({
    args: {
        userId: v.id("users"),
        height_cm: v.optional(v.number()),
        weight_kg: v.optional(v.number()),
        experience_level: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
        equipment_access: v.optional(v.any()),
        injury_constraints: v.optional(v.array(v.string())),
        preferences: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        // Build update object with only provided fields
        const updates: Record<string, any> = {};
        if (args.height_cm !== undefined) updates.height_cm = args.height_cm;
        if (args.weight_kg !== undefined) updates.weight_kg = args.weight_kg;
        if (args.experience_level !== undefined) updates.experience_level = args.experience_level;
        if (args.equipment_access !== undefined) updates.equipment_access = args.equipment_access;
        if (args.injury_constraints !== undefined) updates.injury_constraints = args.injury_constraints;
        if (args.preferences !== undefined) updates.preferences = args.preferences;

        await ctx.db.patch(args.userId, updates);
        return args.userId;
    },
});