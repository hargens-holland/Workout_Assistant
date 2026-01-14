import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Query to get today's workout session for a user
 */
export const getTodayWorkout = query({
    args: {
        userId: v.id("users"),
        date: v.string(), // ISO date string (YYYY-MM-DD)
    },
    handler: async (ctx, args) => {
        // Get active plan
        const activePlan = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!activePlan) {
            return null;
        }

        // Get session for this date
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", activePlan._id))
            .collect();

        const session = sessions.find((s) => s.date === args.date);
        if (!session) {
            return null;
        }

        // Get exercises and sets
        const sets = await ctx.db
            .query("exercise_sets")
            .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
            .collect();

        const exercises = await Promise.all(
            sets.map(async (set) => {
                const exercise = await ctx.db.get(set.exerciseId);
                return {
                    ...set,
                    exercise,
                };
            })
        );

        return {
            ...session,
            exercises,
        };
    },
});

/**
 * Mutation to reduce sets in a workout session (make easier/shorter)
 */
export const reduceWorkoutVolume = mutation({
    args: {
        sessionId: v.id("workout_sessions"),
        mode: v.union(v.literal("remove_set"), v.literal("remove_exercise")),
    },
    handler: async (ctx, args) => {
        const sets = await ctx.db
            .query("exercise_sets")
            .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
            .collect();

        if (sets.length === 0) {
            throw new Error("No sets found for this session");
        }

        if (args.mode === "remove_set") {
            // Remove 1 set from each exercise (remove highest setNumber)
            const exerciseGroups = new Map<Id<"exercises">, typeof sets>();
            for (const set of sets) {
                if (!exerciseGroups.has(set.exerciseId)) {
                    exerciseGroups.set(set.exerciseId, []);
                }
                exerciseGroups.get(set.exerciseId)!.push(set);
            }

            for (const [exerciseId, exerciseSets] of exerciseGroups) {
                const sortedSets = exerciseSets.sort((a, b) => b.setNumber - a.setNumber);
                if (sortedSets.length > 0) {
                    await ctx.db.delete(sortedSets[0]._id);
                }
            }
        } else {
            // Remove 1 exercise entirely (remove all sets for one exercise)
            const exerciseGroups = new Map<Id<"exercises">, typeof sets>();
            for (const set of sets) {
                if (!exerciseGroups.has(set.exerciseId)) {
                    exerciseGroups.set(set.exerciseId, []);
                }
                exerciseGroups.get(set.exerciseId)!.push(set);
            }

            // Remove the exercise with the most sets (or first one if tied)
            let exerciseToRemove: Id<"exercises"> | null = null;
            let maxSets = 0;
            for (const [exerciseId, exerciseSets] of exerciseGroups) {
                if (exerciseSets.length > maxSets) {
                    maxSets = exerciseSets.length;
                    exerciseToRemove = exerciseId;
                }
            }

            if (exerciseToRemove) {
                const setsToDelete = exerciseGroups.get(exerciseToRemove)!;
                for (const set of setsToDelete) {
                    await ctx.db.delete(set._id);
                }
            }
        }

        return { success: true };
    },
});

/**
 * Action to add an accessory exercise to upcoming sessions
 */
