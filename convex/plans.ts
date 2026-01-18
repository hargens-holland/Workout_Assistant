import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { generateText } from "./llm";
import { Id } from "./_generated/dataModel";
import { getSplitTemplate, type SplitType } from "./splits";
import {
    computeWorkoutIntent,
    computeProgressionTargets,
    computeNutritionIntent,
    type WorkoutIntent,
    type ProgressionTarget,
    type NutritionIntent,
    type RecentWorkout,
    type ActiveGoal,
} from "./constraints";
import { shouldWorkoutToday, getWorkoutSchedule } from "./workouts/workoutUtils";
import {
    generateDailyWorkout,
    generateWorkoutFromTemplate,
    generateDailyMeals,
    generateWorkoutExplanation,
    generateMealExplanation,
    type WorkoutBlueprint,
    type MealPlan,
} from "./constrainedGeneration";
import {
    validateWorkoutBlueprint,
    validateMealPlan,
    checkBlockedItems,
} from "./validation";
import { getExerciseContext } from "../src/ai/retrieval/getExerciseContext";
import { getMealContext } from "../src/ai/retrieval/getMealContext";
import { getSplitDayName } from "./split_templates";
import { determineSplitDay } from "./workouts/workoutUtils";

/* =======================
   Convex Queries & Mutations
   (AI generation removed - will be replaced with deterministic logic)
======================= */

/**
 * DEPRECATED: Plan CRUD operations removed - system now uses goals only
 * These functions have been removed:
 * - getUserPlans
 * - getActivePlan
 * - setActivePlan
 * - deletePlan
 * - createPlan
 * - generatePlan
 * - generateWorkoutsFromStrategy
 * - generateNextWorkout
 * 
 * Use goals.ts for goal management instead.
 */

// createPlan removed - plans are deprecated

/**
 * Mutation to update goals on the active plan
 * Validates required fields (category, priority) and stores goals on the active plan
 * 
 * Example goal payloads for UI usage:
 * 
 * 1. Weight loss:
 * {
 *   category: "body_composition",
 *   direction: "decrease",
 *   value: 10,
 *   unit: "kg",
 *   priority: "high"
 * }
 * 
 * 2. Weight gain:
 * {
 *   category: "body_composition",
 *   direction: "increase",
 *   value: 5,
 *   unit: "kg",
 *   priority: "medium"
 * }
 * 
 * 3. Pull-up rep goal:
 * {
 *   category: "strength",
 *   target: {
 *     exercise: "pull_up",
 *     metric: "reps"
 *   },
 *   direction: "increase",
 *   value: 10,
 *   unit: "reps",
 *   priority: "high"
 * }
 * 
 * 4. Mile time improvement:
 * {
 *   category: "endurance",
 *   target: {
 *     movement: "mile_run",
 *     metric: "time"
 *   },
 *   direction: "decrease",
 *   value: 7.5,
 *   unit: "minutes",
 *   priority: "high"
 * }
 * 
 * 5. Mobility goal:
 * {
 *   category: "mobility",
 *   target: {
 *     movement: "hip_flexor_stretch",
 *     metric: "rom"
 *   },
 *   direction: "increase",
 *   value: 90,
 *   unit: "degrees",
 *   priority: "medium"
 * }
 * 
 * 6. Skill goal (muscle-up):
 * {
 *   category: "skill",
 *   target: {
 *     movement: "muscle_up"
 *   },
 *   direction: "achieve",
 *   priority: "high"
 * }
 */
export const updateGoals = mutation({
    args: {
        userId: v.id("users"),
        goals: v.array(v.object({
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
            priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        })),
    },
    handler: async (ctx, args) => {
        // Get active plan for user
        const activePlan = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!activePlan) {
            throw new Error("No active plan found for user");
        }

        // Validate goals have required fields (category and priority are required by schema)
        // Additional validation: ensure at least category and priority are present
        for (const goal of args.goals) {
            if (!goal.category) {
                throw new Error("Goal must have a category");
            }
            if (!goal.priority) {
                throw new Error("Goal must have a priority");
            }
        }

        // Update goals on active plan
        await ctx.db.patch(activePlan._id, {
            goals: args.goals,
        });

        return { success: true, planId: activePlan._id };
    },
});

/**
 * Mutation to add a meal to an existing plan's diet plan
 */
export const addMealToPlan = mutation({
    args: {
        planId: v.id("plans"),
        meal: v.object({
            name: v.string(),
            foods: v.array(v.string()),
            calories: v.number(),
            instructions: v.optional(v.array(v.string())),
        }),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) {
            throw new Error("Plan not found");
        }

        // Check for duplicate meal name (case-insensitive)
        const existingMeal = plan.dietPlan.meals.find(
            (meal) => meal.name.toLowerCase() === args.meal.name.toLowerCase()
        );

        if (existingMeal) {
            throw new Error(`A meal with the name "${args.meal.name}" already exists in this plan`);
        }

        const newMeal = {
            name: args.meal.name,
            foods: args.meal.foods,
            calories: args.meal.calories,
            instructions: args.meal.instructions || [`Enjoy your ${args.meal.name.toLowerCase()}.`],
        };

        const updatedDietPlan = {
            ...plan.dietPlan,
            meals: [...plan.dietPlan.meals, newMeal],
        };

        await ctx.db.patch(args.planId, {
            dietPlan: updatedDietPlan,
        });

        return { success: true, meal: newMeal };
    },
});

/**
 * Mutation to update a meal in a plan's diet plan
 */
export const updateMealInPlan = mutation({
    args: {
        planId: v.id("plans"),
        mealIndex: v.number(),
        meal: v.object({
            name: v.string(),
            foods: v.array(v.string()),
            calories: v.number(),
            instructions: v.optional(v.array(v.string())),
        }),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) {
            throw new Error("Plan not found");
        }

        if (args.mealIndex < 0 || args.mealIndex >= plan.dietPlan.meals.length) {
            throw new Error("Invalid meal index");
        }

        // Check for duplicate meal name (case-insensitive), excluding current meal
        const existingMeal = plan.dietPlan.meals.find(
            (meal, index) =>
                index !== args.mealIndex &&
                meal.name.toLowerCase() === args.meal.name.toLowerCase()
        );

        if (existingMeal) {
            throw new Error(`A meal with the name "${args.meal.name}" already exists in this plan`);
        }

        const updatedMeals = [...plan.dietPlan.meals];
        updatedMeals[args.mealIndex] = {
            name: args.meal.name,
            foods: args.meal.foods,
            calories: args.meal.calories,
            instructions: args.meal.instructions || updatedMeals[args.mealIndex].instructions,
        };

        const updatedDietPlan = {
            ...plan.dietPlan,
            meals: updatedMeals,
        };

        await ctx.db.patch(args.planId, {
            dietPlan: updatedDietPlan,
        });

        return { success: true, meal: updatedMeals[args.mealIndex] };
    },
});

/**
 * Mutation to remove a meal from a plan's diet plan
 */
export const removeMealFromPlan = mutation({
    args: {
        planId: v.id("plans"),
        mealIndex: v.number(),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) {
            throw new Error("Plan not found");
        }

        if (args.mealIndex < 0 || args.mealIndex >= plan.dietPlan.meals.length) {
            throw new Error("Invalid meal index");
        }

        const updatedMeals = plan.dietPlan.meals.filter((_, index) => index !== args.mealIndex);

        const updatedDietPlan = {
            ...plan.dietPlan,
            meals: updatedMeals,
        };

        await ctx.db.patch(args.planId, {
            dietPlan: updatedDietPlan,
        });

        return { success: true };
    },
});

/**
 * @deprecated - generatePlan removed - use goal creation and generateDailyWorkoutAndMeals instead
 * Function body removed - was ~380 lines
 */
// generatePlan function removed - use goals.createGoal and generateDailyWorkoutAndMeals instead

/* =======================
   Deterministic Workout Generation
======================= */

type TrainingStrategy = {
    goal_type: string;
    primary_focus: string;
    time_horizon_weeks: number;
    training_priorities: string[];
    secondary_support: string[];
    recommended_frequency: Record<string, number>;
    intensity_distribution: {
        heavy: number;
        moderate: number;
        light: number;
    };
    recovery_notes: string;
    split_type?: SplitType;
};

type WeeklySession = {
    dayOfWeek: string;
    bodyParts: string[];
    intensity: "heavy" | "moderate" | "light";
};

type Exercise = {
    _id: Id<"exercises">;
    name: string;
    bodyPart?: string; // Kept for backward compatibility
    bodyParts: string[]; // Array of body parts this exercise targets
    isCompound: boolean;
    equipment?: string;
    instructions?: string[];
    tutorialImage?: string;
};

/**
 * Calculate sessions per week from recommended_frequency
 */
function calculateSessionsPerWeek(recommendedFrequency: Record<string, number>): number {
    const total = Object.values(recommendedFrequency).reduce((sum, freq) => sum + freq, 0);
    return Math.max(3, Math.min(7, Math.ceil(total)));
}

/**
 * Query to check for fatigue indicators in recent sessions
 */
export const checkFatigueIndicators = query({
    args: {
        userId: v.id("users"),
        lookbackDays: v.number(),
    },
    handler: async (ctx, args) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - args.lookbackDays);
        const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.gte(q.field("date"), cutoffDateStr))
            .collect();

        let failedRepsCount = 0;
        let highRPECount = 0;
        let totalCompletedSets = 0;

        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .filter((q) => q.eq(q.field("completed"), true))
                .collect();

            for (const set of sets) {
                if (set.actualReps !== undefined && set.plannedReps !== undefined) {
                    totalCompletedSets++;
                    if (set.actualReps < set.plannedReps) {
                        failedRepsCount++;
                    }
                }
                if (set.actualRPE !== undefined && set.actualRPE >= 9) {
                    highRPECount++;
                }
            }
        }

        const failedRepsRatio = totalCompletedSets > 0 ? failedRepsCount / totalCompletedSets : 0;
        const highRPERatio = totalCompletedSets > 0 ? highRPECount / totalCompletedSets : 0;

        return {
            failedRepsRatio,
            highRPERatio,
            totalCompletedSets,
            shouldDeload: failedRepsRatio >= 0.3 || highRPERatio >= 0.4,
        };
    },
});

/**
 * Check if a fitness goal involves running
 */
function goalInvolvesRunning(fitnessGoal: string): boolean {
    const normalized = fitnessGoal.toLowerCase();
    const runningKeywords = ["run", "running", "mile", "5k", "10k", "marathon", "sprint", "jog", "distance"];
    return runningKeywords.some(keyword => normalized.includes(keyword));
}

/**
 * Map training priority names to actual body parts in the database
 */
function mapTrainingPriorityToBodyParts(priority: string): string[] {
    const normalized = priority.toLowerCase();

    // Running / Cardio - prioritize running detection
    if (normalized.includes("running") || normalized.includes("run")) {
        return ["cardio", "running"]; // Return both to allow special handling
    }

    // Core-related
    if (normalized.includes("core") || normalized.includes("stability")) {
        return ["core"];
    }

    // Full body / strength training
    if (normalized.includes("full body") || normalized.includes("strength training")) {
        return ["chest", "back", "legs", "shoulders"];
    }

    // Cardio / HIIT
    if (normalized.includes("hiit") || normalized.includes("cardio") || normalized.includes("interval")) {
        return ["cardio"];
    }

    // Mobility / Flexibility
    if (normalized.includes("mobility") || normalized.includes("flexibility")) {
        return ["core"]; // Use core exercises for now, could add flexibility category later
    }

    // Specific body parts
    if (normalized.includes("chest")) return ["chest"];
    if (normalized.includes("back")) return ["back"];
    if (normalized.includes("legs") || normalized.includes("lower")) return ["legs"];
    if (normalized.includes("shoulder")) return ["shoulders"];
    if (normalized.includes("arm")) return ["biceps", "triceps"];
    if (normalized.includes("bicep")) return ["biceps"];
    if (normalized.includes("tricep")) return ["triceps"];

    // Default: try to find a match or return empty (will be handled)
    return [];
}

/**
 * Build repeatable weekly split from strategy
 * Uses split templates if split_type is provided, otherwise falls back to priority-based generation
 */
