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
        console.log("[getTodayWorkout] Called with:", { userId: args.userId, date: args.date });
        
        // Get active goal first
        const activeGoal = await ctx.db
            .query("goals")
            .withIndex("by_user_and_active", (q) => 
                q.eq("userId", args.userId).eq("isActive", true)
            )
            .first();
        
        if (!activeGoal) {
            console.log("[getTodayWorkout] No active goal, returning null");
            return null;
        }
        
        // Get session for this date and active goal
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_and_date", (q) => 
                q.eq("userId", args.userId).eq("date", args.date)
            )
            .collect();
        
        // Filter to get main workout session for active goal (prefer "main" type)
        // If no session found for active goal, return null (don't show old workouts without goalId)
        const session = sessions.find(s => s.goalId === activeGoal._id && s.workoutType === "main") ||
                       sessions.find(s => s.goalId === activeGoal._id) ||
                       null;

        console.log("[getTodayWorkout] Session found:", session ? { 
            _id: session._id, 
            date: session.date, 
            workoutType: session.workoutType,
            intensity: session.intensity 
        } : "null");

        if (!session) {
            // Check if there are any sessions for this user at all
            const anySessions = await ctx.db
                .query("workout_sessions")
                .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
                .collect();
            console.log("[getTodayWorkout] No session for date, but user has", anySessions.length, "total sessions");
            if (anySessions.length > 0) {
                console.log("[getTodayWorkout] Sample session dates:", anySessions.slice(0, 3).map(s => s.date));
            }
            return null;
        }

        // Get exercises and sets
        const sets = await ctx.db
            .query("exercise_sets")
            .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
            .collect();

        console.log("[getTodayWorkout] Found", sets.length, "sets for session");

        const exercises = await Promise.all(
            sets.map(async (set) => {
                const exercise = await ctx.db.get(set.exerciseId);
                if (!exercise) {
                    console.warn("[getTodayWorkout] Exercise not found for set:", set.exerciseId);
                }
                return {
                    ...set,
                    exercise,
                };
            })
        );

        const result = {
            ...session,
            exercises,
        };

        console.log("[getTodayWorkout] Returning workout with", exercises.length, "exercises");
        return result;
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
            console.log("[reduceWorkoutVolume] No sets found for session:", args.sessionId);
            // Return success instead of throwing - empty workouts can't be reduced
            return { success: true, message: "No sets to reduce - workout is already empty" };
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
 * Action to add an accessory exercise to today's workout only
 */
export const addAccessoryExercise = action({
    args: {
        userId: v.id("users"),
        bodyPart: v.string(),
    },
    handler: async (ctx, args): Promise<{ success: boolean }> => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        // Get today's workout only
        const todayWorkout = await ctx.runQuery(api.plans.getWorkoutByDate, {
            userId: args.userId,
            date: todayStr,
        });

        if (!todayWorkout) {
            throw new Error("No workout found for today. Please generate today's workout first.");
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

        // Get existing sets to determine setNumber
        const existingSets = todayWorkout.exercises || [];
        const maxSetNumber = existingSets.length > 0
            ? Math.max(...existingSets.map((s: any) => s.setNumber || 0))
            : 0;

        // Create 3 sets for the accessory
        for (let i = 1; i <= 3; i++) {
            await ctx.runMutation(api.plans.createExerciseSet, {
                sessionId: todayWorkout._id,
                exerciseId,
                plannedWeight: 0, // Will be calculated by progression
                plannedReps: 12, // Moderate reps for accessory
                setNumber: maxSetNumber + i,
            });
        }

        return { success: true };
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

        // Check for duplicate (same user, same date)
        const existingSession = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_and_date", (q) => 
                q.eq("userId", session.userId).eq("date", args.newDate)
            )
            .first();

        const duplicate = existingSession && existingSession._id !== args.sessionId;

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
 * Query to get today's workout only (no future workouts)
 */
export const getUpcomingWorkouts = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        const session = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_and_date", (q) => 
                q.eq("userId", args.userId).eq("date", todayStr)
            )
            .first();

        return session ? [session] : [];
    },
});

// getWorkoutHistory moved to plans.ts
