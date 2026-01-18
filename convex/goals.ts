import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { validatePrimaryLiftForGoal } from "./primaryLifts";

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
        console.log("[getActiveGoal] Called with userId:", args.userId);
        const goal = await ctx.db
            .query("goals")
            .withIndex("by_user_and_active", (q) => 
                q.eq("userId", args.userId).eq("isActive", true)
            )
            .first();
        
        console.log("[getActiveGoal] Found goal:", goal ? { 
            _id: goal._id, 
            category: goal.category, 
            isActive: goal.isActive 
        } : "null");
        
        // Check if user has any goals at all
        if (!goal) {
            const allGoals = await ctx.db
                .query("goals")
                .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
                .collect();
            console.log("[getActiveGoal] User has", allGoals.length, "total goals (none active)");
        }
        
        return goal;
    },
});

/**
 * Internal mutation to create a new goal (called by createGoal action)
 * Sets it as active and deactivates all other goals for the user
 */
export const createGoalMutation = mutation({
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

        // Validate strength goals: if exercise is specified, it must be an approved PRIMARY LIFT
        // If no exercise is specified, it's an "overall strength" goal (valid)
        if (args.category === "strength" && args.target?.exercise) {
            const validation = await validatePrimaryLiftForGoal(ctx, args.target.exercise);
            if (!validation.isValid) {
                throw new Error(validation.error || "Invalid exercise for strength goal");
            }
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
 * Action to create a new goal and automatically generate today's workout if it's a workout day
 * Sets it as active and deactivates all other goals for the user
 */
export const createGoal = action({
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
    handler: async (ctx, args): Promise<Id<"goals">> => {
        // Create the goal using the internal mutation
        const goalId: Id<"goals"> = await ctx.runMutation(api.goals.createGoalMutation, args);

        // Try to generate today's workout automatically
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split("T")[0];

            // Always regenerate workout for new goal (delete existing if it exists for today)
            // This ensures the workout matches the new goal
            const existingSession = await ctx.runQuery(api.plans.getWorkoutByDate, {
                userId: args.userId,
                date: todayStr,
            });

            // Delete any existing workout for today (will be replaced with goal-specific workout)
            if (existingSession) {
                console.log(`[createGoal] Deleting existing workout for ${todayStr} to regenerate for new goal`);
                try {
                    // Delete all sessions for today (main, stretch, cardio, etc.)
                    const allTodaySessions = await ctx.runQuery(api.plans.getWorkoutsByDateRange, {
                        userId: args.userId,
                        startDate: todayStr,
                        endDate: todayStr,
                    });
                    
                    for (const session of allTodaySessions) {
                        await ctx.runMutation(api.plans.deleteWorkoutSession, {
                            sessionId: session._id,
                        });
                    }
                } catch (error) {
                    console.error(`[createGoal] Failed to delete existing workout:`, error);
                }
            }
            
            // Generate new workout linked to this goal
            try {
                await ctx.runAction(api.plans.generateDailyWorkoutAndMeals, {
                    userId: args.userId,
                    date: todayStr,
                    goalId: goalId, // Pass the goal ID to link the workout
                });
                console.log(`[createGoal] Successfully generated workout for new goal ${goalId} on ${todayStr}`);
            } catch (error) {
                // If it's a rest day or other expected error, that's fine - just log it
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes("rest day") || errorMessage.includes("already exists")) {
                    console.log(`[createGoal] Expected: ${errorMessage}`);
                } else {
                    // Unexpected error - log but don't fail goal creation
                    console.error(`[createGoal] Error generating workout:`, error);
                }
            }
        } catch (error) {
            // Don't fail goal creation if workout generation fails
            console.error(`[createGoal] Error checking/generating workout:`, error);
        }

        return goalId;
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

        // Regenerate today's workout for the new active goal
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split("T")[0];

            // Delete any existing workouts for today (will be replaced with new goal's workout)
            const existingSessions = await ctx.runQuery(api.plans.getWorkoutsByDateRange, {
                userId: args.userId,
                startDate: todayStr,
                endDate: todayStr,
            });

            if (existingSessions && existingSessions.length > 0) {
                console.log(`[setActiveGoal] Deleting ${existingSessions.length} existing workout(s) to regenerate for new active goal`);
                for (const session of existingSessions) {
                    await ctx.runMutation(api.plans.deleteWorkoutSession, {
                        sessionId: session._id,
                    });
                }
            }

            // Note: Workout generation should be triggered separately via action
            // Mutations cannot call actions directly
            console.log(`[setActiveGoal] Goal ${args.goalId} activated. Workout generation should be triggered separately if needed.`);
        } catch (error) {
            // Don't fail goal activation if workout generation fails
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("rest day")) {
                console.log(`[setActiveGoal] Expected: ${errorMessage}`);
            } else {
                console.error(`[setActiveGoal] Error generating workout:`, error);
            }
        }

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

        // Determine the category after update (use new category if provided, otherwise existing)
        const updatedCategory = args.category !== undefined ? args.category : goal.category;
        
        // Determine the target after update (use new target if provided, otherwise existing)
        const updatedTarget = args.target !== undefined ? args.target : goal.target;

        // Validate strength goals: if exercise is specified, it must be an approved PRIMARY LIFT
        // If no exercise is specified, it's an "overall strength" goal (valid)
        if (updatedCategory === "strength" && updatedTarget?.exercise) {
            const validation = await validatePrimaryLiftForGoal(ctx, updatedTarget.exercise);
            if (!validation.isValid) {
                throw new Error(validation.error || "Invalid exercise for strength goal");
            }
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
 * Mutation to mark a goal as completed
 * When a goal is completed, it also deletes all uncompleted workouts linked to that goal
 */
export const completeGoal = mutation({
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

        // Mark the goal as completed
        await ctx.db.patch(args.goalId, { completed: true, isActive: false });

        // Find all workout sessions linked to this goal
        const workoutSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_goal_id", (q) => q.eq("goalId", args.goalId))
            .collect();

        // Delete all uncompleted workouts for this goal
        let deletedCount = 0;
        for (const session of workoutSessions) {
            // Check if the workout is completed by checking if all exercise sets are completed
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .collect();

            const allSetsCompleted = sets.length > 0 && sets.every((set) => set.completed);

            // If workout is not completed, delete it
            if (!allSetsCompleted) {
                // Delete exercise sets
                for (const set of sets) {
                    await ctx.db.delete(set._id);
                }

                // Delete daily meals
                const meals = await ctx.db
                    .query("daily_meals")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .collect();
                for (const meal of meals) {
                    await ctx.db.delete(meal._id);
                }

                // Delete the session
                await ctx.db.delete(session._id);
                deletedCount++;
            }
        }

        console.log(`[completeGoal] Marked goal ${args.goalId} as completed and deleted ${deletedCount} uncompleted workout(s)`);

        return { success: true, deletedWorkouts: deletedCount };
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
