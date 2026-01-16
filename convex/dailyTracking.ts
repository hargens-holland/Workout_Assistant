import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Query to get daily tracking for a specific date
 */
export const getDailyTracking = query({
    args: {
        userId: v.id("users"),
        date: v.string(),
    },
    handler: async (ctx, args) => {
        const tracking = await ctx.db
            .query("daily_tracking")
            .withIndex("by_user_and_date", (q) =>
                q.eq("userId", args.userId).eq("date", args.date)
            )
            .first();

        return tracking || {
            waterIntake: 0,
            steps: 0,
        };
    },
});

/**
 * Query to get daily tracking for a date range
 */
export const getDailyTrackingByDateRange = query({
    args: {
        userId: v.id("users"),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args) => {
        const tracking = await ctx.db
            .query("daily_tracking")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) =>
                q.and(
                    q.gte(q.field("date"), args.startDate),
                    q.lte(q.field("date"), args.endDate)
                )
            )
            .collect();

        return tracking;
    },
});

/**
 * Mutation to update daily tracking (water and/or steps)
 */
export const updateDailyTracking = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        waterIntake: v.optional(v.number()),
        steps: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("daily_tracking")
            .withIndex("by_user_and_date", (q) =>
                q.eq("userId", args.userId).eq("date", args.date)
            )
            .first();

        if (existing) {
            // Update existing record
            return await ctx.db.patch(existing._id, {
                waterIntake: args.waterIntake !== undefined ? args.waterIntake : existing.waterIntake,
                steps: args.steps !== undefined ? args.steps : existing.steps,
            });
        } else {
            // Create new record
            return await ctx.db.insert("daily_tracking", {
                userId: args.userId,
                date: args.date,
                waterIntake: args.waterIntake || 0,
                steps: args.steps || 0,
            });
        }
    },
});

/**
 * Mutation to add water intake (incremental)
 */
export const addWaterIntake = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        amount: v.number(), // liters to add
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("daily_tracking")
            .withIndex("by_user_and_date", (q) =>
                q.eq("userId", args.userId).eq("date", args.date)
            )
            .first();

        if (existing) {
            return await ctx.db.patch(existing._id, {
                waterIntake: existing.waterIntake + args.amount,
            });
        } else {
            return await ctx.db.insert("daily_tracking", {
                userId: args.userId,
                date: args.date,
                waterIntake: args.amount,
                steps: 0,
            });
        }
    },
});

/**
 * Mutation to update steps
 */
export const updateSteps = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        steps: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("daily_tracking")
            .withIndex("by_user_and_date", (q) =>
                q.eq("userId", args.userId).eq("date", args.date)
            )
            .first();

        if (existing) {
            return await ctx.db.patch(existing._id, {
                steps: args.steps,
            });
        } else {
            return await ctx.db.insert("daily_tracking", {
                userId: args.userId,
                date: args.date,
                waterIntake: 0,
                steps: args.steps,
            });
        }
    },
});