function buildWeeklySplit(strategy: TrainingStrategy, executionConfig?: { split_type?: SplitType; intensity_distribution?: { heavy: number; moderate: number; light: number } }): WeeklySession[] {
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const splitType = executionConfig?.split_type ?? strategy.split_type;
    const intensityDistribution = executionConfig?.intensity_distribution ?? strategy.intensity_distribution;

    // If split_type is provided, use split template
    if (splitType) {
        const splitTemplate = getSplitTemplate(splitType);
        const weeklySessions: WeeklySession[] = [];

        // Calculate how many times to repeat the split per week
        const cyclesPerWeek = Math.ceil(splitTemplate.daysPerWeek / splitTemplate.days.length);
        let sessionIndex = 0;

        for (let cycle = 0; cycle < cyclesPerWeek; cycle++) {
            for (const splitDay of splitTemplate.days) {
                if (sessionIndex >= splitTemplate.daysPerWeek) break;

                // Distribute intensity across sessions
                const intensityIndex = sessionIndex % 3;
                let intensity: "heavy" | "moderate" | "light" = "moderate";

                if (intensityIndex === 0) {
                    intensity = "heavy";
                } else if (intensityIndex === 1) {
                    intensity = "moderate";
                } else {
                    intensity = "light";
                }

                // Apply intensity distribution from execution config or strategy
                const totalIntensity = intensityDistribution.heavy +
                    intensityDistribution.moderate +
                    intensityDistribution.light;
                const heavyRatio = intensityDistribution.heavy / totalIntensity;
                const moderateRatio = intensityDistribution.moderate / totalIntensity;

                if (sessionIndex < Math.round(splitTemplate.daysPerWeek * heavyRatio)) {
                    intensity = "heavy";
                } else if (sessionIndex < Math.round(splitTemplate.daysPerWeek * (heavyRatio + moderateRatio))) {
                    intensity = "moderate";
                } else {
                    intensity = "light";
                }

                weeklySessions.push({
                    dayOfWeek: "",
                    bodyParts: splitDay.bodyParts,
                    intensity,
                });
                sessionIndex++;
            }
            if (sessionIndex >= splitTemplate.daysPerWeek) break;
        }

        // Assign days of week, spacing them out evenly (not consecutive)
        const numSessions = weeklySessions.length;
        if (numSessions > 0) {
            // Distribute sessions evenly across the week
            for (let i = 0; i < numSessions; i++) {
                const dayIndex = Math.floor((i * 7) / numSessions);
                weeklySessions[i].dayOfWeek = daysOfWeek[dayIndex];
            }
        }

        return weeklySessions;
    }

    // Fallback to original priority-based generation
    const sessionsPerWeek = calculateSessionsPerWeek(strategy.recommended_frequency);
    const weeklySessions: WeeklySession[] = [];

    // Map body parts to priorities (for secondary support)
    const bodyPartMap: Record<string, string[]> = {
        "chest": ["chest", "triceps"],
        "back": ["back", "biceps"],
        "legs": ["legs", "glutes"],
        "shoulders": ["shoulders", "traps"],
        "arms": ["biceps", "triceps"],
        "core": ["core", "abs"],
    };

    // Build priority sessions first
    const prioritySessions: WeeklySession[] = [];
    for (const [priority, frequency] of Object.entries(strategy.recommended_frequency)) {
        for (let i = 0; i < frequency; i++) {
            // Map training priority to actual body parts
            const mappedParts = mapTrainingPriorityToBodyParts(priority);
            if (mappedParts.length === 0) {
                console.warn(`[buildWeeklySplit] Could not map priority "${priority}" to body parts`);
                continue; // Skip if we can't map it
            }
            prioritySessions.push({
                dayOfWeek: "",
                bodyParts: mappedParts,
                intensity: i === 0 ? "heavy" : i === 1 ? "moderate" : "light",
            });
        }
    }

    // Distribute intensity based on intensity_distribution from execution config or strategy
    const totalIntensity = intensityDistribution.heavy +
        intensityDistribution.moderate +
        intensityDistribution.light;
    const heavyCount = Math.round((intensityDistribution.heavy / totalIntensity) * prioritySessions.length);
    const moderateCount = Math.round((intensityDistribution.moderate / totalIntensity) * prioritySessions.length);

    // Assign intensities
    for (let i = 0; i < prioritySessions.length; i++) {
        if (i < heavyCount) {
            prioritySessions[i].intensity = "heavy";
        } else if (i < heavyCount + moderateCount) {
            prioritySessions[i].intensity = "moderate";
        } else {
            prioritySessions[i].intensity = "light";
        }
    }

    // Add secondary support sessions
    const secondarySessions: WeeklySession[] = strategy.secondary_support
        .map((priority) => {
            const mappedParts = mapTrainingPriorityToBodyParts(priority);
            if (mappedParts.length === 0) {
                return null;
            }
            return {
                dayOfWeek: "",
                bodyParts: mappedParts,
                intensity: "moderate" as const,
            };
        })
        .filter((session) => session !== null) as WeeklySession[];

    // Combine and assign days, spacing them out evenly (not consecutive)
    const allSessions = [...prioritySessions, ...secondarySessions].slice(0, sessionsPerWeek);
    const numSessions = allSessions.length;
    if (numSessions > 0) {
        // Distribute sessions evenly across the week
        for (let i = 0; i < numSessions; i++) {
            const dayIndex = Math.floor((i * 7) / numSessions);
            allSessions[i].dayOfWeek = daysOfWeek[dayIndex];
        }
    }

    return allSessions;
}


/**
 * @deprecated - generateWorkoutsFromStrategy removed - use generateDailyWorkoutAndMeals instead
 * Function body removed - was ~360 lines
 */
// generateWorkoutsFromStrategy function removed - use generateDailyWorkoutAndMeals instead

/**
 * Helper queries and mutations for workout generation
 */
export const getPlanById = query({
    args: { planId: v.id("plans") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.planId);
    },
});

/**
 * Query to get plan with creation time
 */
export const getPlanWithCreationTime = query({
    args: { planId: v.id("plans") },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) return null;
        return {
            ...plan,
            _creationTime: plan._creationTime,
        };
    },
});

/**
 * Query to get workout sessions by plan and date
 */
export const getWorkoutSessionsByPlanAndDate = query({
    args: {
        userId: v.id("users"),
        date: v.string(),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_and_date", (q) =>
                q.eq("userId", args.userId).eq("date", args.date)
            )
            .first();

        return session || null;
    },
});

/**
 * Select random exercises from a category pool, avoiding duplicates
 * This replaces the deterministic selection with true randomization
 */
export const selectRandomExercisesForCategory = query({
    args: {
        bodyParts: v.array(v.string()),
        isCompound: v.optional(v.boolean()),
        count: v.number(),
        excludeExerciseIds: v.array(v.id("exercises")),
        userId: v.optional(v.id("users")), // To exclude blocked exercises
    },
    handler: async (ctx, args) => {
        const excludeSet = new Set(args.excludeExerciseIds);
        const usedNames = new Set<string>();

        // Get blocked exercises for this user
        const blockedExerciseIds = new Set<Id<"exercises">>();
        if (args.userId !== undefined) {
            const userId: Id<"users"> = args.userId;
            const blockedItems = await ctx.db
                .query("blocked_items")
                .withIndex("by_user_id", (q) => q.eq("userId", userId))
                .filter((q) => q.eq(q.field("itemType"), "exercise"))
                .collect();
            blockedItems.forEach((item) => {
                if (item.itemId) {
                    blockedExerciseIds.add(item.itemId as Id<"exercises">);
                }
            });
        }

        // Collect all matching exercises
        const candidateExercises: Exercise[] = [];
        const bodyPartLower = args.bodyParts.map(bp => bp.toLowerCase());

        for (const bodyPart of args.bodyParts) {
            const bodyPartLowercase = bodyPart.toLowerCase();

            // Query by bodyPart index (for backward compatibility)
            let exercises = await ctx.db
                .query("exercises")
                .withIndex("by_body_part", (q) => q.eq("bodyPart", bodyPartLowercase))
                .collect();

            // Also get all exercises and filter by bodyParts array
            const allExercises = await ctx.db.query("exercises").collect();
            const exercisesByBodyParts = allExercises.filter(
                (e) => e.bodyParts && e.bodyParts.some(bp => bp.toLowerCase() === bodyPartLowercase)
            );

            // Combine and deduplicate
            const exerciseMap = new Map<string, typeof exercises[0]>();
            for (const ex of [...exercises, ...exercisesByBodyParts]) {
                exerciseMap.set(ex._id, ex);
            }
            exercises = Array.from(exerciseMap.values());

            // Filter by compound if specified
            if (args.isCompound !== undefined) {
                exercises = exercises.filter((e) => e.isCompound === args.isCompound);
            }

            // Prefer compound exercises if isCompound is true but we need more
            if (args.isCompound === true && exercises.length < args.count) {
                // Already have all exercises, no need to query again
            }

            candidateExercises.push(...exercises);
        }

        // Filter out excluded exercises, blocked exercises, and duplicates
        const available = candidateExercises.filter(
            (e) => !excludeSet.has(e._id) &&
                !blockedExerciseIds.has(e._id) &&
                !usedNames.has(e.name.toLowerCase())
        );

        // Remove duplicates by name
        const uniqueExercises: Exercise[] = [];
        const seenNames = new Set<string>();
        for (const exercise of available) {
            const nameKey = exercise.name.toLowerCase();
            if (!seenNames.has(nameKey)) {
                seenNames.add(nameKey);
                uniqueExercises.push(exercise);
            }
        }

        // Get recently used exercises for recency bias (last 14 days)
        const recentlyUsedExercises = new Set<Id<"exercises">>();
        if (args.userId !== undefined) {
            const userId: Id<"users"> = args.userId;
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            const twoWeeksAgoStr = twoWeeksAgo.toISOString().split("T")[0];

            const recentSessions = await ctx.db
                .query("workout_sessions")
                .withIndex("by_user_id", (q) => q.eq("userId", userId))
                .filter((q) => q.gte(q.field("date"), twoWeeksAgoStr))
                .collect();

            for (const session of recentSessions) {
                const sets = await ctx.db
                    .query("exercise_sets")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .collect();
                sets.forEach((set) => recentlyUsedExercises.add(set.exerciseId));
            }
        }

        // Weight exercises: recently used get lower weight
        const weightedExercises = uniqueExercises.map((exercise) => ({
            exercise,
            weight: recentlyUsedExercises.has(exercise._id) ? 0.3 : 1.0,
        }));

        // Weighted random selection
        const selected: Id<"exercises">[] = [];
        const remaining = [...weightedExercises];

        while (selected.length < args.count && remaining.length > 0) {
            const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
            let random = Math.random() * totalWeight;

            for (let i = 0; i < remaining.length; i++) {
                random -= remaining[i].weight;
                if (random <= 0) {
                    selected.push(remaining[i].exercise._id);
                    remaining.splice(i, 1);
                    break;
                }
            }
        }

        return selected;
    },
});

/**
 * Legacy function for backward compatibility
 * @deprecated Use selectRandomExercisesForCategory instead
 */
export const selectExercisesForBodyParts = query({
    args: {
        bodyParts: v.array(v.string()),
        count: v.number(),
    },
    handler: async (ctx, args): Promise<Id<"exercises">[]> => {
        // Implement directly to avoid circular reference
        const selected: Id<"exercises">[] = [];
        const used = new Set<string>();

        for (const bodyPart of args.bodyParts) {
            const compoundExercises = await ctx.db
                .query("exercises")
                .withIndex("by_body_part", (q) => q.eq("bodyPart", bodyPart.toLowerCase()))
                .filter((q) => q.eq(q.field("isCompound"), true))
                .collect();

            const allExercises = compoundExercises.length < args.count
                ? await ctx.db
                    .query("exercises")
                    .withIndex("by_body_part", (q) => q.eq("bodyPart", bodyPart.toLowerCase()))
                    .collect()
                : compoundExercises;

            // Shuffle for randomization
            const shuffled = [...allExercises].sort(() => Math.random() - 0.5);

            for (const exercise of shuffled) {
                if (selected.length >= args.count) break;
                if (!used.has(exercise.name.toLowerCase())) {
                    selected.push(exercise._id);
                    used.add(exercise.name.toLowerCase());
                }
            }
        }

        return selected.slice(0, args.count);
    },
});

export const calculateProgressionForExercise = query({
    args: {
        userId: v.id("users"),
        exerciseId: v.id("exercises"),
        targetReps: v.number(),
    },
    handler: async (ctx, args) => {
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();

        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .filter((q) => q.eq(q.field("exerciseId"), args.exerciseId))
                .filter((q) => q.eq(q.field("completed"), true))
                .order("desc")
                .collect();

            if (sets.length > 0) {
                const lastSet = sets[0];
                if (lastSet.actualWeight && lastSet.actualReps) {
                    const lastWeight = lastSet.actualWeight;
                    const lastReps = lastSet.actualReps;
                    const rpe = lastSet.actualRPE;

                    let increasePercent: number;

                    if (rpe !== undefined) {
                        if (rpe <= 7) {
                            increasePercent = lastReps >= args.targetReps ? 0.05 : 0.04;
                        } else if (rpe >= 9) {
                            increasePercent = lastReps >= args.targetReps ? 0.01 : 0.0;
                        } else {
                            increasePercent = lastReps >= args.targetReps ? 0.03 : 0.02;
                        }
                    } else {
                        if (lastReps >= args.targetReps) {
                            increasePercent = 0.03;
                        } else if (lastReps < args.targetReps * 0.8) {
                            return { weight: lastWeight, reps: args.targetReps };
                        } else {
                            increasePercent = 0.02;
                        }
                    }

                    const newWeight = Math.round(lastWeight * (1 + increasePercent) / 2.5) * 2.5;
                    return { weight: newWeight, reps: args.targetReps };
                }
            }
        }

        return { weight: 50, reps: args.targetReps };
    },
});

