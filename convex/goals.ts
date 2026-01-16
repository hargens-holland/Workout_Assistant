import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Query to get all goals for a user
 */
export const getUserGoals = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("goals")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
    },
});

/**
 * Query to get the active goal for a user
 */
export const getActiveGoal = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("goals")
            .withIndex("by_user_and_active", (q) => 
                q.eq("userId", args.userId).eq("isActive", true)
            )
            .first();
    },
});

/**
 * Mutation to create a new goal
 * Sets it as active and deactivates all other goals for the user
 */
export const createGoal = mutation({
    args: {
        userId: v.id("users"),
        category: v.union(
            v.literal("body_composition"),
            v.literal("strength"),
            v.literal("endurance"),
            v.literal("mobility"),
            v.literal("skill")
        ),
        target: v.optional(v.object({
            exercise: v.optional(v.string()),
            movement: v.optional(v.string()),
            metric: v.optional(v.union(
                v.literal("weight"),
                v.literal("reps"),
                v.literal("time"),
                v.literal("distance"),
                v.literal("rom")
            )),
        })),
        direction: v.optional(v.union(
            v.literal("increase"),
            v.literal("decrease"),
            v.literal("achieve")
        )),
        value: v.optional(v.number()),
        unit: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Verify user exists
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        // Deactivate all existing goals for this user
        const allUserGoals = await ctx.db
            .query("goals")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        for (const goal of allUserGoals) {
            if (goal.isActive) {
                await ctx.db.patch(goal._id, { isActive: false });
            }
        }

        // Create new goal as active
        return await ctx.db.insert("goals", {
            userId: args.userId,
            category: args.category,
            target: args.target,
            direction: args.direction,
            value: args.value,
            unit: args.unit,
            isActive: true,
        });
    },
});

/**
 * Mutation to set a goal as active
 * Deactivates all other goals for the user
 */
export const setActiveGoal = mutation({
    args: {
        goalId: v.id("goals"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        // Verify the goal exists and belongs to the user
        const goal = await ctx.db.get(args.goalId);
        if (!goal) {
            throw new Error("Goal not found");
        }

        if (goal.userId !== args.userId) {
            throw new Error("Goal does not belong to user");
        }

        // Deactivate all goals for this user
        const allUserGoals = await ctx.db
            .query("goals")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        for (const userGoal of allUserGoals) {
            if (userGoal.isActive) {
                await ctx.db.patch(userGoal._id, { isActive: false });
            }
        }

        // Activate the selected goal
        await ctx.db.patch(args.goalId, { isActive: true });

        return { success: true };
    },
});

/**
 * Mutation to update a goal
 */
export const updateGoal = mutation({
    args: {
        goalId: v.id("goals"),
        userId: v.id("users"),
        category: v.optional(v.union(
            v.literal("body_composition"),
            v.literal("strength"),
            v.literal("endurance"),
            v.literal("mobility"),
            v.literal("skill")
        )),
        target: v.optional(v.object({
            exercise: v.optional(v.string()),
            movement: v.optional(v.string()),
            metric: v.optional(v.union(
                v.literal("weight"),
                v.literal("reps"),
                v.literal("time"),
                v.literal("distance"),
                v.literal("rom")
            )),
        })),
        direction: v.optional(v.union(
            v.literal("increase"),
            v.literal("decrease"),
            v.literal("achieve")
        )),
        value: v.optional(v.number()),
        unit: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Verify the goal exists and belongs to the user
        const goal = await ctx.db.get(args.goalId);
        if (!goal) {
            throw new Error("Goal not found");
        }

        if (goal.userId !== args.userId) {
            throw new Error("Goal does not belong to user");
        }

        // Build update object with only provided fields
        const updates: Record<string, any> = {};
        if (args.category !== undefined) updates.category = args.category;
        if (args.target !== undefined) updates.target = args.target;
        if (args.direction !== undefined) updates.direction = args.direction;
        if (args.value !== undefined) updates.value = args.value;
        if (args.unit !== undefined) updates.unit = args.unit;

        await ctx.db.patch(args.goalId, updates);

        return { success: true };
    },
});

/**
 * Mutation to delete a goal
 */
export const deleteGoal = mutation({
    args: {
        goalId: v.id("goals"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        // Verify the goal exists and belongs to the user
        const goal = await ctx.db.get(args.goalId);
        if (!goal) {
            throw new Error("Goal not found");
        }

        if (goal.userId !== args.userId) {
            throw new Error("Goal does not belong to user");
        }

        // Delete the goal
        await ctx.db.delete(args.goalId);

        return { success: true };
    },
});
