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
            weight_kg: undefined,
            distance_km: undefined,
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
 * Mutation to update daily tracking (water, steps, weight, and/or distance)
 */
export const updateDailyTracking = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        waterIntake: v.optional(v.number()),
        steps: v.optional(v.number()),
        weight_kg: v.optional(v.number()),
        distance_km: v.optional(v.number()),
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
            const updates: Record<string, any> = {};
            if (args.waterIntake !== undefined) updates.waterIntake = args.waterIntake;
            if (args.steps !== undefined) updates.steps = args.steps;
            if (args.weight_kg !== undefined) updates.weight_kg = args.weight_kg;
            if (args.distance_km !== undefined) updates.distance_km = args.distance_km;
            
            return await ctx.db.patch(existing._id, updates);
        } else {
            // Create new record
            return await ctx.db.insert("daily_tracking", {
                userId: args.userId,
                date: args.date,
                waterIntake: args.waterIntake || 0,
                steps: args.steps || 0,
                weight_kg: args.weight_kg,
                distance_km: args.distance_km,
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
                weight_kg: undefined,
                distance_km: undefined,
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
                weight_kg: undefined,
                distance_km: undefined,
            });
        }
    },
});

/**
 * Mutation to update weight
 */
export const updateWeight = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        weight_kg: v.number(),
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
                weight_kg: args.weight_kg,
            });
        } else {
            return await ctx.db.insert("daily_tracking", {
                userId: args.userId,
                date: args.date,
                waterIntake: 0,
                steps: 0,
                weight_kg: args.weight_kg,
                distance_km: undefined,
            });
        }
    },
});

/**
 * Mutation to update distance (for running/endurance goals)
 */
export const updateDistance = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        distance_km: v.number(),
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
                distance_km: args.distance_km,
            });
        } else {
            return await ctx.db.insert("daily_tracking", {
                userId: args.userId,
                date: args.date,
                waterIntake: 0,
                steps: 0,
                weight_kg: undefined,
                distance_km: args.distance_km,
            });
        }
    },
});
