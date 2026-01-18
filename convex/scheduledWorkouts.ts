/**
 * Scheduled Workout Generation
 * 
 * Automatically generates daily workouts for all users with active goals.
 * Runs daily at a specified time (e.g., 6 AM) to prepare workouts for the day.
 */

import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import type { WorkoutIntent, NutritionIntent, ActiveGoal } from "./constraints";
import type { WorkoutBlueprint, MealPlan } from "./constrainedGeneration";

/**
 * Context object for AI explanations
 * Packages all relevant information for generating workout and meal explanations
 */
export interface AIExplanationContext {
    userId: Id<"users">;
    userName: string;
    goalType: string;
    goalDescription: string;
    splitType: string | null;
    splitDayName: string | null;
    workoutDays: string[];
    injuries: string[];
    intensity: "strengthen" | "maintain" | "recover";
    workoutIntent: WorkoutIntent;
    nutritionIntent: NutritionIntent;
    workoutBlueprint: WorkoutBlueprint;
    mealPlan: MealPlan;
    recentProgress: Array<{
        exercise: string;
        lastWeight: number;
        lastReps: number;
        date: string;
    }>;
    equipment: string[];
}

/**
 * Package context for AI explanations
 * Collects all relevant information to generate detailed workout and meal explanations
 */
export async function packageAIExplanationContext(
    ctx: any,
    userId: Id<"users">,
    activeGoal: ActiveGoal | null,
    workoutIntent: WorkoutIntent,
    nutritionIntent: NutritionIntent,
    workoutBlueprint: WorkoutBlueprint,
    mealPlan: MealPlan,
    date?: string // Optional date string (YYYY-MM-DD), defaults to today
): Promise<AIExplanationContext> {
    // Get user profile
    const userDoc = await ctx.runQuery(api.users.getUserById, { userId });
    if (!userDoc) {
        throw new Error("User not found");
    }

    // Determine the date to use (default to today)
    const targetDate = date || new Date().toISOString().split("T")[0];
    const today = new Date(targetDate);
    today.setHours(0, 0, 0, 0);
    
    // Get split info
    const splitType = userDoc.preferences?.preferred_split as string | null;
    const workoutsPerWeek = userDoc.preferences?.workout_days_per_week as number | undefined;
    const customWorkoutDays = userDoc.preferences?.custom_workout_days as number[] | undefined;

    // Get recent workouts (last 14 days, ending yesterday)
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentWorkouts = await ctx.runQuery(api.plans.getRecentWorkoutsForConstraints, {
        userId,
        startDate: fourteenDaysAgo.toISOString().split("T")[0],
        endDate: yesterday.toISOString().split("T")[0],
    });

    const { getSplitDayName } = await import("./split_templates");
    const { determineSplitDay } = await import("./workouts/workoutUtils");
    const { getWorkoutSchedule } = await import("./workouts/workoutUtils");

    // Determine split day using yesterday's date (for consistency with workout generation)
    const yesterdayDate = yesterday.toISOString().split("T")[0];
    const splitDayNumber = determineSplitDay(splitType as any, recentWorkouts, yesterdayDate);
    const splitDayName = splitDayNumber && splitType
        ? getSplitDayName(splitType as any, splitDayNumber)
        : null;

    const workoutSchedule = getWorkoutSchedule(workoutsPerWeek, customWorkoutDays);

    // Get recent progress (last workout for each exercise)
    const recentProgress: Array<{
        exercise: string;
        lastWeight: number;
        lastReps: number;
        date: string;
    }> = [];

    if (recentWorkouts.length > 0) {
        const exerciseMap = new Map<string, {
            exercise: string;
            lastWeight: number;
            lastReps: number;
            date: string;
        }>();

        for (const workout of recentWorkouts) {
            for (const exercise of workout.exercises) {
                if (exercise.sets.length > 0) {
                    const lastSet = exercise.sets[exercise.sets.length - 1];
                    if (lastSet.completed) {
                        const existing = exerciseMap.get(exercise.name);
                        if (!existing || workout.date > existing.date) {
                            exerciseMap.set(exercise.name, {
                                exercise: exercise.name,
                                lastWeight: lastSet.weight,
                                lastReps: lastSet.reps,
                                date: workout.date,
                            });
                        }
                    }
                }
            }
        }

        recentProgress.push(...Array.from(exerciseMap.values()));
    }

    // Build goal description (formatted for AI explanations)
    let goalDescription = "";
    if (activeGoal) {
        if (activeGoal.category === "strength" && activeGoal.target?.exercise) {
            goalDescription = `your goal to ${activeGoal.direction || "improve"} ${activeGoal.target.exercise}${activeGoal.value ? ` to ${activeGoal.value} ${activeGoal.unit || "lbs"}` : ""}`;
        } else if (activeGoal.category === "body_composition") {
            goalDescription = `your ${activeGoal.direction || "body composition"} goal${activeGoal.value ? ` of ${activeGoal.value} ${activeGoal.unit || "lbs"}` : ""}`;
        } else {
            goalDescription = `your ${activeGoal.category} goal`;
        }
    }

    return {
        userId,
        userName: userDoc.name,
        goalType: activeGoal?.category || "general",
        goalDescription,
        splitType,
        splitDayName,
        workoutDays: workoutSchedule,
        injuries: userDoc.injury_constraints || [],
        intensity: workoutIntent.intensity,
        workoutIntent,
        nutritionIntent,
        workoutBlueprint,
        mealPlan,
        recentProgress,
        equipment: (userDoc.equipment_access as string[]) || [],
    };
}