export const createWorkoutSession = mutation({
    args: {
        userId: v.id("users"),
        goalId: v.optional(v.id("goals")), // Link workout to specific goal (required for new workouts)
        date: v.string(),
        dayOfWeek: v.optional(v.string()),
        intensity: v.string(),
        workoutType: v.union(
            v.literal("main"),
            v.literal("stretch"),
            v.literal("cardio"),
            v.literal("endurance")
        ),
        workoutExplanation: v.optional(v.string()),
        mealExplanation: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check for duplicate workout session (same user, same date, same type, same goal)
        // Allow multiple sessions per day if they have different types or goals
        const existingSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_and_date", (q) =>
                q.eq("userId", args.userId)
                    .eq("date", args.date)
            )
            .collect();

        const existingSession = existingSessions.find(
            (s) => s.workoutType === args.workoutType &&
                (args.goalId ? s.goalId === args.goalId : !s.goalId) // Match goalId if provided, or match sessions without goalId
        );

        if (existingSession) {
            throw new Error(`A ${args.workoutType} workout session already exists for date ${args.date}${args.goalId ? ` and goal ${args.goalId}` : ""}`);
        }

        if (!args.goalId) {
            throw new Error("goalId is required for new workout sessions");
        }

        return await ctx.db.insert("workout_sessions", {
            userId: args.userId,
            goalId: args.goalId,
            date: args.date,
            dayOfWeek: args.dayOfWeek,
            intensity: args.intensity,
            workoutType: args.workoutType,
            workoutExplanation: args.workoutExplanation,
            mealExplanation: args.mealExplanation,
        });
    },
});

export const createExerciseSet = mutation({
    args: {
        sessionId: v.id("workout_sessions"),
        exerciseId: v.id("exercises"),
        plannedWeight: v.number(),
        plannedReps: v.number(),
        setNumber: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("exercise_sets", {
            ...args,
            completed: false,
        });
    },
});

/**
 * Query to get workouts for a date range (history only - no future dates)
 */
export const getWorkoutsByDateRange = query({
    args: {
        userId: v.id("users"),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args) => {
        console.log("[getWorkoutsByDateRange] Called with:", {
            userId: args.userId,
            startDate: args.startDate,
            endDate: args.endDate
        });

        // Get today's date to prevent future queries
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        // Ensure endDate is not in the future
        const effectiveEndDate = args.endDate > todayStr ? todayStr : args.endDate;

        // Get sessions for user in date range
        const allSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        console.log("[getWorkoutsByDateRange] Found", allSessions.length, "total sessions for user");

        // Filter sessions by date range (only past and today)
        let sessions = allSessions.filter(
            (s) => s.date >= args.startDate && s.date <= effectiveEndDate
        );

        // For today's date, only show workouts for active goal
        // For past dates, show all workouts (history)
        if (args.startDate <= todayStr && effectiveEndDate >= todayStr) {
            const activeGoal = await ctx.db
                .query("goals")
                .withIndex("by_user_and_active", (q) =>
                    q.eq("userId", args.userId).eq("isActive", true)
                )
                .first();

            if (activeGoal) {
                // Filter today's sessions to only show active goal's workouts
                sessions = sessions.filter(s => {
                    if (s.date === todayStr) {
                        return s.goalId === activeGoal._id;
                    }
                    return true; // Keep all past workouts
                });
                console.log("[getWorkoutsByDateRange] Filtered today's sessions to active goal:", activeGoal._id);
            }
        }

        console.log("[getWorkoutsByDateRange] Filtered to", sessions.length, "sessions in date range");
        if (sessions.length > 0) {
            console.log("[getWorkoutsByDateRange] Session dates:", sessions.map(s => ({
                date: s.date,
                workoutType: s.workoutType,
                goalId: s.goalId,
                hasExercises: "checking..."
            })));
        }

        const workouts = await Promise.all(
            sessions.map(async (session) => {
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

                // Get daily meals for this session
                const dailyMeals = await ctx.db
                    .query("daily_meals")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .order("asc")
                    .collect();

                const meals = await Promise.all(
                    dailyMeals.map(async (dm) => {
                        const meal = await ctx.db.get(dm.mealId);
                        return {
                            ...dm,
                            meal,
                        };
                    })
                );

                return {
                    ...session,
                    exercises,
                    meals,
                };
            })
        );

        return workouts;
    },
});

/**
 * Query to get workout by date (for a specific date)
 */
export const getWorkoutByDate = query({
    args: {
        userId: v.id("users"),
        date: v.string(),
    },
    handler: async (ctx, args) => {
        console.log("[getWorkoutByDate] Called with:", { userId: args.userId, date: args.date });

        // Get active goal first
        const activeGoal = await ctx.db
            .query("goals")
            .withIndex("by_user_and_active", (q) =>
                q.eq("userId", args.userId).eq("isActive", true)
            )
            .first();

        if (!activeGoal) {
            console.log("[getWorkoutByDate] No active goal, returning null");
            return null;
        }

        // Get sessions for this date and filter by active goal
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_and_date", (q) =>
                q.eq("userId", args.userId).eq("date", args.date)
            )
            .collect();

        // Get main workout session for active goal
        // If no session found for active goal, return null (don't show old workouts without goalId)
        const session = sessions.find(s => s.goalId === activeGoal._id && s.workoutType === "main") ||
            sessions.find(s => s.goalId === activeGoal._id) ||
            null;

        console.log("[getWorkoutByDate] Session found:", session ? {
            _id: session._id,
            date: session.date,
            workoutType: session.workoutType
        } : "null");

        if (!session) {
            // Check all sessions for this user to see what dates exist
            const allUserSessions = await ctx.db
                .query("workout_sessions")
                .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
                .collect();
            console.log("[getWorkoutByDate] User has", allUserSessions.length, "total sessions");
            if (allUserSessions.length > 0) {
                const dates = allUserSessions.map(s => s.date).slice(0, 5);
                console.log("[getWorkoutByDate] Sample session dates:", dates);
            }
            return null;
        }

        // Get exercises and sets
        const sets = await ctx.db
            .query("exercise_sets")
            .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
            .collect();

        console.log("[getWorkoutByDate] Found", sets.length, "sets for session");

        const exercises = await Promise.all(
            sets.map(async (set) => {
                const exercise = await ctx.db.get(set.exerciseId);
                if (!exercise) {
                    console.warn("[getWorkoutByDate] Exercise not found for set:", set.exerciseId);
                }
                return {
                    ...set,
                    exercise,
                };
            })
        );

        // Get daily meals for this session
        const dailyMeals = await ctx.db
            .query("daily_meals")
            .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
            .order("asc")
            .collect();

        const meals = await Promise.all(
            dailyMeals.map(async (dm) => {
                const meal = await ctx.db.get(dm.mealId);
                return {
                    ...dm,
                    meal,
                };
            })
        );

        return {
            ...session,
            exercises,
            meals,
        };
    },
});

/**
 * Query to get workout history (all past workouts)
 */
export const getWorkoutHistory = query({
    args: {
        userId: v.id("users"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        // Get all sessions up to today
        const allSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.lte(q.field("date"), todayStr))
            .order("desc")
            .collect();

        const workouts = await Promise.all(
            allSessions.map(async (session) => {
                const sets = await ctx.db
                    .query("exercise_sets")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .collect();

                // Only include workouts where all sets are completed
                const allSetsCompleted = sets.length > 0 && sets.every((set) => set.completed);
                if (!allSetsCompleted) {
                    return null;
                }

                const exercises = await Promise.all(
                    sets.map(async (set) => {
                        const exercise = await ctx.db.get(set.exerciseId);
                        return {
                            ...set,
                            exercise,
                        };
                    })
                );

                // Get daily meals for this session
                const dailyMeals = await ctx.db
                    .query("daily_meals")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .order("asc")
                    .collect();

                const meals = await Promise.all(
                    dailyMeals.map(async (dm) => {
                        const meal = await ctx.db.get(dm.mealId);
                        return {
                            ...dm,
                            meal,
                        };
                    })
                );

                // Calculate completion metrics
                const completedSets = sets.filter((set) => set.completed).length;
                const totalSets = sets.length;
                const completionRate = totalSets > 0 ? completedSets / totalSets : 0;

                return {
                    ...session,
                    exercises,
                    meals,
                    completedSets,
                    totalSets,
                    completionRate,
                };
            })
        );

        // Filter out null values (incomplete workouts) and apply limit
        const completedWorkouts = workouts.filter((w): w is NonNullable<typeof w> => w !== null);
        return args.limit ? completedWorkouts.slice(0, args.limit) : completedWorkouts;
    },
});

/**
 * Query to get meal history
 */
export const getMealHistory = query({
    args: {
        userId: v.id("users"),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Get meal logs
        let mealLogsQuery = ctx.db
            .query("meal_logs")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId));

        if (args.startDate && args.endDate) {
            mealLogsQuery = mealLogsQuery.filter((q) =>
                q.and(
                    q.gte(q.field("date"), args.startDate!),
                    q.lte(q.field("date"), args.endDate!)
                )
            );
        }

        const mealLogs = await mealLogsQuery
            .order("desc")
            .collect();

        // Get meals from workout sessions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        const startDate = args.startDate || "1970-01-01";
        const endDate = args.endDate || todayStr;

        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.and(
                q.gte(q.field("date"), startDate),
                q.lte(q.field("date"), endDate)
            ))
            .collect();

        const sessionMeals = await Promise.all(
            sessions.map(async (session) => {
                const dailyMeals = await ctx.db
                    .query("daily_meals")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .collect();

                return dailyMeals.map(async (dm) => {
                    const meal = await ctx.db.get(dm.mealId);
                    return {
                        date: session.date,
                        mealType: dm.mealType,
                        meal,
                        completed: dm.completed,
                    };
                });
            })
        );

        const flatSessionMeals = (await Promise.all(sessionMeals.flat())).filter(Boolean);

        return {
            mealLogs,
            sessionMeals: flatSessionMeals,
        };
    },
});

/**
 * Query to get all workout sessions for a user (for debugging)
 */
export const getAllWorkoutSessions = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const allSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        return allSessions.map(session => ({
            _id: session._id,
            date: session.date,
            intensity: session.intensity,
            dayOfWeek: session.dayOfWeek,
        }));
    },
});

/**
 * Mutation to create a single exercise
 */
export const createExercise = mutation({
    args: {
        name: v.string(),
        bodyPart: v.optional(v.string()), // Kept for backward compatibility
        bodyParts: v.array(v.string()), // Array of body parts this exercise targets
        isCompound: v.boolean(),
        equipment: v.optional(v.string()),
        instructions: v.optional(v.array(v.string())),
        tutorialImage: v.optional(v.string()), // URL or path to tutorial image/video
    },
    handler: async (ctx, args) => {
        // Normalize body parts to lowercase
        const bodyParts = args.bodyParts.map(bp => bp.toLowerCase());
        // Set bodyPart to first body part for backward compatibility with index
        const bodyPart = bodyParts.length > 0 ? bodyParts[0] : args.bodyPart?.toLowerCase();

        return await ctx.db.insert("exercises", {
            name: args.name,
            bodyPart: bodyPart,
            bodyParts: bodyParts,
            isCompound: args.isCompound,
            equipment: args.equipment,
            instructions: args.instructions,
            tutorialImage: args.tutorialImage,
        });
    },
});

/**
 * Action to import exercises from JSON data
 */
