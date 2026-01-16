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

/**
 * Query to get goal progress based on goal type
 * - Strength goals: tracks max weight for the target exercise
 * - Endurance goals: tracks total distance (miles/km)
 * - Body composition goals: tracks weight
 */
export const getGoalProgress = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const goal = await ctx.db
            .query("goals")
            .withIndex("by_user_and_active", (q) => 
                q.eq("userId", args.userId).eq("isActive", true)
            )
            .first();

        if (!goal) {
            return null;
        }

        const goalStartDate = goal._creationTime;
        const now = Date.now();
        const daysElapsed = Math.floor((now - goalStartDate) / (1000 * 60 * 60 * 24));

        let currentValue: number | null = null;
        let targetValue: number | null = goal.value || null;
        let unit: string = goal.unit || "";
        let progressData: Array<{ date: string; value: number }> = [];

        if (goal.category === "strength" && goal.target?.exercise) {
            // For strength goals, find the exercise and get max weight
            const exercises = await ctx.db
                .query("exercises")
                .filter((q) => 
                    q.eq(q.field("name"), goal.target!.exercise!)
                )
                .collect();

            if (exercises.length > 0) {
                const exerciseId = exercises[0]._id;
                
                // Get all workout sessions for this user
                const sessions = await ctx.db
                    .query("workout_sessions")
                    .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
                    .order("asc")
                    .collect();

                const maxWeights: Array<{ date: string; value: number }> = [];
                
                for (const session of sessions) {
                    const sets = await ctx.db
                        .query("exercise_sets")
                        .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                        .filter((q) => q.eq(q.field("exerciseId"), exerciseId))
                        .filter((q) => q.eq(q.field("completed"), true))
                        .collect();

                    if (sets.length > 0) {
                        const maxWeight = Math.max(...sets.map((s) => s.actualWeight || s.plannedWeight));
                        maxWeights.push({
                            date: session.date,
                            value: maxWeight,
                        });
                    }
                }

                if (maxWeights.length > 0) {
                    currentValue = Math.max(...maxWeights.map((m) => m.value));
                    progressData = maxWeights;
                    unit = unit || "lbs";
                }
            }
        } else if (goal.category === "endurance" && goal.target?.movement) {
            // For endurance goals, sum up distance from daily_tracking
            const trackingRecords = await ctx.db
                .query("daily_tracking")
                .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
                .filter((q) => q.gte(q.field("date"), new Date(goalStartDate).toISOString().split("T")[0]))
                .collect();

            const distances: Array<{ date: string; value: number }> = [];
            let totalDistance = 0;

            for (const record of trackingRecords) {
                if (record.distance_km) {
                    totalDistance += record.distance_km;
                    distances.push({
                        date: record.date,
                        value: record.distance_km,
                    });
                }
            }

            // Convert to miles if unit is miles
            if (unit.toLowerCase().includes("mile")) {
                currentValue = totalDistance * 0.621371; // km to miles
                progressData = distances.map(d => ({ ...d, value: d.value * 0.621371 }));
            } else {
                currentValue = totalDistance;
                progressData = distances;
            }
            
            unit = unit || "miles";
        } else if (goal.category === "body_composition") {
            // For body composition goals, get weight from daily_tracking or user profile
            const user = await ctx.db.get(args.userId);
            const startWeight = user?.weight_kg || null;
            
            const trackingRecords = await ctx.db
                .query("daily_tracking")
                .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
                .filter((q) => q.gte(q.field("date"), new Date(goalStartDate).toISOString().split("T")[0]))
                .filter((q) => q.neq(q.field("weight_kg"), undefined))
                .order("desc")
                .collect();

            if (trackingRecords.length > 0) {
                // Get the most recent weight
                currentValue = trackingRecords[0].weight_kg!;
                
                // Convert to lbs if unit is lbs
                if (unit.toLowerCase().includes("lb")) {
                    currentValue = currentValue * 2.20462;
                    progressData = trackingRecords
                        .filter(r => r.weight_kg !== undefined)
                        .map(r => ({ date: r.date, value: r.weight_kg! * 2.20462 }));
                } else {
                    progressData = trackingRecords
                        .filter(r => r.weight_kg !== undefined)
                        .map(r => ({ date: r.date, value: r.weight_kg! }));
                }
            } else if (startWeight) {
                // Fallback to user profile weight
                currentValue = startWeight;
                if (unit.toLowerCase().includes("lb")) {
                    currentValue = currentValue * 2.20462;
                }
            }
            
            unit = unit || "lbs";
        }

        // Calculate progress percentage and adjust targetValue for display
        let progressPercent = 0;
        let displayTargetValue = targetValue;
        let startValue: number | null = null;
        
        if (currentValue !== null && targetValue !== null) {
            if (goal.category === "body_composition") {
                // For body composition, goal.value is the CHANGE amount (lbs/kg to lose or gain)
                // We need to calculate the actual target weight for display
                const user = await ctx.db.get(args.userId);
                startValue = user?.weight_kg ? (unit.toLowerCase().includes("lb") ? user.weight_kg * 2.20462 : user.weight_kg) : currentValue;
                
                if (goal.direction === "decrease") {
                    // Weight loss: target is startWeight - goal.value
                    displayTargetValue = startValue - targetValue;
                    const weightLost = startValue - currentValue;
                    if (targetValue > 0) {
                        progressPercent = Math.min(100, Math.max(0, (weightLost / targetValue) * 100));
                    }
                } else if (goal.direction === "increase") {
                    // Weight gain: target is startWeight + goal.value
                    displayTargetValue = startValue + targetValue;
                    const weightGained = currentValue - startValue;
                    if (targetValue > 0) {
                        progressPercent = Math.min(100, Math.max(0, (weightGained / targetValue) * 100));
                    }
                } else {
                    // Achieve: goal.value is the target weight itself
                    displayTargetValue = targetValue;
                    // For achieve, we calculate progress from start weight
                    const totalChange = Math.abs(displayTargetValue - startValue);
                    const currentChange = Math.abs(currentValue - startValue);
                    if (totalChange > 0) {
                        progressPercent = Math.min(100, Math.max(0, (currentChange / totalChange) * 100));
                    }
                }
            } else if (goal.category === "strength") {
                // For strength goals, currentValue is max weight achieved, targetValue is target weight
                progressPercent = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
            } else if (goal.category === "endurance") {
                // For endurance goals, currentValue is total distance, targetValue is target distance
                progressPercent = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
            }
        }

        return {
            goal,
            currentValue,
            targetValue: displayTargetValue, // Use the calculated display target
            unit,
            progressPercent,
            daysElapsed,
            progressData: progressData.slice(-30), // Last 30 data points
            startValue,
        };
    },
});
