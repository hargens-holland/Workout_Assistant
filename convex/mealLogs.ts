import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Query to get meal logs for a user by date
 */
export const getMealLogsByDate = query({
    args: {
        userId: v.id("users"),
        date: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("meal_logs")
            .withIndex("by_user_and_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
            .collect();
    },
});

/**
 * Query to get meal logs for a date range
 */
export const getMealLogsByDateRange = query({
    args: {
        userId: v.id("users"),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args) => {
        const allLogs = await ctx.db
            .query("meal_logs")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        return allLogs.filter(
            (log) => log.date >= args.startDate && log.date <= args.endDate
        );
    },
});

/**
 * Mutation to create a meal log
 */
export const createMealLog = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        name: v.string(),
        calories: v.number(),
        protein: v.optional(v.number()),
        mealType: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("meal_logs", {
            userId: args.userId,
            date: args.date,
            name: args.name,
            calories: args.calories,
            protein: args.protein,
            mealType: args.mealType,
        });
    },
});

/**
 * Mutation to update a meal log
 */
export const updateMealLog = mutation({
    args: {
        logId: v.id("meal_logs"),
        name: v.optional(v.string()),
        calories: v.optional(v.number()),
        protein: v.optional(v.number()),
        mealType: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const log = await ctx.db.get(args.logId);
        if (!log) {
            throw new Error("Meal log not found");
        }

        await ctx.db.patch(args.logId, {
            name: args.name ?? log.name,
            calories: args.calories ?? log.calories,
            protein: args.protein ?? log.protein,
            mealType: args.mealType ?? log.mealType,
        });

        return { success: true };
    },
});

/**
 * Mutation to delete a meal log
 */
export const deleteMealLog = mutation({
    args: {
        logId: v.id("meal_logs"),
    },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.logId);
        return { success: true };
    },
});