export const importExercises = action({
    args: {
        exercises: v.array(
            v.object({
                name: v.string(),
                bodyPart: v.optional(v.string()), // Kept for backward compatibility
                bodyParts: v.array(v.string()), // Array of body parts
                isCompound: v.boolean(),
                equipment: v.optional(v.string()),
                instructions: v.optional(v.array(v.string())),
                tutorialImage: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        imported: number;
        failed: number;
        results: Array<{ id: Id<"exercises">; name: string }>;
        errors: Array<{ exercise: string; error: string }>;
    }> => {
        const results: Array<{ id: Id<"exercises">; name: string }> = [];
        const errors: Array<{ exercise: string; error: string }> = [];

        for (const exercise of args.exercises) {
            try {
                // Check if exercise already exists
                const existing = await ctx.runQuery(api.plans.getExerciseByName, {
                    name: exercise.name,
                });

                if (existing) {
                    errors.push({
                        exercise: exercise.name,
                        error: "Exercise already exists",
                    });
                    continue;
                }

                // Derive bodyPart from bodyParts if not provided (for backward compatibility)
                // bodyParts is required and should have at least one element
                // Use the first body part as the primary bodyPart for indexing
                if (!exercise.bodyParts || exercise.bodyParts.length === 0) {
                    errors.push({
                        exercise: exercise.name,
                        error: "bodyParts array is required and must have at least one element",
                    });
                    continue;
                }

                // Ensure bodyPart is always a string (never undefined)
                // This is required for backward compatibility with the database index
                const bodyPart: string = exercise.bodyPart || exercise.bodyParts[0];

                const id = await ctx.runMutation(api.plans.createExercise, {
                    name: exercise.name,
                    bodyPart: bodyPart, // Always a string, never undefined
                    bodyParts: exercise.bodyParts,
                    isCompound: exercise.isCompound,
                    equipment: exercise.equipment,
                    instructions: exercise.instructions,
                    tutorialImage: exercise.tutorialImage,
                });

                results.push({ id, name: exercise.name });
            } catch (error) {
                errors.push({
                    exercise: exercise.name,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return {
            success: true,
            imported: results.length,
            failed: errors.length,
            results,
            errors,
        };
    },
});

/**
 * Query to get exercise by name
 */
export const getExerciseByName = query({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const allExercises = await ctx.db.query("exercises").collect();
        return allExercises.find(
            (e) => e.name.toLowerCase() === args.name.toLowerCase()
        );
    },
});

/**
 * Query to get all exercises
 */
export const getAllExercises = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("exercises").collect();
    },
});

/**
 * Query wrapper for RAG: Get exercise context with minimal fields
 */
export const getExerciseContextForRAG = query({
    args: {
        bodyPart: v.optional(v.string()),
        exerciseName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let exercises = await ctx.db.query("exercises").collect();

        // Apply filters if provided
        if (args.exerciseName) {
            const nameLower = args.exerciseName.toLowerCase();
            exercises = exercises.filter((e) =>
                e.name.toLowerCase().includes(nameLower)
            );
        }

        if (args.bodyPart) {
            const bodyPartLower = args.bodyPart.toLowerCase();
            exercises = exercises.filter(
                (e) => e.bodyPart && e.bodyPart.toLowerCase() === bodyPartLower
            );
        }

        // Return only minimal fields
        return exercises.map((exercise) => ({
            _id: exercise._id,
            name: exercise.name,
            bodyPart: exercise.bodyPart,
            equipment: exercise.equipment,
            isCompound: exercise.isCompound,
        }));
    },
});

/**
 * Query wrapper for RAG: Get training strategy context
 */
export const getTrainingStrategyContextForRAG = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        // Get active plan for user
        const activePlan = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!activePlan) {
            return null;
        }

        // Prefer trainingStrategy, fall back to executionConfig
        const strategy = activePlan.trainingStrategy;
        const executionConfig = activePlan.executionConfig;

        // Get split from trainingStrategy or executionConfig
        const split =
            strategy?.split_type || executionConfig?.split_type || undefined;

        // Get intensity distribution from trainingStrategy or executionConfig
        const intensityDistribution =
            strategy?.intensity_distribution ||
            executionConfig?.intensity_distribution ||
            { heavy: 0, moderate: 0, light: 0 };

        // Get goal and focus from trainingStrategy
        const goal = strategy?.goal_type || "";
        const focus = strategy?.primary_focus || "";

        return {
            goal,
            split,
            intensityDistribution: {
                heavy: intensityDistribution.heavy,
                moderate: intensityDistribution.moderate,
                light: intensityDistribution.light,
            },
            focus,
        };
    },
});

/**
 * Query to get exercise count by body part
 */
export const getExerciseStats = query({
    args: {},
    handler: async (ctx) => {
        const allExercises = await ctx.db.query("exercises").collect();
        const stats: Record<string, { total: number; compound: number }> = {};

        for (const exercise of allExercises) {
            const bodyPart = exercise.bodyPart;
            if (!bodyPart) continue;
            if (!stats[bodyPart]) {
                stats[bodyPart] = { total: 0, compound: 0 };
            }
            stats[bodyPart].total++;
            if (exercise.isCompound) {
                stats[bodyPart].compound++;
            }
        }

        return {
            total: allExercises.length,
            byBodyPart: stats,
        };
    },
});

/**
 * Select random meals for a day, avoiding duplicates within the same week
 * Filters by mealType to ensure appropriate meals for breakfast/lunch/dinner
 * Optimized for performance to avoid timeouts
 */
export const selectRandomMealsForDay = query({
    args: {
        targetCalories: v.number(),
        mealCount: v.number(), // Number of meals per day (typically 3-4)
        excludeMealIds: v.array(v.id("meals")),
        mealTypes: v.array(v.string()), // ["breakfast", "lunch", "dinner"] - one per meal
        userId: v.optional(v.id("users")), // To exclude blocked meals
    },
    handler: async (ctx, args): Promise<Id<"meals">[]> => {
        const excludeSet = new Set(args.excludeMealIds);

        // Get blocked meals for this user (only if userId provided)
        const blockedMealIds = new Set<string>();
        if (args.userId !== undefined) {
            const userId: Id<"users"> = args.userId;
            const blockedItems = await ctx.db
                .query("blocked_items")
                .withIndex("by_user_id", (q) => q.eq("userId", userId))
                .filter((q) => q.eq(q.field("itemType"), "meal"))
                .collect();
            blockedItems.forEach((item) => {
                if (item.itemId) {
                    blockedMealIds.add(item.itemId);
                }
            });
        }

        // Get all meals (limit to reasonable number to avoid timeout)
        const allMeals = await ctx.db.query("meals").take(1000);

        // Filter meals: exclude blocked, excluded, and filter by mealType
        // Use early returns and efficient filtering
        const availableMeals: Array<{ _id: Id<"meals">; mealType?: string[] }> = [];
        for (const m of allMeals) {
            const mealIdStr = m._id as unknown as string;
            if (excludeSet.has(m._id)) continue;
            if (blockedMealIds.has(mealIdStr)) continue;

            // Check mealType matching
            const mealTypes = m.mealType || [];
            if (mealTypes.length === 0) {
                // Old meals without mealType can be used for any meal type
                availableMeals.push(m);
            } else if (args.mealTypes.some(requestedType => mealTypes.includes(requestedType))) {
                availableMeals.push(m);
            }
        }

        if (availableMeals.length === 0) {
            return [];
        }

        // Simple shuffle (Fisher-Yates) - more efficient than sort
        // Only shuffle if we have enough meals to warrant it
        if (availableMeals.length > args.mealCount) {
            for (let i = availableMeals.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableMeals[i], availableMeals[j]] = [availableMeals[j], availableMeals[i]];
            }
        }

        // Select one meal per mealType - simplified logic
        const selected: Id<"meals">[] = [];
        const usedMealTypes = new Set<string>();
        const selectedIds = new Set<string>();

        // First pass: try to match each mealType exactly
        for (const requestedType of args.mealTypes) {
            if (selected.length >= args.mealCount) break;

            for (const meal of availableMeals) {
                const mealIdStr = meal._id as unknown as string;
                if (selectedIds.has(mealIdStr)) continue;

                const mealTypes = meal.mealType || [];
                if (mealTypes.length === 0 || mealTypes.includes(requestedType)) {
                    selected.push(meal._id);
                    selectedIds.add(mealIdStr);
                    usedMealTypes.add(requestedType);
                    break;
                }
            }
        }

        // Second pass: fill remaining slots with any available meal
        if (selected.length < args.mealCount) {
            for (const meal of availableMeals) {
                if (selected.length >= args.mealCount) break;
                const mealIdStr = meal._id as unknown as string;
                if (!selectedIds.has(mealIdStr)) {
                    selected.push(meal._id);
                    selectedIds.add(mealIdStr);
                }
            }
        }

        return selected.slice(0, args.mealCount);
    },
});

/* =======================
   Meal Management
======================= */

/**
 * Mutation to create a single meal
 */
export const createMeal = mutation({
    args: {
        name: v.string(),
        foods: v.array(v.string()),
        calories: v.number(),
        instructions: v.array(v.string()),
        mealType: v.optional(v.array(v.string())), // ["breakfast"], ["lunch"], ["dinner"], ["snack"], or combinations
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("meals", {
            name: args.name,
            foods: args.foods,
            calories: args.calories,
            instructions: args.instructions,
            mealType: args.mealType || ["lunch"], // Default to lunch if not specified
        });
    },
});

/**
 * Query to get meal by name
 */
export const getMealByName = query({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const allMeals = await ctx.db.query("meals").collect();
        return allMeals.find(
            (m) => m.name.toLowerCase() === args.name.toLowerCase()
        );
    },
});

/**
 * Query to get all meals
 */
export const getAllMeals = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("meals").collect();
    },
});

/**
 * Query to get meal statistics
 */
export const getMealStats = query({
    args: {},
    handler: async (ctx) => {
        const allMeals = await ctx.db.query("meals").collect();

        const totalCalories = allMeals.reduce((sum, meal) => sum + meal.calories, 0);
        const avgCalories = allMeals.length > 0 ? Math.round(totalCalories / allMeals.length) : 0;

        const calorieRanges = {
            low: allMeals.filter(m => m.calories < 300).length,
            medium: allMeals.filter(m => m.calories >= 300 && m.calories < 600).length,
            high: allMeals.filter(m => m.calories >= 600).length,
        };

        return {
            total: allMeals.length,
            averageCalories: avgCalories,
            calorieRanges,
        };
    },
});

/**
 * Mutation to create a daily meal assignment
 */
export const createDailyMeal = mutation({
    args: {
        sessionId: v.id("workout_sessions"),
        mealId: v.id("meals"),
        mealType: v.string(),
        order: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("daily_meals", {
            ...args,
            completed: false,
        });
    },
});

/**
 * Query to get daily meals for a session
 */
export const getDailyMealsBySession = query({
    args: {
        sessionId: v.id("workout_sessions"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("daily_meals")
            .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
            .order("asc")
            .collect();
    },
});

/**
 * Query to get workout sessions by date range
 */
export const getWorkoutSessionsByDateRange = query({
    args: {
        userId: v.id("users"),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args) => {
        const allSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        return allSessions.filter(
            (s) => s.date >= args.startDate && s.date <= args.endDate
        );
    },
});

/**
 * Mutation to update exercise set with actual weight and reps
 */
export const updateExerciseSet = mutation({
    args: {
        setId: v.id("exercise_sets"),
        actualWeight: v.optional(v.number()),
        actualReps: v.optional(v.number()),
        actualRPE: v.optional(v.number()),
        completed: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const update: any = {};
        if (args.actualWeight !== undefined) update.actualWeight = args.actualWeight;
        if (args.actualReps !== undefined) update.actualReps = args.actualReps;
        if (args.actualRPE !== undefined) update.actualRPE = args.actualRPE;
        if (args.completed !== undefined) update.completed = args.completed;

        await ctx.db.patch(args.setId, update);
        return { success: true };
    },
});

/**
 * Mutation to mark a daily meal as complete
 */
export const markMealComplete = mutation({
    args: {
        dailyMealId: v.id("daily_meals"),
        completed: v.boolean(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.dailyMealId, { completed: args.completed });
        return { success: true };
    },
});

/**
 * @deprecated - generateNextWorkout removed - workouts are only generated for today
 * Function body removed - was ~220 lines
 */
// generateNextWorkout function removed - workouts are only generated for today

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
 * Query to get all available split types and their info
 */
export const getSplitTypes = query({
    args: {},
    handler: async (ctx) => {
        return {
            PPL: { name: "Push/Pull/Legs", daysPerWeek: 6 },
            UPPER_LOWER: { name: "Upper/Lower", daysPerWeek: 4 },
            FULL_BODY: { name: "Full Body", daysPerWeek: 3 },
            BRO_SPLIT: { name: "Bro Split", daysPerWeek: 5 },
            PUSH_PULL_LEGS_ARMS: { name: "Push/Pull/Legs/Arms", daysPerWeek: 4 },
            CHEST_BACK_SHOULDERS_ARMS_LEGS: { name: "Chest & Back / Shoulders & Arms / Legs", daysPerWeek: 3 },
        };
    },
});

/**
 * Query to get user's workout schedule (custom days or calculated)
 */
export const getUserWorkoutSchedule = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        const workoutsPerWeek = user.preferences?.workout_days_per_week as number | undefined;
        const customWorkoutDays = user.preferences?.custom_workout_days as number[] | undefined;

        const schedule = getWorkoutSchedule(workoutsPerWeek, customWorkoutDays);

        return {
            schedule,
            isCustom: !!(customWorkoutDays && customWorkoutDays.length > 0),
            workoutsPerWeek: customWorkoutDays && customWorkoutDays.length > 0
                ? customWorkoutDays.length
                : workoutsPerWeek,
        };
    },
});

