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

/**
 * Query to get all users (for scheduled tasks)
 */
export const getAllUsers = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("users").collect();
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

        // Validate custom workout days if provided
        if (args.preferences && typeof args.preferences === 'object') {
            const newPreferences = args.preferences as any;
            const customWorkoutDays = newPreferences.custom_workout_days;
            const workoutsPerWeek = newPreferences.workout_days_per_week;
            
            // Get existing preferences to check against
            const existingPreferences = user.preferences as any;
            const existingCustomDays = existingPreferences?.custom_workout_days;
            const existingWorkoutsPerWeek = existingPreferences?.workout_days_per_week;
            
            // Determine the workouts per week to validate against
            // Use new value if provided, otherwise use existing
            const targetWorkoutsPerWeek = workoutsPerWeek !== undefined 
                ? workoutsPerWeek 
                : existingWorkoutsPerWeek;
            
            // Determine the custom days being set
            const daysToValidate = customWorkoutDays !== undefined 
                ? customWorkoutDays 
                : existingCustomDays;
            
            // Validate custom workout days if they exist
            if (daysToValidate !== undefined && daysToValidate !== null) {
                if (Array.isArray(daysToValidate) && daysToValidate.length > 0) {
                    // Validate day numbers (0-6)
                    const invalidDays = daysToValidate.filter((day: any) => 
                        typeof day !== 'number' || day < 0 || day > 6
                    );
                    
                    if (invalidDays.length > 0) {
                        throw new Error(
                            `Invalid workout days: ${invalidDays.join(', ')}. ` +
                            `Days must be numbers between 0 (Sunday) and 6 (Saturday).`
                        );
                    }
                    
                    // Check if custom days match workouts per week preference
                    if (targetWorkoutsPerWeek !== undefined && typeof targetWorkoutsPerWeek === 'number') {
                        if (daysToValidate.length !== targetWorkoutsPerWeek) {
                            throw new Error(
                                `Custom workout days (${daysToValidate.length} days) must match ` +
                                `your preferred workouts per week (${targetWorkoutsPerWeek} days). ` +
                                `Please set exactly ${targetWorkoutsPerWeek} workout days or update your workouts per week preference.`
                            );
                        }
                    }
                } else if (daysToValidate !== null && daysToValidate !== undefined) {
                    // If it's not null/undefined but also not a valid array
                    throw new Error(
                        `Custom workout days must be an array of day numbers (0-6) or null/empty array to use calculated schedule.`
                    );
                }
            }
            
            // If workouts per week is being updated and custom days exist, validate
            if (workoutsPerWeek !== undefined && typeof workoutsPerWeek === 'number') {
                const currentCustomDays = customWorkoutDays !== undefined 
                    ? customWorkoutDays 
                    : existingCustomDays;
                
                if (currentCustomDays && Array.isArray(currentCustomDays) && currentCustomDays.length > 0) {
                    if (currentCustomDays.length !== workoutsPerWeek) {
                        throw new Error(
                            `Your custom workout days (${currentCustomDays.length} days) must match ` +
                            `the new workouts per week setting (${workoutsPerWeek} days). ` +
                            `Please update your custom workout days to have exactly ${workoutsPerWeek} days.`
                        );
                    }
                }
            }
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