export const addAccessoryExercise = action({
    args: {
        userId: v.id("users"),
        planId: v.id("plans"),
        bodyPart: v.string(),
        count: v.number(), // Number of sessions to add to (1-2)
    },
    handler: async (ctx, args): Promise<{ success: boolean; sessionsUpdated: number }> => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        const endDateStr = sevenDaysLater.toISOString().split("T")[0];
        const todayStr = today.toISOString().split("T")[0];

        // Get upcoming workouts using the date range query
        const upcomingWorkouts: any[] = await ctx.runQuery(api.plans.getWorkoutsByDateRange, {
            userId: args.userId,
            startDate: todayStr,
            endDate: endDateStr,
        });

        // Filter to get only sessions (not full workout objects) and take the count
        const upcomingSessions: Array<{ _id: Id<"workout_sessions">; date: string }> = upcomingWorkouts
            .slice(0, args.count)
            .map((w: any) => ({
                _id: w._id,
                date: w.date,
            }));

        if (upcomingSessions.length === 0) {
            throw new Error("No upcoming sessions found");
        }

        // Select a random exercise for the body part
        const exerciseIds = await ctx.runQuery(api.plans.selectRandomExercisesForCategory, {
            bodyParts: [args.bodyPart],
            count: 1,
            excludeExerciseIds: [],
            userId: args.userId,
        });

        if (exerciseIds.length === 0) {
            throw new Error(`No exercises found for body part: ${args.bodyPart}`);
        }

        const exerciseId = exerciseIds[0];

        // Add exercise to each session
        for (const session of upcomingSessions) {
            // Get existing sets to determine setNumber - use the workout data we already have
            const workout = upcomingWorkouts.find((w: any) => w._id === session._id);
            const existingSets = workout?.exercises || [];
            const maxSetNumber = existingSets.length > 0
                ? Math.max(...existingSets.map((s: any) => s.setNumber || 0))
                : 0;

            // Create 3 sets for the accessory
            for (let i = 1; i <= 3; i++) {
                await ctx.runMutation(api.plans.createExerciseSet, {
                    sessionId: session._id,
                    exerciseId,
                    plannedWeight: 0, // Will be calculated by progression
                    plannedReps: 12, // Moderate reps for accessory
                    setNumber: maxSetNumber + i,
                });
            }
        }

        return { success: true, sessionsUpdated: upcomingSessions.length };
    },
});

/**
 * Mutation to move a workout session to a different date
 */
export const moveWorkoutSession = mutation({
    args: {
        sessionId: v.id("workout_sessions"),
        newDate: v.string(),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db.get(args.sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        // Check for duplicate
        const existingSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", session.planId))
            .collect();

        const duplicate = existingSessions.find(
            (s) => s.date === args.newDate && s.planId === session.planId && s._id !== args.sessionId
        );

        if (duplicate) {
            throw new Error(`A workout session already exists for date ${args.newDate}`);
        }

        // Update session date
        await ctx.db.patch(args.sessionId, {
            date: args.newDate,
        });

        return { success: true };
    },
});

/**
 * Query to get workout session by ID
 */
export const getWorkoutSessionById = query({
    args: {
        sessionId: v.id("workout_sessions"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.sessionId);
    },
});

/**
 * Query to get upcoming workouts (next 7 days)
 */
export const getUpcomingWorkouts = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const activePlan = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!activePlan) {
            return [];
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        const endDateStr = sevenDaysLater.toISOString().split("T")[0];
        const todayStr = today.toISOString().split("T")[0];

        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", activePlan._id))
            .filter((q) => q.gte(q.field("date"), todayStr))
            .filter((q) => q.lte(q.field("date"), endDateStr))
            .order("asc")
            .collect();

        return sessions;
    },
});

/**
 * Query to get workout history (last 14 days)
 */
export const getWorkoutHistory = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const activePlan = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!activePlan) {
            return [];
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const startDateStr = fourteenDaysAgo.toISOString().split("T")[0];
        const todayStr = today.toISOString().split("T")[0];

        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", activePlan._id))
            .filter((q) => q.gte(q.field("date"), startDateStr))
            .filter((q) => q.lte(q.field("date"), todayStr))
            .order("desc")
            .collect();

        // Get completion stats for each session
        const sessionsWithStats = await Promise.all(
            sessions.map(async (session) => {
                const sets = await ctx.db
                    .query("exercise_sets")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .collect();

                const completedSets = sets.filter((s) => s.completed).length;
                const totalSets = sets.length;

                return {
                    ...session,
                    completedSets,
                    totalSets,
                    completionRate: totalSets > 0 ? completedSets / totalSets : 0,
                };
            })
        );

        return sessionsWithStats;
    },
});