/* =======================
   Block/Unblock Items
======================= */

/**
 * Mutation to block an exercise or meal for a user
 */
export const blockItem = mutation({
    args: {
        userId: v.id("users"),
        itemType: v.union(v.literal("exercise"), v.literal("meal")),
        itemId: v.union(v.id("exercises"), v.id("meals")),
        itemName: v.string(),
    },
    handler: async (ctx, args) => {
        // Convert itemId to string for storage
        const itemIdString = args.itemId as unknown as string;

        // Check if already blocked
        const existing = await ctx.db
            .query("blocked_items")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("itemType"), args.itemType))
            .collect();

        const alreadyBlocked = existing.find(
            (item) => item.itemId === itemIdString
        );

        if (alreadyBlocked) {
            return { success: true, alreadyBlocked: true };
        }

        await ctx.db.insert("blocked_items", {
            userId: args.userId,
            itemType: args.itemType,
            itemId: itemIdString,
            itemName: args.itemName,
        });

        return { success: true };
    },
});

/**
 * Mutation to unblock an exercise or meal for a user
 */
export const unblockItem = mutation({
    args: {
        userId: v.id("users"),
        itemType: v.union(v.literal("exercise"), v.literal("meal")),
        itemId: v.union(v.id("exercises"), v.id("meals")),
    },
    handler: async (ctx, args) => {
        const itemIdString = args.itemId as unknown as string;

        const blockedItems = await ctx.db
            .query("blocked_items")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("itemType"), args.itemType))
            .collect();

        const toDelete = blockedItems.find((item) => item.itemId === itemIdString);

        if (toDelete) {
            await ctx.db.delete(toDelete._id);
            return { success: true };
        }

        return { success: true, notFound: true };
    },
});

/**
 * Query to get blocked items for a user
 */
export const getBlockedItems = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("blocked_items")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

/* =======================
   Regenerate Items
======================= */

/**
 * Action to regenerate a single exercise in a workout (replace one exercise with a new one of the same body part)
 */
export const regenerateExercise = action({
    args: {
        exerciseSetId: v.id("exercise_sets"), // One set ID - we'll replace all sets for this exercise
        userId: v.id("users"),
        sessionId: v.id("workout_sessions"),
        reason: v.optional(v.string()),
        preferredExerciseId: v.optional(v.id("exercises")), // Optional: use this exercise instead of random selection
    },
    handler: async (ctx, args) => {
        // Get the exercise set to find the exercise
        const exerciseSet = await ctx.runQuery(api.plans.getExerciseSetById, {
            setId: args.exerciseSetId,
        });

        if (!exerciseSet) {
            throw new Error("Exercise set not found");
        }

        const oldExerciseId = exerciseSet.exerciseId;
        const oldExercise = await ctx.runQuery(api.plans.getExerciseById, {
            exerciseId: oldExerciseId,
        });

        if (!oldExercise) {
            throw new Error("Exercise not found");
        }

        const session = await ctx.runQuery(api.plans.getWorkoutSessionById, {
            sessionId: args.sessionId,
        });

        if (!session) {
            throw new Error("Session not found");
        }

        // Get all sets for this exercise in this session
        const allSetsForExercise = await ctx.runQuery(api.plans.getExerciseSetsBySession, {
            sessionId: args.sessionId,
        });

        const setsToReplace = allSetsForExercise.filter((s: any) => s.exerciseId === oldExerciseId);

        if (setsToReplace.length === 0) {
            throw new Error("No sets found for this exercise");
        }

        // Check if any sets being replaced are completed
        const hasCompletedSets = setsToReplace.some((s: any) => s.completed);
        if (hasCompletedSets) {
            throw new Error("Cannot regenerate exercise with completed sets");
        }

        // Log regeneration reason and timestamp
        console.log("[regenerateExercise] Regeneration triggered", {
            exerciseSetId: args.exerciseSetId,
            oldExerciseId,
            sessionId: args.sessionId,
            reason: args.reason || "user_requested",
            timestamp: new Date().toISOString(),
        });

        if (setsToReplace.length === 0) {
            throw new Error("No sets found for this exercise");
        }

        // Get exercises used this week to avoid duplicates
        const weekStart = new Date(session.date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekSessions = await ctx.runQuery(api.plans.getWorkoutsByDateRange, {
            userId: args.userId,
            startDate: weekStart.toISOString().split("T")[0],
            endDate: weekEnd.toISOString().split("T")[0],
        });

        const exercisesUsedThisWeek = new Set<Id<"exercises">>();
        for (const ws of weekSessions) {
            const sets = await ctx.runQuery(api.plans.getExerciseSetsBySession, {
                sessionId: ws._id,
            });
            sets.forEach((s: { exerciseId: Id<"exercises"> }) => exercisesUsedThisWeek.add(s.exerciseId));
        }

        // Get new exercise with same body part
        let newExerciseId: Id<"exercises">;

        if (args.preferredExerciseId) {
            // Use preferred exercise if provided (e.g., from RAG suggestion)
            const preferredExercise = await ctx.runQuery(api.plans.getExerciseById, {
                exerciseId: args.preferredExerciseId,
            });

            if (!preferredExercise) {
                throw new Error("Preferred exercise not found");
            }

            // Validate that preferred exercise matches body part
            const preferredBodyPart = preferredExercise.bodyPart || preferredExercise.bodyParts?.[0];
            const oldBodyPart = oldExercise.bodyPart || oldExercise.bodyParts?.[0];
            if (!preferredBodyPart || !oldBodyPart || preferredBodyPart.toLowerCase() !== oldBodyPart.toLowerCase()) {
                throw new Error("Preferred exercise does not match body part");
            }

            // Check if preferred exercise is already used this week
            if (exercisesUsedThisWeek.has(args.preferredExerciseId)) {
                throw new Error("Preferred exercise already used this week");
            }

            newExerciseId = args.preferredExerciseId;
        } else {
            // Default behavior: select random exercise
            const oldBodyParts = oldExercise.bodyParts && oldExercise.bodyParts.length > 0
                ? oldExercise.bodyParts
                : (oldExercise.bodyPart ? [oldExercise.bodyPart] : []);
            if (oldBodyParts.length === 0) {
                throw new Error("Exercise has no body part information");
            }
            const newExerciseIds = await ctx.runQuery(api.plans.selectRandomExercisesForCategory, {
                bodyParts: oldBodyParts,
                isCompound: session.intensity === "heavy" ? true : undefined,
                count: 1,
                excludeExerciseIds: Array.from(exercisesUsedThisWeek),
                userId: args.userId,
            }) as Id<"exercises">[];

            if (newExerciseIds.length === 0) {
                throw new Error("No available exercises found for this body part");
            }

            newExerciseId = newExerciseIds[0];
        }

        // Check for fatigue-based deload (simplified - no plan dependency)
        const fatigueCheck = await ctx.runQuery(api.plans.checkFatigueIndicators, {
            userId: args.userId,
            lookbackDays: 7,
        });
        const isDeloadWeek = fatigueCheck.shouldDeload ||
            (session.weekNumber !== undefined && session.weekNumber > 1 && session.weekNumber % 4 === 0);

        // Calculate progression for new exercise
        const targetReps = session.intensity === "heavy" ? 5 :
            session.intensity === "moderate" ? 8 : 12;
        const sets = session.intensity === "heavy" ? 4 : 3;

        const progression = await ctx.runQuery(api.plans.calculateProgressionForExercise, {
            userId: args.userId,
            exerciseId: newExerciseId,
            targetReps: isDeloadWeek ? targetReps + 2 : targetReps,
        });

        const weight = isDeloadWeek ? progression.weight * 0.9 : progression.weight;

        // Delete old sets
        for (const set of setsToReplace) {
            await ctx.runMutation(api.plans.deleteExerciseSet, {
                setId: set._id,
            });
        }

        // Create new sets with same set numbers
        for (const oldSet of setsToReplace) {
            await ctx.runMutation(api.plans.createExerciseSet, {
                sessionId: args.sessionId,
                exerciseId: newExerciseId,
                plannedWeight: weight,
                plannedReps: progression.reps,
                setNumber: oldSet.setNumber,
            });
        }

        return { success: true, newExerciseId };
    },
});

/**
 * Action to regenerate a meal for a specific daily meal
 */
export const regenerateMeal = action({
    args: {
        dailyMealId: v.id("daily_meals"),
        userId: v.id("users"),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const dailyMeal = await ctx.runQuery(api.plans.getDailyMealById, {
            dailyMealId: args.dailyMealId,
        });

        if (!dailyMeal) {
            throw new Error("Daily meal not found");
        }

        // Check if meal is completed
        if (dailyMeal.completed) {
            throw new Error("Cannot regenerate completed meal");
        }

        // Get session to find date and calculate target calories from active goal
        const session = await ctx.runQuery(api.plans.getWorkoutSessionById, {
            sessionId: dailyMeal.sessionId,
        });

        if (!session) {
            throw new Error("Session not found");
        }

        // Get active goal for target calories
        const activeGoal = await ctx.runQuery(api.goals.getActiveGoal, {
            userId: args.userId,
        });

        if (!activeGoal) {
            throw new Error("No active goal found");
        }

        // Calculate target calories from goal (simplified - use default if not available)
        const targetCalories = 2000; // Default, can be calculated from goal in future

        // Log regeneration reason and timestamp
        console.log("[regenerateMeal] Regeneration triggered", {
            dailyMealId: args.dailyMealId,
            mealId: dailyMeal.mealId,
            sessionId: dailyMeal.sessionId,
            reason: args.reason || "user_requested",
            timestamp: new Date().toISOString(),
        });

        const weekStart = new Date(session.date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekSessions = await ctx.runQuery(api.plans.getWorkoutSessionsByDateRange, {
            userId: args.userId,
            startDate: weekStart.toISOString().split("T")[0],
            endDate: weekEnd.toISOString().split("T")[0],
        });

        const mealsUsedThisWeek = new Set<Id<"meals">>();
        for (const ws of weekSessions) {
            const weekMeals = await ctx.runQuery(api.plans.getDailyMealsBySession, {
                sessionId: ws._id,
            });
            weekMeals.forEach((dm: any) => {
                if (dm._id !== args.dailyMealId) {
                    mealsUsedThisWeek.add(dm.mealId);
                }
            });
        }

        // Get new meal of same type
        const newMealIds = await ctx.runQuery(api.plans.selectRandomMealsForDay, {
            targetCalories: targetCalories,
            mealCount: 1,
            excludeMealIds: Array.from(mealsUsedThisWeek),
            mealTypes: [dailyMeal.mealType],
            userId: args.userId,
        }) as Id<"meals">[];

        if (newMealIds.length === 0) {
            throw new Error("No available meals found for this meal type");
        }

        // Update the daily meal with new meal
        await ctx.runMutation(api.plans.updateDailyMeal, {
            dailyMealId: args.dailyMealId,
            mealId: newMealIds[0],
        });

        return { success: true, newMealId: newMealIds[0] };
    },
});

/**
 * Helper queries for regenerate actions
 */
export const getDailyMealById = query({
    args: { dailyMealId: v.id("daily_meals") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.dailyMealId);
    },
});

export const updateDailyMeal = mutation({
    args: {
        dailyMealId: v.id("daily_meals"),
        mealId: v.id("meals"),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.dailyMealId, { mealId: args.mealId });
        return { success: true };
    },
});

export const getExerciseSetById = query({
    args: { setId: v.id("exercise_sets") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.setId);
    },
});

export const getExerciseSetsBySession = query({
    args: { sessionId: v.id("workout_sessions") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("exercise_sets")
            .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
            .collect();
    },
});

/**
 * Get or create a Running exercise for cardio/running workouts
 * This is an action so it can create the exercise if it doesn't exist
 */
