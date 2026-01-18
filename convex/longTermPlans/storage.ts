import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Database operations for long-term plans
 * 
 * Handles storing and retrieving training plans from the database
 * For now, we'll store the plan structure in the plans table's trainingStrategy field
 * or create a new structure. Since plans table exists, we'll use it.
 */

export const storeLongTermPlan = mutation({
    args: {
        userId: v.id("users"),
        goalId: v.optional(v.id("goals")),
        longTermPlan: v.any(), // The plan structure from AI
    },
    handler: async (ctx, args) => {
        // Deactivate any existing active plans for this user
        const existingPlans = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();

        for (const plan of existingPlans) {
            await ctx.db.patch(plan._id, { isActive: false });
        }

        // Store the long-term plan in the plans table
        // We'll store it in a way that's compatible with the existing structure
        const planId = await ctx.db.insert("plans", {
            userId: args.userId,
            name: `Training Plan - ${new Date().toLocaleDateString()}`,
            workoutPlan: {
                schedule: [],
                exercises: [],
            },
            dietPlan: {
                dailyCalories: 0,
                meals: [],
            },
            trainingStrategy: {
                goal_type: args.longTermPlan.splitType || "FULL_BODY",
                primary_focus: args.longTermPlan.weeklyStructure?.[0]?.workouts?.[0]?.focus || "General Fitness",
                time_horizon_weeks: args.longTermPlan.durationWeeks || 12,
                training_priorities: [],
                secondary_support: [],
                recommended_frequency: args.longTermPlan.workoutsPerWeek || 3,
                intensity_distribution: {
                    heavy: 0.3,
                    moderate: 0.5,
                    light: 0.2,
                },
                recovery_notes: "",
                split_type: args.longTermPlan.splitType || "FULL_BODY",
            },
            executionConfig: {
                split_type: args.longTermPlan.splitType || "FULL_BODY",
                intensity_distribution: {
                    heavy: 0.3,
                    moderate: 0.5,
                    light: 0.2,
                },
            },
            isActive: true,
        });

        // Store the full long-term plan structure in preferences or a custom field
        // For now, we'll store it in a way that can be retrieved later
        // TODO: Consider adding a dedicated field for longTermPlan structure

        return planId;
    },
});

export const getActiveLongTermPlan = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        return plan;
    },
});