/**
 * Helper function to get a consistent delay for a user based on their ID
 * This ensures each user gets the same delay every day to avoid API call spikes
 * Returns delay in milliseconds (2-5 seconds)
 */
function getUserDelayMs(userId: string): number {
    // Simple hash of user ID to get a consistent offset
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Return delay between 2-5 seconds (2000-5000ms)
    // This spreads users out to avoid API spikes
    return 2000 + (Math.abs(hash) % 3000);
}

/**
 * Scheduled action to generate daily workouts for all users
 * Runs daily at 12 AM Eastern (midnight) - 4:00 AM UTC (EDT) / 5:00 AM UTC (EST)
 * 
 * Users are processed with staggered delays (0-60 minutes) based on their user ID hash
 * to avoid API call spikes. Each user gets the same time slot every day.
 * 
 * To configure the schedule, add this to your convex.json or use the Convex dashboard:
 * {
 *   "scheduledFunctions": {
 *     "scheduledWorkouts:generateDailyWorkoutsForAllUsers": {
 *       "cron": "0 5 * * *"
 *     }
 *   }
 * }
 * 
 * Cron format: "minute hour day-of-month month day-of-week"
 * "0 5 * * *" = Every day at 5:00 AM UTC (12:00 AM EST / 1:00 AM EDT)
 * 
 * Note: 5:00 AM UTC = 12:00 AM EST (winter) / 1:00 AM EDT (summer)
 */
export const generateDailyWorkoutsForAllUsers = internalAction({
    args: {},
    handler: async (ctx) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        console.log(`[Scheduled Workouts] Starting daily workout generation for ${todayStr}`);

        // Get all users
        const allUsers = await ctx.runQuery(api.users.getAllUsers);

        console.log(`[Scheduled Workouts] Processing ${allUsers.length} users with staggered delays (2-5 seconds between each)`);

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < allUsers.length; i++) {
            const user = allUsers[i];
            
            try {
                // Add a small delay before processing each user (except the first)
                // This spreads out API calls to avoid spikes
                if (i > 0) {
                    const delayMs = getUserDelayMs(user._id);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                // Process this user
                // Check if user has active goal
                const activeGoal = await ctx.runQuery(api.goals.getActiveGoal, {
                    userId: user._id,
                });

                if (!activeGoal) {
                    console.log(`[Scheduled Workouts] Skipping user ${user._id}: No active goal`);
                    skippedCount++;
                    continue;
                }

                // Check if workout already exists for today
                const existingSession = await ctx.runQuery(api.plans.getWorkoutByDate, {
                    userId: user._id,
                    date: todayStr,
                });

                if (existingSession) {
                    console.log(`[Scheduled Workouts] Skipping user ${user._id}: Workout already exists for ${todayStr}`);
                    skippedCount++;
                    continue;
                }

                // Check if today is a workout day
                const workoutsPerWeek = user.preferences?.workout_days_per_week as number | undefined;
                const customWorkoutDays = user.preferences?.custom_workout_days as number[] | undefined;

                // Get recent workouts for schedule check
                const fourteenDaysAgo = new Date(today);
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                const recentWorkouts = await ctx.runQuery(api.plans.getRecentWorkoutsForConstraints, {
                    userId: user._id,
                    startDate: fourteenDaysAgo.toISOString().split("T")[0],
                    endDate: yesterday.toISOString().split("T")[0],
                });

                const { shouldWorkoutToday } = await import("./workouts/workoutUtils");
                const isWorkoutDay = shouldWorkoutToday(todayStr, workoutsPerWeek, recentWorkouts, customWorkoutDays);

                if (!isWorkoutDay) {
                    console.log(`[Scheduled Workouts] Skipping user ${user._id}: Today is a rest day`);
                    skippedCount++;
                    continue;
                }

                // Generate workout for this user
                console.log(`[Scheduled Workouts] Generating workout for user ${user._id} (${user.name})`);
                
                const result = await ctx.runAction(api.plans.generateDailyWorkoutAndMeals, {
                    userId: user._id,
                    date: todayStr,
                });

                // Package context for AI explanations (already done in generateDailyWorkoutAndMeals, but we could enhance it)
                console.log(`[Scheduled Workouts] ✅ Successfully generated workout for user ${user._id}: ${result.sessionId}`);
                successCount++;

            } catch (error) {
                console.error(`[Scheduled Workouts] ❌ Error generating workout for user ${user._id}:`, error);
                errorCount++;
                // Continue with other users even if one fails
            }
        }

        console.log(`[Scheduled Workouts] Completed: ${successCount} generated, ${skippedCount} skipped, ${errorCount} errors`);
        
        return {
            success: true,
            date: todayStr,
            generated: successCount,
            skipped: skippedCount,
            errors: errorCount,
        };
    },
});