export const getOrCreateRunningExercise = action({
    args: {},
    handler: async (ctx): Promise<Id<"exercises">> => {
        // Try to find existing Running exercise (case-insensitive)
        const exercises = await ctx.runQuery(api.plans.getAllExercises, {});

        const runningExercise = exercises.find((e: any) =>
            e.name.toLowerCase() === "running" ||
            e.name.toLowerCase() === "run" ||
            (e.bodyPart?.toLowerCase() === "cardio" && e.name?.toLowerCase().includes("run"))
        );

        if (runningExercise) {
            return runningExercise._id;
        }

        // If not found, create it
        const exerciseId = await ctx.runMutation(api.plans.createExercise, {
            name: "Running",
            bodyParts: ["cardio"],
            isCompound: false,
            equipment: "none",
            instructions: ["Run at a steady pace", "Maintain proper running form", "Focus on breathing rhythm"],
        });

        return exerciseId;
    },
});

export const getExerciseById = query({
    args: { exerciseId: v.id("exercises") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.exerciseId);
    },
});

export const deleteExerciseSet = mutation({
    args: { setId: v.id("exercise_sets") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.setId);
        return { success: true };
    },
});

/**
 * Mutation to update split type for a plan
 */
export const updatePlanSplitType = mutation({
    args: {
        planId: v.id("plans"),
        splitType: v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS"), v.literal("CHEST_BACK_SHOULDERS_ARMS_LEGS")),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan || !plan.trainingStrategy) {
            throw new Error("Plan or training strategy not found");
        }

        const updatedStrategy = {
            ...plan.trainingStrategy,
            split_type: args.splitType,
        };

        await ctx.db.patch(args.planId, {
            trainingStrategy: updatedStrategy,
        });

        return { success: true };
    },
});

export const updateWorkoutPlanSchedule = mutation({
    args: {
        planId: v.id("plans"),
        schedule: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const plan = await ctx.db.get(args.planId);
        if (!plan) {
            throw new Error("Plan not found");
        }

        await ctx.db.patch(args.planId, {
            workoutPlan: {
                ...plan.workoutPlan,
                schedule: args.schedule,
            },
        });

        return { success: true };
    },
});

/**
 * @deprecated - changePlanSplit removed - plans are deprecated
 */
// changePlanSplit function removed - plans are deprecated

/**
 * Helper to delete future workouts for a plan starting from a given date
 */
export const deleteFutureWorkouts = mutation({
    args: {
        userId: v.id("users"),
        startDate: v.string(),
    },
    handler: async (ctx, args) => {
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        for (const session of sessions) {
            // Only delete sessions on or after startDate
            if (session.date >= args.startDate) {
                // Delete exercise sets
                const sets = await ctx.db
                    .query("exercise_sets")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .collect();
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
            }
        }

        return { success: true };
    },
});

/**
 * Helper queries and mutations for split change
 */
export const getWorkoutSessionsByPlan = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

export const deleteWorkoutSession = mutation({
    args: { sessionId: v.id("workout_sessions") },
    handler: async (ctx, args) => {
        // Delete exercise sets
        const sets = await ctx.db
            .query("exercise_sets")
            .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
            .collect();
        for (const set of sets) {
            await ctx.db.delete(set._id);
        }

        // Delete daily meals
        const meals = await ctx.db
            .query("daily_meals")
            .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
            .collect();
        for (const meal of meals) {
            await ctx.db.delete(meal._id);
        }

        // Delete the session
        await ctx.db.delete(args.sessionId);
        return { success: true };
    },
});

/**
 * @deprecated - getAllDailyMealsByPlan removed - use getMealHistory instead
 */
// getAllDailyMealsByPlan function removed - plans are deprecated

export const deleteDailyMeal = mutation({
    args: { dailyMealId: v.id("daily_meals") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.dailyMealId);
        return { success: true };
    },
});

/**
 * Action to import meals from JSON data
 */
export const importMeals = action({
    args: {
        meals: v.array(
            v.object({
                name: v.string(),
                foods: v.array(v.string()),
                calories: v.number(),
                instructions: v.array(v.string()),
                mealType: v.optional(v.array(v.string())), // Optional, defaults to ["lunch"]
            })
        ),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        imported: number;
        failed: number;
        results: Array<{ id: Id<"meals">; name: string }>;
        errors: Array<{ meal: string; error: string }>;
    }> => {
        const results: Array<{ id: Id<"meals">; name: string }> = [];
        const errors: Array<{ meal: string; error: string }> = [];

        for (const meal of args.meals) {
            try {
                // Check if meal already exists
                const existing = await ctx.runQuery(api.plans.getMealByName, {
                    name: meal.name,
                });

                if (existing) {
                    errors.push({
                        meal: meal.name,
                        error: "Meal already exists",
                    });
                    continue;
                }

                const id = await ctx.runMutation(api.plans.createMeal, {
                    name: meal.name,
                    foods: meal.foods,
                    calories: meal.calories,
                    instructions: meal.instructions,
                    mealType: meal.mealType || ["lunch"], // Default to lunch if not specified
                });

                results.push({ id, name: meal.name });
            } catch (error) {
                errors.push({
                    meal: meal.name,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return {
            success: true,
            imported: results.length,
            failed: errors.length,
            results,
            errors,
        };
    },
});

/**
 * Query to get exercise progress over time for a user
 */
export const getExerciseProgress = query({
    args: {
        userId: v.id("users"),
        exerciseId: v.id("exercises"),
    },
    handler: async (ctx, args) => {
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .order("asc")
            .collect();

        const progress: Array<{
            date: string;
            maxWeight: number;
            avgReps: number;
            totalVolume: number;
            setsCompleted: number;
        }> = [];
        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .filter((q) => q.eq(q.field("exerciseId"), args.exerciseId))
                .filter((q) => q.eq(q.field("completed"), true))
                .collect();

            if (sets.length > 0) {
                const maxWeight = Math.max(...sets.map((s) => s.actualWeight || s.plannedWeight));
                const avgReps = sets.reduce((sum, s) => sum + (s.actualReps || s.plannedReps), 0) / sets.length;
                const totalVolume = sets.reduce(
                    (sum, s) => sum + (s.actualWeight || s.plannedWeight) * (s.actualReps || s.plannedReps),
                    0
                );

                progress.push({
                    date: session.date,
                    maxWeight,
                    avgReps: Math.round(avgReps * 10) / 10,
                    totalVolume,
                    setsCompleted: sets.length,
                });
            }
        }

        return progress;
    },
});

/**
 * Query to get all exercises with progress data for a user
 */
export const getAllExerciseProgress = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .order("asc")
            .collect();

        type ExerciseProgressData = {
            exercise: any;
            progress: Array<{
                date: string;
                weight: number;
                reps: number;
                volume: number;
            }>;
            latestWeight: number;
            latestDate: string;
        };

        const exerciseMap = new Map<string, ExerciseProgressData>();

        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .filter((q) => q.eq(q.field("completed"), true))
                .collect();

            for (const set of sets) {
                const exercise = await ctx.db.get(set.exerciseId);
                if (!exercise) continue;

                const key = exercise._id;
                if (!exerciseMap.has(key)) {
                    exerciseMap.set(key, {
                        exercise,
                        progress: [],
                        latestWeight: 0,
                        latestDate: "",
                    });
                }

                const data = exerciseMap.get(key)!;
                const weight = set.actualWeight || set.plannedWeight;
                const reps = set.actualReps || set.plannedReps;

                if (session.date > data.latestDate) {
                    data.latestDate = session.date;
                    data.latestWeight = weight;
                }

                data.progress.push({
                    date: session.date,
                    weight,
                    reps,
                    volume: weight * reps,
                });
            }
        }

        return Array.from(exerciseMap.values()).map((data) => ({
            exercise: data.exercise,
            latestWeight: data.latestWeight,
            latestDate: data.latestDate,
            totalSessions: new Set(data.progress.map((p: any) => p.date)).size,
        }));
    },
});

/**
 * Query to get body part strength analysis
 */
export const getBodyPartStrength = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .order("desc")
            .take(30); // Last 30 sessions

        const bodyPartMap = new Map<string, { totalVolume: number; sessions: number; exercises: Set<string> }>();

        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .filter((q) => q.eq(q.field("completed"), true))
                .collect();

            for (const set of sets) {
                const exercise = await ctx.db.get(set.exerciseId);
                if (!exercise) continue;

                // Use bodyPart if available, otherwise use first bodyParts element
                const bodyPart = exercise.bodyPart || (exercise.bodyParts && exercise.bodyParts.length > 0 ? exercise.bodyParts[0] : null);
                if (!bodyPart) continue; // Skip if no body part available

                if (!bodyPartMap.has(bodyPart)) {
                    bodyPartMap.set(bodyPart, {
                        totalVolume: 0,
                        sessions: 0,
                        exercises: new Set(),
                    });
                }

                const data = bodyPartMap.get(bodyPart)!;
                const weight = set.actualWeight || set.plannedWeight;
                const reps = set.actualReps || set.plannedReps;
                data.totalVolume += weight * reps;
                data.exercises.add(exercise.name);
            }
        }

        // Count unique sessions per body part
        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .filter((q) => q.eq(q.field("completed"), true))
                .collect();

            const bodyPartsInSession = new Set<string>();
            for (const set of sets) {
                const exercise = await ctx.db.get(set.exerciseId);
                if (exercise && exercise.bodyPart) {
                    bodyPartsInSession.add(exercise.bodyPart);
                }
            }

            for (const bodyPart of bodyPartsInSession) {
                const data = bodyPartMap.get(bodyPart);
                if (data) {
                    data.sessions += 1;
                }
            }
        }

        const result = Array.from(bodyPartMap.entries()).map(([bodyPart, data]) => ({
            bodyPart,
            totalVolume: data.totalVolume,
            sessions: data.sessions,
            exerciseCount: data.exercises.size,
        }));

        // Sort by total volume
        result.sort((a, b) => b.totalVolume - a.totalVolume);

        return result;
    },
});

/**
 * Query to get workout history by body part for body tracker visualization
 * Returns data in format: { bodyPart: string, workouts: { exerciseName: string, entries: Array<{date, weight, reps}> } }
 */
export const getBodyPartWorkoutHistory = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        // Get all completed workout sessions
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .order("desc")
            .take(100); // Last 100 sessions

        // Map: bodyPart -> exerciseName -> entries[]
        const historyMap = new Map<string, Map<string, Array<{ date: string; weight: number; reps: number }>>>();

        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .filter((q) => q.eq(q.field("completed"), true))
                .collect();

            for (const set of sets) {
                const exercise = await ctx.db.get(set.exerciseId);
                if (!exercise) continue;

                // Use bodyPart if available, otherwise use first bodyParts element
                const bodyPartValue = exercise.bodyPart || (exercise.bodyParts && exercise.bodyParts.length > 0 ? exercise.bodyParts[0] : null);
                if (!bodyPartValue) continue; // Skip if no body part available
                const bodyPart = bodyPartValue.toLowerCase();
                const exerciseName = exercise.name;
                const weight = set.actualWeight || set.plannedWeight;
                const reps = set.actualReps || set.plannedReps;

                if (!historyMap.has(bodyPart)) {
                    historyMap.set(bodyPart, new Map());
                }

                const exerciseMap = historyMap.get(bodyPart)!;
                if (!exerciseMap.has(exerciseName)) {
                    exerciseMap.set(exerciseName, []);
                }

                exerciseMap.get(exerciseName)!.push({
                    date: session.date,
                    weight,
                    reps,
                });
            }
        }

        // Convert to the format expected by the component
        const result: Record<string, { name: string; workouts: Record<string, Array<{ date: string; weight: number; reps: number }>> }> = {};

        for (const [bodyPart, exerciseMap] of historyMap.entries()) {
            const workouts: Record<string, Array<{ date: string; weight: number; reps: number }>> = {};
            for (const [exerciseName, entries] of exerciseMap.entries()) {
                // Sort by date and get unique dates (take max weight/reps per date)
                const dateMap = new Map<string, { weight: number; reps: number }>();
                for (const entry of entries) {
                    const existing = dateMap.get(entry.date);
                    if (!existing || entry.weight > existing.weight) {
                        dateMap.set(entry.date, { weight: entry.weight, reps: entry.reps });
                    }
                }
                workouts[exerciseName] = Array.from(dateMap.entries())
                    .map(([date, data]) => ({ date, ...data }))
                    .sort((a, b) => a.date.localeCompare(b.date));
            }
            result[bodyPart] = {
                name: bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1),
                workouts,
            };
        }

        return result;
    },
});

/**
 * Query to get exercises by body part
 */
