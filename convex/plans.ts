import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* =======================
   Convex Queries & Mutations
   (AI generation removed - will be replaced with deterministic logic)
======================= */

/**
 * Query to get all plans for a user
 */
export const getUserPlans = query({
    args: {
        userID: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("plans")
            .withIndex("byUserID", (q) => q.eq("userID", args.userID))
            .order("desc")
            .collect();
    },
});

/**
 * Query to get active plan for a user
 */
export const getActivePlan = query({
    args: {
        userID: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("plans")
            .withIndex("byUserID", (q) => q.eq("userID", args.userID))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();
    },
});

/**
 * Mutation to save a plan to the database
 */
export const createPlan = mutation({
    args: {
        userID: v.id("users"),
        name: v.string(),
        workoutPlan: v.object({
            schedule: v.array(v.string()),
            exercises: v.array(
                v.object({
                    day: v.string(),
                    routine: v.array(
                        v.object({
                            name: v.string(),
                            sets: v.number(),
                            reps: v.number(),
                            duration: v.optional(v.number()),
                            description: v.optional(v.string()),
                            exercise: v.optional(v.array(v.string())),
                        })
                    ),
                })
            ),
        }),
        dietPlan: v.object({
            dailyCalories: v.number(),
            meals: v.array(
                v.object({
                    name: v.string(),
                    foods: v.array(v.string()),
                    calories: v.number(),
                    instructions: v.array(v.string()),
                })
            ),
        }),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("plans", args);
    },
});

/**
 * Future: Action to generate and save a plan using deterministic logic
 * 
 * export const generateAndSavePlan = action({
 *     args: {
 *         userProfile: v.object({...}), // UserProfile type
 *         userID: v.id("users"),
 *         planName: v.string(),
 *     },
 *     handler: async (ctx, args) => {
 *         // Workout generation will be handled by deterministic logic here
 *         // const workoutPlan = generateWorkoutPlan(args.userProfile);
 *         
 *         // Meal plan generation will be handled by deterministic logic here
 *         // const mealPlan = generateMealPlan(args.userProfile);
 *         
 *         // Save to database
 *         // const planId = await ctx.runMutation(api.plans.createPlan, {...});
 *     },
 * });
 */