export const getExercisesByBodyPart = query({
    args: {
        bodyPart: v.string(),
    },
    handler: async (ctx, args) => {
        const bodyPartLower = args.bodyPart.toLowerCase();

        // Query by bodyPart index (for backward compatibility)
        const exercisesByIndex = await ctx.db
            .query("exercises")
            .withIndex("by_body_part", (q) => q.eq("bodyPart", bodyPartLower))
            .collect();

        // Also get exercises where bodyParts array includes this body part
        const allExercises = await ctx.db.query("exercises").collect();
        const exercisesByBodyParts = allExercises.filter(
            (e) => e.bodyParts && e.bodyParts.some(bp => bp.toLowerCase() === bodyPartLower)
        );

        // Combine and deduplicate
        const exerciseMap = new Map<string, typeof exercisesByIndex[0]>();
        for (const ex of [...exercisesByIndex, ...exercisesByBodyParts]) {
            exerciseMap.set(ex._id, ex);
        }

        return Array.from(exerciseMap.values());
    },
});

/**
 * Mutation to log a workout from body tracker
 * Creates a workout session and exercise sets
 */
export const logBodyTrackerWorkout = mutation({
    args: {
        userId: v.id("users"),
        date: v.string(),
        exerciseId: v.id("exercises"),
        weight: v.number(),
        reps: v.number(),
    },
    handler: async (ctx, args) => {
        // Check if workout session exists for this date
        let session = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_and_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
            .first();

        let sessionId: Id<"workout_sessions">;
        if (!session) {
            // Get active goal for this user
            const activeGoal = await ctx.runQuery(api.goals.getActiveGoal, {
                userId: args.userId,
            });

            if (!activeGoal) {
                throw new Error("No active goal found. Please create a goal first.");
            }

            // Create a new workout session
            sessionId = await ctx.db.insert("workout_sessions", {
                userId: args.userId,
                goalId: activeGoal._id,
                date: args.date,
                intensity: "moderate",
                workoutType: "main", // Default to main workout type
                dayOfWeek: new Date(args.date).toLocaleDateString("en-US", { weekday: "long" }),
            });
        } else {
            sessionId = session._id;
        }

        // Get existing sets for this exercise in this session
        const existingSets = await ctx.db
            .query("exercise_sets")
            .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
            .filter((q) => q.eq(q.field("exerciseId"), args.exerciseId))
            .collect();

        const setNumber = existingSets.length + 1;

        // Create the exercise set
        await ctx.db.insert("exercise_sets", {
            sessionId,
            exerciseId: args.exerciseId,
            plannedWeight: args.weight,
            plannedReps: args.reps,
            actualWeight: args.weight,
            actualReps: args.reps,
            completed: true,
            setNumber,
        });

        return { success: true, sessionId };
    },
});

/**
 * Query to get recent workouts in RecentWorkout format for constraint computation
 */
export const getRecentWorkoutsForConstraints = query({
    args: {
        userId: v.id("users"),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args): Promise<RecentWorkout[]> => {
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.gte(q.field("date"), args.startDate))
            .filter((q) => q.lt(q.field("date"), args.endDate))
            .order("desc")
            .collect();

        const recentWorkouts: RecentWorkout[] = await Promise.all(
            sessions.map(async (session) => {
                const sets = await ctx.db
                    .query("exercise_sets")
                    .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                    .collect();

                const exerciseData = await Promise.all(
                    sets.map(async (set) => {
                        const exercise = await ctx.db.get(set.exerciseId);
                        return {
                            exercise,
                            set,
                        };
                    })
                );

                const exerciseMap = new Map<string, {
                    name: string;
                    sets: Array<{ weight: number; reps: number; completed: boolean }>;
                }>();

                const bodyParts = new Set<string>();

                exerciseData.forEach(({ exercise, set }) => {
                    if (!exercise) return;

                    const exerciseName = exercise.name;
                    if (!exerciseMap.has(exerciseName)) {
                        exerciseMap.set(exerciseName, {
                            name: exerciseName,
                            sets: [],
                        });
                    }

                    exerciseMap.get(exerciseName)!.sets.push({
                        weight: set.plannedWeight,
                        reps: set.plannedReps,
                        completed: set.completed,
                    });

                    if (exercise.bodyPart) {
                        bodyParts.add(exercise.bodyPart);
                    }
                });

                return {
                    date: session.date,
                    bodyParts: Array.from(bodyParts),
                    intensity: session.intensity,
                    exercises: Array.from(exerciseMap.values()),
                };
            })
        );

        return recentWorkouts;
    },
});


/**
 * Query to get exercise context for constraint generation
 */
export const getExerciseContextForGeneration = query({
    args: {
        bodyPart: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await getExerciseContext(ctx, {
            bodyPart: args.bodyPart,
        });
    },
});

/**
 * Query to get meal context for constraint generation
 */
export const getMealContextForGeneration = query({
    args: {},
    handler: async (ctx) => {
        return await getMealContext(ctx);
    },
});

/**
 * Generate daily workout and meals using constraint-driven AI generation
 * 
 * This action:
 * 1. Computes constraints (workout intent, progression targets, nutrition intent) using pure code
 * 2. Uses AI to select exercises/meals and format output (constrained by computed values)
 * 3. Validates all outputs against constraints
 * 4. Saves to database
 * 
 * IMPORTANT: Only generates for TODAY. Past dates are immutable.
 */
export const generateDailyWorkoutAndMeals = action({
    args: {
        userId: v.id("users"),
        date: v.string(), // ISO date string (YYYY-MM-DD) - must be today
        goalId: v.optional(v.id("goals")), // Optional: if not provided, uses active goal
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        sessionId: Id<"workout_sessions">;
        workoutIntent: WorkoutIntent;
        nutritionIntent: NutritionIntent;
    }> => {
        console.log("[generateDailyWorkoutAndMeals] Starting generation for:", { userId: args.userId, date: args.date, goalId: args.goalId });

        // Validate that date is today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];

        if (args.date !== todayStr) {
            console.error("[generateDailyWorkoutAndMeals] Date mismatch:", { requested: args.date, today: todayStr });
            throw new Error(`Can only generate workouts for today (${todayStr}). Received: ${args.date}`);
        }

        // Get goal (use provided goalId or active goal)
        let goalId: Id<"goals">;
        let activeGoal: ActiveGoal | null;

        if (args.goalId) {
            // Use provided goal ID
            const goal = await ctx.runQuery(api.goals.getUserGoals, { userId: args.userId });
            const goalDoc = goal?.find((g: any) => g._id === args.goalId);
            if (!goalDoc) {
                throw new Error("Goal not found");
            }
            goalId = args.goalId;
            activeGoal = {
                category: goalDoc.category,
                target: goalDoc.target,
                direction: goalDoc.direction,
                value: goalDoc.value,
                unit: goalDoc.unit,
                priority: "medium" as const,
            };
        } else {
            // Use active goal
            const goal = await ctx.runQuery(api.goals.getActiveGoal, {
                userId: args.userId,
            });

            if (!goal) {
                console.error("[generateDailyWorkoutAndMeals] No active goal found");
                throw new Error("No active goal found. Please create a goal first.");
            }

            goalId = goal._id;
            activeGoal = {
                category: goal.category,
                target: goal.target,
                direction: goal.direction,
                value: goal.value,
                unit: goal.unit,
                priority: "medium" as const,
            };
        }

        console.log("[generateDailyWorkoutAndMeals] Using goal:", {
            goalId,
            category: activeGoal.category
        });

        // Check if workout already exists for today with this goal
        const existingSessions = await ctx.runQuery(api.plans.getWorkoutsByDateRange, {
            userId: args.userId,
            startDate: todayStr,
            endDate: todayStr,
        });

        // Delete any existing workouts for this goal and date
        if (existingSessions && existingSessions.length > 0) {
            const goalSessions = existingSessions.filter((s: any) => s.goalId === goalId);
            if (goalSessions.length > 0) {
                console.log(`[generateDailyWorkoutAndMeals] Deleting ${goalSessions.length} existing workout(s) for this goal`);
                for (const session of goalSessions) {
                    await ctx.runMutation(api.plans.deleteWorkoutSession, {
                        sessionId: session._id,
                    });
                }
            }
        }

        // Get user profile
        const userDoc = await ctx.runQuery(api.users.getUserById, { userId: args.userId });
        if (!userDoc) {
            throw new Error("User not found");
        }

        // Get recent workouts (last 14 days) - only past workouts
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const startDateStr = fourteenDaysAgo.toISOString().split("T")[0];
        // End date should be yesterday (not including today)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const endDateStr = yesterday.toISOString().split("T")[0];

        const recentWorkouts = await ctx.runQuery(api.plans.getRecentWorkoutsForConstraints, {
            userId: args.userId,
            startDate: startDateStr,
            endDate: endDateStr,
        });

        // Get user's preferred split, workouts per week, and custom workout days
        const splitType = userDoc.preferences?.preferred_split as SplitType | undefined;
        const workoutsPerWeek = userDoc.preferences?.workout_days_per_week as number | undefined;
        const customWorkoutDays = userDoc.preferences?.custom_workout_days as number[] | undefined;

        // Check if today should be a workout day based on workouts per week or custom days
        const isWorkoutDay = shouldWorkoutToday(args.date, workoutsPerWeek, recentWorkouts, customWorkoutDays);

        if (!isWorkoutDay) {
            // Today is a rest day - don't generate a workout
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const today = new Date(args.date);
            const todayName = dayNames[today.getDay()];

            let scheduleInfo = "";
            if (customWorkoutDays && customWorkoutDays.length > 0) {
                const scheduleDays = customWorkoutDays.map(day => dayNames[day]).join(", ");
                scheduleInfo = `Your custom workout days are: ${scheduleDays}.`;
            } else if (workoutsPerWeek) {
                scheduleInfo = `Your schedule is ${workoutsPerWeek} workouts per week.`;
            }

            throw new Error(
                `Today (${todayName}) is a rest day. ${scheduleInfo} ` +
                `Take time to recover and come back on your next scheduled workout day!`
            );
        }

        // Calculate yesterday's date to check for missed workouts
        // Reuse the yesterday variable already calculated above
        const yesterdayDate = yesterday.toISOString().split("T")[0];

        // Get user injury constraints
        const injuryConstraints = userDoc.injury_constraints;

        // Extract weight loss per week for body composition goals
        // This can come from goal metadata or be calculated from goal value
        let weightLossPerWeek: number | undefined;
        if (activeGoal?.category === "body_composition" && activeGoal.direction === "decrease") {
            // For now, we'll calculate from goal value if available
            // In the future, this could be stored in goal metadata or user preferences
            // Default to 1-1.5 lbs/week if not specified
            // This could be enhanced to store in goal or user preferences
            weightLossPerWeek = 1.5; // Default moderate weight loss rate
        }

        // Compute workout intent (pure code, no AI)
        // Pass yesterdayDate so it can detect missed days and repeat workouts
        // Pass injuryConstraints to automatically use recover intensity for injured body parts
        const workoutIntent = computeWorkoutIntent({
            activeGoal,
            recentWorkouts,
            splitType,
            yesterdayDate,
            injuryConstraints,
            weightLossPerWeek,
        });

        // Compute progression targets (pure code, no AI)
        const progressionTargets = computeProgressionTargets(recentWorkouts, activeGoal);

        // Determine split day number and name for template-based generation
        const splitDayNumber = determineSplitDay(splitType, recentWorkouts, yesterdayDate);
        const splitDayName = splitDayNumber && splitType
            ? getSplitDayName(splitType, splitDayNumber)
            : null;

        // Get blocked exercises
        const allBlockedItems = await ctx.runQuery(api.plans.getBlockedItems, {
            userId: args.userId,
        });

        const blockedExerciseIds = allBlockedItems
            .filter((item: { itemType: string }) => item.itemType === "exercise")
            .map((be: { itemId: string }) => be.itemId);

        // Generate workout using template-based generation (replaces AI)
        let workoutBlueprint: WorkoutBlueprint | undefined;

        if (splitDayName) {
            // Use template-based generation
            try {
                workoutBlueprint = await generateWorkoutFromTemplate({
                    workoutIntent,
                    progressionTargets,
                    splitDayName,
                    userId: args.userId,
                    ctx,
                    recentWorkouts,
                    blockedExerciseIds,
                });
            } catch (error) {
                console.error("Template-based generation failed, falling back to AI:", error);
                // Fall back to AI generation if template fails
                const exerciseContext = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {
                    bodyPart: workoutIntent.bodyParts[0],
                }) as Array<{ _id: Id<"exercises">; name: string; bodyPart: string; isCompound: boolean; equipment?: string }>;

                workoutBlueprint = await generateDailyWorkout({
                    workoutIntent,
                    progressionTargets,
                    exerciseContext,
                    blockedExerciseIds,
                });
            }
        } else {
            // No split day name (no split preference or can't determine), fall back to AI
            const exerciseContext = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {
                bodyPart: workoutIntent.bodyParts[0],
            }) as Array<{ _id: Id<"exercises">; name: string; bodyPart: string; isCompound: boolean; equipment?: string }>;

            workoutBlueprint = await generateDailyWorkout({
                workoutIntent,
                progressionTargets,
                exerciseContext,
                blockedExerciseIds,
            });
        }

        if (!workoutBlueprint) {
            throw new Error("Failed to generate workout blueprint");
        }

        // Validate workout (still use validation for template-based workouts)
        const exerciseContext = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {});
        const validation = validateWorkoutBlueprint(
            workoutBlueprint,
            workoutIntent,
            progressionTargets,
            exerciseContext.map((ex: { name: string }) => ex.name)
        );

        if (!validation.valid) {
            console.warn("Workout validation warnings:", validation.errors);
            // Don't throw - template-based generation should be valid, but log warnings
        }

        // Compute nutrition intent (pure code, no AI)
        // Pass weightLossPerWeek to factor into calorie calculation
        const nutritionIntent = computeNutritionIntent({
            activeGoal,
            userProfile: {
                weight_kg: userDoc.weight_kg,
                height_cm: userDoc.height_cm,
                experience_level: userDoc.experience_level,
            },
            weightLossPerWeek,
        });

        // Get meal context
        const mealContext = await ctx.runQuery(api.plans.getMealContextForGeneration, {}) as Array<{ _id: Id<"meals">; name: string; calories: number; mealType?: string[] }>;

        // Get blocked meals
        const blockedMealIds = allBlockedItems
            .filter((item: { itemType: string }) => item.itemType === "meal")
            .map((bm: { itemId: string }) => bm.itemId);

        // Generate meals using constrained AI
        let mealPlan: MealPlan | undefined;
        let mealValidationAttempts = 0;
        const maxMealAttempts = 3;

        while (mealValidationAttempts < maxMealAttempts) {
            try {
                mealPlan = await generateDailyMeals({
                    nutritionIntent,
                    mealContext,
                    blockedMealIds,
                });

                // Validate meals
                const mealNames = mealContext.map((m) => m.name);
                const mealValidation = validateMealPlan(
                    mealPlan,
                    nutritionIntent,
                    mealNames
                );

                if (mealValidation.valid) {
                    break; // Valid meal plan generated
                } else {
                    console.warn(`Meal validation failed (attempt ${mealValidationAttempts + 1}):`, mealValidation.errors);
                    mealValidationAttempts++;
                    if (mealValidationAttempts >= maxMealAttempts) {
                        throw new Error(`Failed to generate valid meal plan after ${maxMealAttempts} attempts: ${mealValidation.errors.join(", ")}`);
                    }
                }
            } catch (error) {
                mealValidationAttempts++;
                if (mealValidationAttempts >= maxMealAttempts) {
                    throw error;
                }
            }
        }

        if (!mealPlan) {
            throw new Error("Failed to generate meal plan");
        }

        // Package AI context for enhanced explanations
        const { packageAIExplanationContext } = await import("./scheduledWorkouts");
        const aiContext = await packageAIExplanationContext(
            ctx,
            args.userId,
            activeGoal,
            workoutIntent,
            nutritionIntent,
            workoutBlueprint,
            mealPlan,
            args.date // Pass the date being generated
        );

        // Generate explanations for workout and meals with full AI context
        const [workoutExplanation, mealExplanation] = await Promise.all([
            generateWorkoutExplanation({
                aiContext,
            }),
            generateMealExplanation({
                aiContext,
            }),
        ]);

        const dayOfWeek = new Date(args.date).toLocaleDateString("en-US", { weekday: "long" });
        let mainSessionId: Id<"workout_sessions"> | null = null;

        // Create main workout session (if not endurance-only)
        // For endurance goals, the workoutBlueprint is the endurance workout itself
        console.log("[generateDailyWorkoutAndMeals] Creating main workout session, workoutType:", workoutIntent.workoutType, "exercises:", workoutBlueprint.exercises.length);

        if (workoutIntent.workoutType !== "endurance" || workoutBlueprint.exercises.length > 0) {
            // Create new session with goalId
            mainSessionId = await ctx.runMutation(api.plans.createWorkoutSession, {
                userId: args.userId,
                goalId: goalId,
                date: args.date,
                dayOfWeek,
                intensity: workoutIntent.intensity,
                workoutType: workoutIntent.workoutType || "main",
                workoutExplanation,
                mealExplanation,
            });
            console.log("[generateDailyWorkoutAndMeals] Main session created:", mainSessionId);

            // Create exercise sets from workout blueprint
            console.log("[generateDailyWorkoutAndMeals] Creating", workoutBlueprint.exercises.length, "exercises");
            let exercisesCreated = 0;
            let setsCreated = 0;

            for (const exerciseBlueprint of workoutBlueprint.exercises) {
                // Find exercise by name
                const exercise = exerciseContext.find(
                    (ex: { name: string }) => ex.name.toLowerCase() === exerciseBlueprint.exercise.toLowerCase()
                );

                if (!exercise) {
                    console.error(`[generateDailyWorkoutAndMeals] Exercise "${exerciseBlueprint.exercise}" not found in context`);
                    console.log("[generateDailyWorkoutAndMeals] Available exercises:", exerciseContext.slice(0, 5).map((e: { name: string }) => e.name));
                    throw new Error(`Exercise "${exerciseBlueprint.exercise}" not found in context`);
                }

                console.log(`[generateDailyWorkoutAndMeals] Creating sets for exercise: ${exerciseBlueprint.exercise} (${exerciseBlueprint.sets.length} sets)`);

                // Create sets
                for (let i = 0; i < exerciseBlueprint.sets.length; i++) {
                    const set = exerciseBlueprint.sets[i];
                    try {
                        await ctx.runMutation(api.plans.createExerciseSet, {
                            sessionId: mainSessionId,
                            exerciseId: exercise._id,
                            plannedWeight: set.weight,
                            plannedReps: set.reps,
                            setNumber: i + 1,
                        });
                        setsCreated++;
                    } catch (error) {
                        console.error(`[generateDailyWorkoutAndMeals] Failed to create set ${i + 1} for ${exerciseBlueprint.exercise}:`, error);
                        throw error;
                    }
                }
                exercisesCreated++;
            }

            console.log(`[generateDailyWorkoutAndMeals] Created ${exercisesCreated} exercises with ${setsCreated} total sets`);
        } else {
            // Endurance-only workout: create endurance session
            mainSessionId = await ctx.runMutation(api.plans.createWorkoutSession, {
                userId: args.userId,
                goalId: goalId,
                date: args.date,
                dayOfWeek,
                intensity: workoutIntent.intensity,
                workoutType: "endurance",
                workoutExplanation,
                mealExplanation,
            });
        }

        // Create SEPARATE stretch workout session if needed
        if (workoutIntent.includeStretch && workoutIntent.stretchTemplate) {
            const stretchSessionId = await ctx.runMutation(api.plans.createWorkoutSession, {
                userId: args.userId,
                goalId: goalId,
                date: args.date,
                dayOfWeek,
                intensity: "maintain",
                workoutType: "stretch",
                workoutExplanation: `Stretch workout: ${workoutIntent.stretchTemplate}`,
            });

            // Generate stretch workout from template
            const stretchTemplate = await ctx.runQuery(api.split_templates.getStretchWorkoutTemplateQuery, {
                templateName: workoutIntent.stretchTemplate,
            });

            if (stretchTemplate) {
                // Get all exercises and filter for stretches
                const allExercises = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {}) as Array<{ _id: Id<"exercises">; name: string; bodyPart: string; bodyParts?: string[]; isCompound: boolean; equipment?: string }>;

                // Filter for stretch exercises (name contains "stretch", "circle", or mobility-related terms)
                const stretchExercises = allExercises.filter(ex => {
                    const nameLower = ex.name.toLowerCase();
                    return nameLower.includes("stretch") ||
                        nameLower.includes("circle") ||
                        nameLower.includes("mobility");
                });

                console.log(`[generateDailyWorkoutAndMeals] Found ${stretchExercises.length} stretch exercises for template`);

                // Create stretch exercise sets based on template
                let setNumber = 1;
                for (const templateExercise of stretchTemplate.exercises.slice(0, 8)) {
                    // Find a stretch exercise that matches this body part
                    const stretchExercise = stretchExercises.find(ex => {
                        const exBodyPart = ex.bodyPart?.toLowerCase() || "";
                        const exBodyParts = ex.bodyParts?.map(bp => bp.toLowerCase()) || [];
                        const templateBodyPart = templateExercise.bodyPart.toLowerCase();

                        return exBodyPart.includes(templateBodyPart) ||
                            templateBodyPart.includes(exBodyPart) ||
                            exBodyParts.some(bp => bp.includes(templateBodyPart) || templateBodyPart.includes(bp));
                    });

                    if (stretchExercise) {
                        // Create a single set for stretching (duration-based, not reps)
                        await ctx.runMutation(api.plans.createExerciseSet, {
                            sessionId: stretchSessionId,
                            exerciseId: stretchExercise._id,
                            plannedWeight: 0, // No weight for stretching
                            plannedReps: 30, // 30 seconds hold time (represented as reps)
                            setNumber: setNumber++,
                        });
                        console.log(`[generateDailyWorkoutAndMeals] Added stretch: ${stretchExercise.name} for ${templateExercise.bodyPart}`);
                    }
                }
            }
        }

        // Create SEPARATE cardio workout session if needed (for body composition/skill goals)
        if (workoutIntent.includeCardio && workoutIntent.cardioType && workoutIntent.workoutType !== "endurance") {
            const cardioSessionId = await ctx.runMutation(api.plans.createWorkoutSession, {
                userId: args.userId,
                goalId: goalId,
                date: args.date,
                dayOfWeek,
                intensity: "maintain",
                workoutType: "cardio",
                workoutExplanation: `Cardio workout: ${workoutIntent.cardioType}`,
            });

            // Find cardio exercise based on type
            const cardioExerciseContext = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {
                bodyPart: "cardio",
            }) as Array<{ _id: Id<"exercises">; name: string; bodyPart: string; isCompound: boolean; equipment?: string }>;

            let cardioExerciseName = "";
            if (workoutIntent.cardioType === "run") {
                cardioExerciseName = "running";
            } else if (workoutIntent.cardioType === "incline_walk") {
                cardioExerciseName = "incline walk";
            } else {
                cardioExerciseName = "walking";
            }

            const cardioExercise = cardioExerciseContext.find(
                (ex) => ex.name.toLowerCase().includes(cardioExerciseName.toLowerCase()) ||
                    cardioExerciseName.toLowerCase().includes(ex.name.toLowerCase())
            );

            if (cardioExercise) {
                // Create cardio exercise set (distance/time based)
                await ctx.runMutation(api.plans.createExerciseSet, {
                    sessionId: cardioSessionId,
                    exerciseId: cardioExercise._id,
                    plannedWeight: 0, // No weight for cardio
                    plannedReps: 20, // 20 minutes (represented as reps) - this would be calculated based on progression
                    setNumber: 1,
                });
            }
        }

        // Create daily meals from meal plan
        const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
        for (let i = 0; i < mealPlan.meals.length && i < mealTypes.length; i++) {
            const mealBlueprint = mealPlan.meals[i];

            // Find meal by name
            const meal = mealContext.find(
                (m: { name: string }) => m.name.toLowerCase() === mealBlueprint.name.toLowerCase()
            );

            if (!meal) {
                // Meal might not exist in database - would need to create it or use existing
                console.warn(`Meal "${mealBlueprint.name}" not found in context, skipping`);
                continue;
            }

            if (!mainSessionId) {
                throw new Error("Cannot create daily meals without a main workout session");
            }

            console.log("[generateDailyWorkoutAndMeals] Creating daily meal:", mealBlueprint.name);

            await ctx.runMutation(api.plans.createDailyMeal, {
                sessionId: mainSessionId,
                mealId: meal._id,
                mealType: mealTypes[i] || "snack",
                order: i + 1,
            });
        }

        if (!mainSessionId) {
            throw new Error("Failed to create main workout session");
        }

        // Verify the session was created and can be retrieved
        const verifySession = await ctx.runQuery(api.plans.getWorkoutByDate, {
            userId: args.userId,
            date: args.date,
        });

        console.log("[generateDailyWorkoutAndMeals] ✅ Workout generation complete!", {
            sessionId: mainSessionId,
            date: args.date,
            workoutType: workoutIntent.workoutType,
            exercisesCreated: workoutBlueprint.exercises.length,
            mealsCreated: mealPlan.meals.length,
            sessionVerified: verifySession ? "yes" : "no"
        });

        return {
            success: true,
            sessionId: mainSessionId, // Return main session ID
            workoutIntent,
            nutritionIntent,
        };
    },
});
