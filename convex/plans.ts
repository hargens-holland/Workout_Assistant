import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Id } from "./_generated/dataModel";
import { getSplitTemplate, type SplitType } from "./splits";

/* =======================
   Convex Queries & Mutations
   (AI generation removed - will be replaced with deterministic logic)
======================= */

/**
 * Query to get all plans for a user
 */
export const getUserPlans = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
    },
});

/**
 * Query to get active plan for a user
 */
export const getActivePlan = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();
    },
});

/**
 * Mutation to set a plan as active (deactivates all other plans for the user)
 */
export const setActivePlan = mutation({
    args: {
        planId: v.id("plans"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        // Verify the plan belongs to the user
        const plan = await ctx.db.get(args.planId);
        if (!plan) {
            throw new Error("Plan not found");
        }

        // Verify plan belongs to user (userId comparison - Convex handles type conversion)
        if (plan.userId !== args.userId) {
            throw new Error("Plan does not belong to user");
        }

        // Deactivate all plans for this user
        const allUserPlans = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .collect();

        for (const userPlan of allUserPlans) {
            if (userPlan.isActive) {
                await ctx.db.patch(userPlan._id, { isActive: false });
            }
        }

        // Activate the selected plan
        await ctx.db.patch(args.planId, { isActive: true });

        return { success: true };
    },
});

/**
 * Mutation to delete a plan and all associated workout sessions and exercise sets
 */
export const deletePlan = mutation({
    args: {
        planId: v.id("plans"),
    },
    handler: async (ctx, args) => {
        // Verify plan exists
        const plan = await ctx.db.get(args.planId);
        if (!plan) {
            throw new Error("Plan not found");
        }

        // Get all workout sessions for this plan
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
            .collect();

        // Delete all exercise sets for each session
        for (const session of sessions) {
            const sets = await ctx.db
                .query("exercise_sets")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .collect();

            for (const set of sets) {
                await ctx.db.delete(set._id);
            }

            // Delete the session
            await ctx.db.delete(session._id);
        }

        // Delete the plan
        await ctx.db.delete(args.planId);

        return { success: true };
    },
});

/**
 * Mutation to save a plan to the database
 */
export const createPlan = mutation({
    args: {
        userId: v.id("users"),
        name: v.string(),
        workoutPlan: v.object({
            schedule: v.array(v.string()),
            exercises: v.array(
                v.object({
                    day: v.string(),
                    routines: v.array(
                        v.object({
                            name: v.string(),
                            sets: v.number(),
                            reps: v.number(),
                            duration: v.optional(v.string()),
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
        trainingStrategy: v.optional(v.object({
            goal_type: v.string(),
            primary_focus: v.string(),
            time_horizon_weeks: v.number(),
            training_priorities: v.array(v.string()),
            secondary_support: v.array(v.string()),
            recommended_frequency: v.any(),
            intensity_distribution: v.object({
                heavy: v.number(),
                moderate: v.number(),
                light: v.number(),
            }),
            recovery_notes: v.string(),
            split_type: v.optional(v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS"))),
        })),
        executionConfig: v.optional(v.object({
            split_type: v.optional(v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS"))),
            intensity_distribution: v.object({
                heavy: v.number(),
                moderate: v.number(),
                light: v.number(),
            }),
        })),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("plans", args);
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
 * Action to generate workout and meal plans using Gemini AI
 */
export const generatePlan = action({
    args: {
        userId: v.id("users"),
        age: v.number(),
        height: v.string(),
        weight: v.string(),
        injuries: v.string(),
        workout_days: v.number(),
        fitness_goal: v.string(),
        fitness_level: v.string(),
        dietary_restrictions: v.string(),
        // split_type is now auto-selected based on workout_days, no longer needed in args
    },
    handler: async (ctx, args) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-001",
            generationConfig: {
                temperature: 0.4,
                topP: 0.9,
                responseMimeType: "application/json",
            },
        });

        // Auto-select split based on workout days
        function autoSelectSplit(workoutDays: number): SplitType {
            if (workoutDays >= 6) {
                return "PPL"; // 6 days - PPL
            } else if (workoutDays === 5) {
                return "BRO_SPLIT"; // 5 days - Bro Split
            } else if (workoutDays === 4) {
                return "UPPER_LOWER"; // 4 days - Upper/Lower
            } else if (workoutDays === 3) {
                return "FULL_BODY"; // 3 days - Full Body
            } else {
                return "FULL_BODY"; // Default for 1-2 days
            }
        }

        // Validate training strategy (AI intent only)
        function validateStrategy(strategy: any) {
            return {
                goal_type: strategy.goal_type,
                primary_focus: strategy.primary_focus,
                time_horizon_weeks: typeof strategy.time_horizon_weeks === "number" ? strategy.time_horizon_weeks : parseInt(strategy.time_horizon_weeks) || 12,
                training_priorities: Array.isArray(strategy.training_priorities) ? strategy.training_priorities : [],
                secondary_support: Array.isArray(strategy.secondary_support) ? strategy.secondary_support : [],
                recommended_frequency: typeof strategy.recommended_frequency === "object" ? strategy.recommended_frequency : {},
                intensity_distribution: {
                    heavy: typeof strategy.intensity_distribution?.heavy === "number" ? strategy.intensity_distribution.heavy : (typeof strategy.intensity_distribution?.heavy === "string" ? parseFloat(strategy.intensity_distribution.heavy) : 0),
                    moderate: typeof strategy.intensity_distribution?.moderate === "number" ? strategy.intensity_distribution.moderate : (typeof strategy.intensity_distribution?.moderate === "string" ? parseFloat(strategy.intensity_distribution.moderate) : 0),
                    light: typeof strategy.intensity_distribution?.light === "number" ? strategy.intensity_distribution.light : (typeof strategy.intensity_distribution?.light === "string" ? parseFloat(strategy.intensity_distribution.light) : 0),
                },
                recovery_notes: strategy.recovery_notes || "",
                split_type: autoSelectSplit(args.workout_days),
            };
        }

        // Validate diet plan
        function validateDietPlan(plan: any) {
            return {
                dailyCalories: plan.dailyCalories,
                meals: plan.meals.map((meal: any) => ({
                    name: meal.name,
                    foods: meal.foods,
                })),
            };
        }

        const strategyPrompt = `You are an expert strength and conditioning coach.

Your task is to design a LONG-TERM TRAINING STRATEGY that maximizes
the probability of achieving the user's stated fitness goal.

This strategy may span multiple months.

IMPORTANT:
- You are NOT generating workouts.
- You are NOT selecting exercises.
- You are NOT assigning sets, reps, or weights.

You are defining TRAINING INTENT and PRIORITIES only.

Optimize the plan for GOAL COMPLETION, not variety. The workout plan should be SPECIFICALLY
tailored to achieve their exact goal, not just general fitness.

Rules:
- If the goal mentions a specific lift with a weight (e.g. "bench 225", "squat 315", "deadlift 405"),
  you MUST prioritize that EXACT lift as the PRIMARY focus. Include the specific lift name
  (e.g. "bench press", "squat", "deadlift") in training_priorities with HIGH frequency (2-3x per week).
  Also include supporting muscle groups that directly help that lift (e.g. for bench: chest, triceps, shoulders).
  The goal is to get stronger at THAT SPECIFIC LIFT, not just general strength.
  
- If the goal is performance-based without specific numbers (e.g. "add 20 lbs to bench", "improve squat"),
  prioritize that lift and its supporting muscle groups with increased frequency.
  
- If the goal involves running (e.g. "run a 6 minute mile", "run a marathon", "improve 5K time"),
  you MUST include "running" or "cardio" in the training_priorities array with appropriate frequency.
  For running goals, running should be a PRIMARY priority, not secondary support.
  
- Increase training frequency for primary priorities as needed (up to 3x per week for specific lifts).
- Reduce emphasis on non-essential areas if required to focus on the goal.
- Account for fatigue and recovery over weeks, not days.
- Remember: The plan should help them achieve THEIR SPECIFIC GOAL, not just be a balanced general workout.

User context:
Age: ${args.age}
Height: ${args.height}
Weight: ${args.weight}
Injuries or limitations: ${args.injuries}
Available days for workout: ${args.workout_days}
Fitness goal: ${args.fitness_goal}
Fitness level: ${args.fitness_level}

Respond ONLY with valid JSON using this schema:
{
  "goal_type": "strength | hypertrophy | fat_loss | endurance",
  "primary_focus": string,
  "time_horizon_weeks": number,
  "training_priorities": string[],
  "secondary_support": string[],
  "recommended_frequency": {
    [key: string]: number
  },
  "intensity_distribution": {
    "heavy": number,
    "moderate": number,
    "light": number
  },
  "recovery_notes": string
}

Do not include any text outside the JSON.`;

        const strategyResult = await model.generateContent(strategyPrompt);
        const strategyText = strategyResult.response.text();
        let trainingStrategy;
        try {
            trainingStrategy = JSON.parse(strategyText);
        } catch (error) {
            throw new Error(`Failed to parse training strategy JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        trainingStrategy = validateStrategy(trainingStrategy);

        // Create minimal placeholder workout plan to satisfy schema
        const placeholderWorkoutPlan = {
            schedule: [],
            exercises: [],
        };

        const dietPrompt = `You are an experienced nutrition coach creating a personalized diet plan based on:
Age: ${args.age}
Height: ${args.height}
Weight: ${args.weight}
Fitness goal: ${args.fitness_goal}
Dietary restrictions: ${args.dietary_restrictions}

As a professional nutrition coach:
- Calculate appropriate daily calorie intake based on the person's stats and goals
- Create a balanced meal plan with proper macronutrient distribution
- Include a variety of nutrient-dense foods while respecting dietary restrictions
- Consider meal timing around workouts for optimal performance and recovery

CRITICAL SCHEMA INSTRUCTIONS:
- Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
- "dailyCalories" MUST be a NUMBER, not a string
- DO NOT add fields like "supplements", "macros", "notes", or ANYTHING else
- ONLY include the EXACT fields shown in the example below
- Each meal should include ONLY a "name" and "foods" array

Return a JSON object with this EXACT structure and no other fields:
{
  "dailyCalories": 2000,
  "meals": [
    {
      "name": "Breakfast",
      "foods": ["Oatmeal with berries", "Greek yogurt", "Black coffee"]
    },
    {
      "name": "Lunch",
      "foods": ["Grilled chicken salad", "Whole grain bread", "Water"]
    }
  ]
}

DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

        const dietResult = await model.generateContent(dietPrompt);
        const dietPlanText = dietResult.response.text();
        let dietPlan;
        try {
            dietPlan = JSON.parse(dietPlanText);
        } catch (error) {
            throw new Error(`Failed to parse diet plan JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        dietPlan = validateDietPlan(dietPlan);

        // Transform to match schema (add calories and instructions)
        const totalMeals = dietPlan.meals.length;
        const caloriesPerMeal = Math.floor(dietPlan.dailyCalories / totalMeals);

        const transformedDietPlan = {
            dailyCalories: dietPlan.dailyCalories,
            meals: dietPlan.meals.map((meal: any) => ({
                name: meal.name,
                foods: meal.foods,
                calories: caloriesPerMeal,
                instructions: [`Enjoy your ${meal.name.toLowerCase()} with the listed foods.`],
            })),
        };

        // Extract execution config from training strategy
        const executionConfig = {
            split_type: trainingStrategy.split_type,
            intensity_distribution: trainingStrategy.intensity_distribution,
        };

        // Save to database
        const planId: Id<"plans"> = await ctx.runMutation(api.plans.createPlan, {
            userId: args.userId,
            dietPlan: transformedDietPlan,
            isActive: true,
            workoutPlan: placeholderWorkoutPlan,
            trainingStrategy: trainingStrategy,
            executionConfig: executionConfig,
            name: `${args.fitness_goal} Plan - ${new Date().toLocaleDateString()}`,
        });

        // Automatically generate workouts for the plan
        await ctx.runAction(api.plans.generateWorkoutsFromStrategy, {
            planId,
            userId: args.userId,
        });

        return {
            success: true as const,
            data: {
                planId,
                trainingStrategy: trainingStrategy,
                dietPlan: transformedDietPlan,
            },
        };
    },
});

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
    bodyPart: string;
    isCompound: boolean;
    equipment?: string;
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
        planId: v.id("plans"),
        lookbackDays: v.number(),
    },
    handler: async (ctx, args) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - args.lookbackDays);
        const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
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
 * Generate month-long workout plan from strategy
 */
export const generateWorkoutsFromStrategy = action({
    args: {
        planId: v.id("plans"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        console.log("[generateWorkoutsFromStrategy] Starting workout generation", {
            planId: args.planId,
            userId: args.userId,
        });

        const plan = await ctx.runQuery(api.plans.getPlanById, { planId: args.planId });
        if (!plan || !plan.trainingStrategy) {
            console.error("[generateWorkoutsFromStrategy] Plan or strategy not found");
            throw new Error("Plan or training strategy not found");
        }

        const strategy = plan.trainingStrategy as TrainingStrategy;
        console.log("[generateWorkoutsFromStrategy] Strategy loaded", {
            time_horizon_weeks: strategy.time_horizon_weeks,
            training_priorities: strategy.training_priorities,
            recommended_frequency: strategy.recommended_frequency,
        });

        // Check exercise count
        const exerciseStats = await ctx.runQuery(api.plans.getExerciseStats, {});
        console.log("[generateWorkoutsFromStrategy] Exercise database stats", exerciseStats);

        if (exerciseStats.total === 0) {
            console.warn("[generateWorkoutsFromStrategy] WARNING: No exercises in database!");
            throw new Error("No exercises found in database. Please import exercises first using the importExercises action.");
        }

        const weeklySplit = buildWeeklySplit(strategy, plan.executionConfig);
        console.log("[generateWorkoutsFromStrategy] Weekly split created", {
            sessionsPerWeek: weeklySplit.length,
            split: weeklySplit.map(s => ({
                day: s.dayOfWeek,
                bodyParts: s.bodyParts,
                intensity: s.intensity,
                bodyPartsCount: s.bodyParts.length
            })),
            recommendedFrequency: strategy.recommended_frequency,
        });

        // Get plan creation date - workouts should only be generated from plan creation forward
        const planWithCreation = await ctx.runQuery(api.plans.getPlanWithCreationTime, { planId: args.planId });
        if (!planWithCreation) {
            throw new Error("Plan not found");
        }

        const planCreationDate = new Date(planWithCreation._creationTime);
        planCreationDate.setHours(0, 0, 0, 0);

        // Only generate workouts from plan creation date forward, for the next month
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Start date should be the later of: plan creation date or today (start from today, not tomorrow)
        const effectiveStartDate = planCreationDate > today ? planCreationDate : today;

        // Use today (or plan creation date) as the start date - don't wait for Monday
        const startDate = new Date(effectiveStartDate);
        startDate.setHours(0, 0, 0, 0);

        // Calculate end date (1 month from today, but not beyond plan deletion)
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setHours(23, 59, 59, 999);

        // Calculate total days to generate (up to 1 month)
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const totalWeeks = Math.ceil(totalDays / 7);

        console.log("[generateWorkoutsFromStrategy] Date range", {
            planCreationDate: planCreationDate.toISOString().split("T")[0],
            effectiveStartDate: effectiveStartDate.toISOString().split("T")[0],
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
            totalDays,
            totalWeeks,
        });

        const dayIndexMap: Record<string, number> = {
            "Monday": 0,
            "Tuesday": 1,
            "Wednesday": 2,
            "Thursday": 3,
            "Friday": 4,
            "Saturday": 5,
            "Sunday": 6,
        };

        // Track exercises used per week to avoid duplicates
        const exercisesUsedPerWeek = new Map<number, Set<Id<"exercises">>>();

        // Determine exercise count based on split type and target ~60 minute workouts
        const getExerciseCount = (bodyParts: string[], splitType?: SplitType, intensity?: string): number => {
            // Estimate time per exercise: ~10 minutes (sets + rest + transitions)
            const minutesPerExercise = 10;
            const targetMinutes = 60;
            const maxExercisesByTime = Math.floor(targetMinutes / minutesPerExercise);
            
            // Base count by split type
            let baseCount: number;
            if (splitType === "FULL_BODY") {
                baseCount = 6;
            } else if (splitType === "UPPER_LOWER") {
                baseCount = 7;
            } else if (splitType === "PPL") {
                baseCount = 5;
            } else if (splitType === "BRO_SPLIT") {
                baseCount = 4;
            } else if (splitType === "PUSH_PULL_LEGS_ARMS") {
                baseCount = 5;
            } else {
                baseCount = bodyParts.length > 2 ? 5 : 4;
            }
            
            // Cap by time constraint
            return Math.min(baseCount, maxExercisesByTime);
        };

        // Generate workouts starting from today, iterating through dates until we reach end date
        const currentDate = new Date(startDate);
        let weekNumber = 1;
        const exercisesUsedThisWeek = new Set<Id<"exercises">>();
        const mealsUsedThisWeek = new Set<Id<"meals">>();

        while (currentDate <= endDate) {
            const currentDayOfWeek = currentDate.toLocaleDateString("en-US", { weekday: "long" });

            // Find matching session in weekly split for this day
            const matchingSession = weeklySplit.find(s => s.dayOfWeek === currentDayOfWeek);

            if (matchingSession) {
                const dateStr = currentDate.toISOString().split("T")[0];

                // Skip if this date is before plan creation
                if (currentDate < planCreationDate) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }

                // Check if we've started a new week (reset exercise tracking)
                const dayOfWeekIndex = dayIndexMap[currentDayOfWeek];
                if (dayOfWeekIndex === 0) { // Monday - new week
                    exercisesUsedThisWeek.clear();
                    weekNumber++;
                }

                // Check for fatigue-based deload (recent failed reps or high RPE)
                const fatigueCheck = await ctx.runQuery(api.plans.checkFatigueIndicators, {
                    userId: args.userId,
                    planId: args.planId,
                    lookbackDays: 7,
                });

                // Deload if: fatigue indicators present OR 4-week cycle (fallback)
                const isDeloadWeek = fatigueCheck.shouldDeload ||
                    (weekNumber > 1 && weekNumber % 4 === 0 &&
                        strategy.recovery_notes.toLowerCase().includes("fatigue"));

                // Check if this is a running/cardio session for an endurance goal
                const isRunningSession = matchingSession.bodyParts.includes("cardio") || 
                                         matchingSession.bodyParts.includes("running") ||
                                         (strategy.goal_type === "endurance" && 
                                          (strategy.training_priorities.some(p => p.toLowerCase().includes("running")) ||
                                           strategy.training_priorities.some(p => p.toLowerCase().includes("cardio"))));

                let exerciseIds: Id<"exercises">[] = [];

                if (isRunningSession) {
                    // For running sessions, get or create a Running exercise
                    let runningExercise = await ctx.runAction(api.plans.getOrCreateRunningExercise, {});
                    exerciseIds = [runningExercise];
                    console.log(`[generateWorkoutsFromStrategy] Running session detected, using Running exercise: ${runningExercise}`);
                } else {
                    // Determine exercise count for this session (capped by ~60 minute target)
                    const exerciseCount = getExerciseCount(matchingSession.bodyParts, plan.executionConfig?.split_type ?? strategy.split_type, matchingSession.intensity);

                    // Select exercises using randomized pool, excluding exercises used this week and blocked exercises
                    exerciseIds = await ctx.runQuery(api.plans.selectRandomExercisesForCategory, {
                        bodyParts: matchingSession.bodyParts,
                        isCompound: matchingSession.intensity === "heavy" ? true : undefined, // Prefer compounds for heavy days
                        count: exerciseCount,
                        excludeExerciseIds: Array.from(exercisesUsedThisWeek),
                        userId: args.userId || undefined,
                    }) as Id<"exercises">[];

                    console.log(`[generateWorkoutsFromStrategy] ${dateStr} (Week ${weekNumber}), ${matchingSession.dayOfWeek}`, {
                        bodyParts: matchingSession.bodyParts,
                        exercisesFound: exerciseIds.length,
                        intensity: matchingSession.intensity,
                        exerciseCount,
                    });

                    if (exerciseIds.length === 0) {
                        console.warn(`[generateWorkoutsFromStrategy] No exercises found for body parts: ${matchingSession.bodyParts.join(", ")}`);
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                }

                // Track these exercises as used this week
                exerciseIds.forEach((id) => exercisesUsedThisWeek.add(id));

                // Check if workout session already exists for this date
                const existingSessions = await ctx.runQuery(api.plans.getWorkoutSessionsByPlanAndDate, {
                    planId: args.planId,
                    date: dateStr,
                });

                if (existingSessions.length > 0) {
                    console.log(`[generateWorkoutsFromStrategy] Workout session already exists for ${dateStr}, skipping`);
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }

                // Create workout session
                const sessionId = await ctx.runMutation(api.plans.createWorkoutSession, {
                    userId: args.userId,
                    planId: args.planId,
                    date: dateStr,
                    weekNumber: weekNumber,
                    dayOfWeek: matchingSession.dayOfWeek,
                    intensity: matchingSession.intensity,
                });

                // Create exercise sets with progression
                for (let i = 0; i < exerciseIds.length; i++) {
                    const exerciseId = exerciseIds[i];
                    
                    // Check if this is a running exercise
                    const exercise = await ctx.runQuery(api.plans.getExerciseById, { exerciseId });
                    const isRunning = exercise?.name.toLowerCase().includes("running") || exercise?.name.toLowerCase() === "run";
                    
                    if (isRunning) {
                        // For running: use reps to represent distance in miles, weight = 0
                        // Intensity-based distance: heavy = longer/faster, moderate = medium, light = shorter/easy
                        const distanceMiles = matchingSession.intensity === "heavy" ? 4 + (weekNumber * 0.5) :
                                            matchingSession.intensity === "moderate" ? 3 + (weekNumber * 0.3) :
                                            2 + (weekNumber * 0.2);
                        const adjustedDistance = isDeloadWeek ? distanceMiles * 0.7 : distanceMiles;
                        const sets = 1; // Running is typically one continuous set
                        
                        // Round to 0.1 mile precision
                        const roundedDistance = Math.round(adjustedDistance * 10) / 10;
                        
                        await ctx.runMutation(api.plans.createExerciseSet, {
                            sessionId,
                            exerciseId,
                            plannedWeight: 0, // No weight for running
                            plannedReps: Math.round(roundedDistance * 10), // Store as tenths of miles (e.g., 3.5 miles = 35)
                            setNumber: 1,
                        });
                    } else {
                        // Standard strength training exercise
                        const targetReps = matchingSession.intensity === "heavy" ? 5 :
                            matchingSession.intensity === "moderate" ? 8 : 12;
                        const sets = matchingSession.intensity === "heavy" ? 4 : 3;

                        const progression = await ctx.runQuery(api.plans.calculateProgressionForExercise, {
                            userId: args.userId,
                            exerciseId,
                            targetReps: isDeloadWeek ? targetReps + 2 : targetReps,
                        });

                        const weight = isDeloadWeek ? progression.weight * 0.9 : progression.weight;

                        for (let setNum = 1; setNum <= sets; setNum++) {
                            await ctx.runMutation(api.plans.createExerciseSet, {
                                sessionId,
                                exerciseId,
                                plannedWeight: weight,
                                plannedReps: progression.reps,
                                setNumber: setNum,
                            });
                        }
                    }
                }

                // Assign random meals for this day (skip if it would timeout - meals can be assigned later)
                // Try to assign meals, but don't fail the whole workout generation if it times out
                if (plan.dietPlan) {
                    try {
                        const mealTypes = ["breakfast", "lunch", "dinner"];
                        const mealsPerDay = 3; // breakfast, lunch, dinner
                        const targetCalories = plan.dietPlan.dailyCalories;

                        // Select random meals (excluding meals used this week, filtered by mealType)
                        const selectedMealIds: Id<"meals">[] = await ctx.runQuery(api.plans.selectRandomMealsForDay, {
                            targetCalories,
                            mealCount: mealsPerDay,
                            excludeMealIds: Array.from(mealsUsedThisWeek),
                            mealTypes: mealTypes.slice(0, mealsPerDay), // ["breakfast", "lunch", "dinner"]
                            userId: args.userId || undefined,
                        }) as Id<"meals">[];

                        // Track these meals as used this week
                        selectedMealIds.forEach((id) => mealsUsedThisWeek.add(id));

                        // Assign meals to session
                        for (let i = 0; i < selectedMealIds.length && i < mealsPerDay; i++) {
                            await ctx.runMutation(api.plans.createDailyMeal, {
                                sessionId,
                                mealId: selectedMealIds[i],
                                mealType: mealTypes[i],
                                order: i + 1,
                            });
                        }
                    } catch (error) {
                        // Log but don't fail - meals can be assigned later via regenerate
                        console.warn(`[generateWorkoutsFromStrategy] Failed to assign meals for ${dateStr}:`, error);
                    }
                }
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log("[generateWorkoutsFromStrategy] Workout generation completed successfully");
        
        // Update plan's workoutPlan.schedule with summary
        const scheduleSummary: string[] = [];
        const splitType = plan.executionConfig?.split_type ?? strategy.split_type;
        
        for (const session of weeklySplit) {
            let sessionName = "";
            if (splitType) {
                const splitTemplate = getSplitTemplate(splitType);
                const matchingDay = splitTemplate.days.find(d => {
                    const dayBodyParts = new Set(d.bodyParts);
                    const sessionBodyParts = new Set(session.bodyParts);
                    return dayBodyParts.size === sessionBodyParts.size && 
                           Array.from(dayBodyParts).every(bp => sessionBodyParts.has(bp));
                });
                sessionName = matchingDay?.name || session.bodyParts[0] || "Workout";
            } else {
                const primaryBodyPart = session.bodyParts[0] || "Workout";
                sessionName = primaryBodyPart.charAt(0).toUpperCase() + primaryBodyPart.slice(1);
            }
            
            scheduleSummary.push(`${session.dayOfWeek}: ${sessionName}`);
        }
        
        await ctx.runMutation(api.plans.updateWorkoutPlanSchedule, {
            planId: args.planId,
            schedule: scheduleSummary,
        });
        
        return { success: true };
    },
});

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
        planId: v.id("plans"),
        date: v.string(),
    },
    handler: async (ctx, args) => {
        const allSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
            .collect();

        return allSessions.filter((session) => session.date === args.date);
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

        for (const bodyPart of args.bodyParts) {
            let exercises = await ctx.db
                .query("exercises")
                .withIndex("by_body_part", (q) => q.eq("bodyPart", bodyPart.toLowerCase()))
                .collect();

            // Filter by compound if specified
            if (args.isCompound !== undefined) {
                exercises = exercises.filter((e) => e.isCompound === args.isCompound);
            }

            // Prefer compound exercises if isCompound is true but we need more
            if (args.isCompound === true && exercises.length < args.count) {
                const allExercises = await ctx.db
                    .query("exercises")
                    .withIndex("by_body_part", (q) => q.eq("bodyPart", bodyPart.toLowerCase()))
                    .collect();
                exercises = allExercises;
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
        planId: v.id("plans"),
        date: v.string(),
        weekNumber: v.number(),
        dayOfWeek: v.string(),
        intensity: v.string(),
    },
    handler: async (ctx, args) => {
        // Check for duplicate workout session (same plan, same date)
        const existingSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
            .collect();

        const duplicate = existingSessions.find(
            (session) => session.date === args.date && session.planId === args.planId
        );

        if (duplicate) {
            throw new Error(`A workout session already exists for date ${args.date} in this plan`);
        }

        return await ctx.db.insert("workout_sessions", args);
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
 * Query to get workouts for a date range (only from active plan, and only after plan creation)
 */
export const getWorkoutsByDateRange = query({
    args: {
        userId: v.id("users"),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args) => {
        // Get active plan for user
        const activePlan = await ctx.db
            .query("plans")
            .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

        if (!activePlan) {
            console.log("[getWorkoutsByDateRange] No active plan found for user");
            return [];
        }

        // Get plan creation date
        const planCreationDate = new Date(activePlan._creationTime);
        planCreationDate.setHours(0, 0, 0, 0);
        const planCreationDateStr = planCreationDate.toISOString().split("T")[0];

        // Get sessions only from the active plan
        const allSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", activePlan._id))
            .collect();

        console.log("[getWorkoutsByDateRange] Sessions for active plan:", {
            userId: args.userId,
            planId: activePlan._id,
            planCreationDate: planCreationDateStr,
            totalSessions: allSessions.length,
            dateRange: { startDate: args.startDate, endDate: args.endDate },
            sessionDates: allSessions.map(s => s.date).slice(0, 10),
        });

        // Filter sessions by date range AND ensure they're after plan creation
        const sessions = allSessions.filter(
            (s) => s.date >= args.startDate &&
                s.date <= args.endDate &&
                s.date >= planCreationDateStr
        );

        console.log("[getWorkoutsByDateRange] Filtered sessions:", {
            count: sessions.length,
            dates: sessions.map(s => s.date),
        });

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
            weekNumber: session.weekNumber,
            dayOfWeek: session.dayOfWeek,
            intensity: session.intensity,
        }));
    },
});

/**
 * Mutation to create a single exercise
 */
export const createExercise = mutation({
    args: {
        name: v.string(),
        bodyPart: v.string(),
        isCompound: v.boolean(),
        equipment: v.optional(v.string()),
        instructions: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("exercises", {
            name: args.name,
            bodyPart: args.bodyPart.toLowerCase(),
            isCompound: args.isCompound,
            equipment: args.equipment,
            instructions: args.instructions,
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
                bodyPart: v.string(),
                isCompound: v.boolean(),
                equipment: v.optional(v.string()),
                instructions: v.optional(v.array(v.string())),
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

                const id = await ctx.runMutation(api.plans.createExercise, {
                    name: exercise.name,
                    bodyPart: exercise.bodyPart,
                    isCompound: exercise.isCompound,
                    equipment: exercise.equipment,
                    instructions: exercise.instructions,
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
 * Query to get exercise count by body part
 */
export const getExerciseStats = query({
    args: {},
    handler: async (ctx) => {
        const allExercises = await ctx.db.query("exercises").collect();
        const stats: Record<string, { total: number; compound: number }> = {};

        for (const exercise of allExercises) {
            if (!stats[exercise.bodyPart]) {
                stats[exercise.bodyPart] = { total: 0, compound: 0 };
            }
            stats[exercise.bodyPart].total++;
            if (exercise.isCompound) {
                stats[exercise.bodyPart].compound++;
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
        planId: v.id("plans"),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, args) => {
        const allSessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
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
 * Action to generate next workout after completing one
 */
export const generateNextWorkout = action({
    args: {
        planId: v.id("plans"),
        userId: v.id("users"),
        completedSessionId: v.id("workout_sessions"),
    },
    handler: async (ctx, args): Promise<{ success: boolean; alreadyExists?: boolean; beyondWindow?: boolean; beforePlanCreation?: boolean; sessionId?: Id<"workout_sessions"> }> => {
        // Get the completed session to find the date
        const completedSession = await ctx.runQuery(api.plans.getWorkoutSessionById, {
            sessionId: args.completedSessionId,
        }) as { _id: Id<"workout_sessions">; date: string; dayOfWeek: string; weekNumber: number; planId: Id<"plans">; userId: Id<"users">; intensity: string } | null;

        if (!completedSession) {
            throw new Error("Session not found");
        }

        const plan = await ctx.runQuery(api.plans.getPlanById, { planId: args.planId });
        if (!plan || !plan.trainingStrategy) {
            throw new Error("Plan or training strategy not found");
        }

        // Get plan creation date to ensure we don't generate workouts before plan was created
        const planWithCreation = await ctx.runQuery(api.plans.getPlanWithCreationTime, { planId: args.planId });
        if (!planWithCreation) {
            throw new Error("Plan not found");
        }

        const planCreationDate = new Date(planWithCreation._creationTime);
        planCreationDate.setHours(0, 0, 0, 0);

        const strategy = plan.trainingStrategy as TrainingStrategy;
        const weeklySplit = buildWeeklySplit(strategy, plan.executionConfig);

        // Find the next workout date (next occurrence of this day in the split)
        const completedDate: Date = new Date(completedSession.date);
        const dayOfWeek: string = completedSession.dayOfWeek;

        // Find the index of this session in the weekly split
        const sessionIndex = weeklySplit.findIndex(s => s.dayOfWeek === dayOfWeek);
        if (sessionIndex === -1) {
            throw new Error("Could not find session in weekly split");
        }

        // Get the next session in the split
        const nextSessionIndex = (sessionIndex + 1) % weeklySplit.length;
        const nextSession = weeklySplit[nextSessionIndex];

        // Calculate next date
        const daysToAdd = nextSessionIndex === 0 ? 7 - sessionIndex : nextSessionIndex - sessionIndex;
        const nextDate: Date = new Date(completedDate);
        nextDate.setDate(completedDate.getDate() + daysToAdd);
        nextDate.setHours(0, 0, 0, 0);
        const nextDateStr: string = nextDate.toISOString().split("T")[0];

        // Ensure next date is not before plan creation
        if (nextDate < planCreationDate) {
            console.log(`[generateNextWorkout] Next workout date ${nextDateStr} is before plan creation date ${planCreationDate.toISOString().split("T")[0]}`);
            return { success: true, beforePlanCreation: true };
        }

        // Check if workout already exists for this date
        const existingSessions = await ctx.runQuery(api.plans.getWorkoutSessionsByPlanAndDate, {
            planId: args.planId,
            date: nextDateStr,
        });

        if (existingSessions.length > 0) {
            console.log(`[generateNextWorkout] Workout already exists for ${nextDateStr}`);
            return { success: true, alreadyExists: true };
        }

        // Check if we're still within the 1-month window
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oneMonthFromNow = new Date(today);
        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

        if (nextDate > oneMonthFromNow) {
            console.log(`[generateNextWorkout] Next workout date ${nextDateStr} is beyond 1-month window`);
            return { success: true, beyondWindow: true };
        }

        // Generate the single workout
        const dayIndexMap: Record<string, number> = {
            "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
            "Friday": 4, "Saturday": 5, "Sunday": 6,
        };

        // Check if this is a running/cardio session for an endurance goal
        const isRunningSession = nextSession.bodyParts.includes("cardio") || 
                                 nextSession.bodyParts.includes("running") ||
                                 (strategy.goal_type === "endurance" && 
                                  (strategy.training_priorities.some(p => p.toLowerCase().includes("running")) ||
                                   strategy.training_priorities.some(p => p.toLowerCase().includes("cardio"))));

        let exerciseIds: Id<"exercises">[] = [];

        if (isRunningSession) {
            // For running sessions, get or create a Running exercise
            const runningExercise = await ctx.runAction(api.plans.getOrCreateRunningExercise, {});
            exerciseIds = [runningExercise];
            console.log(`[generateNextWorkout] Running session detected, using Running exercise: ${runningExercise}`);
        } else {
            const exerciseCount = nextSession.bodyParts.length > 2 ? 5 : 4;
            exerciseIds = await ctx.runQuery(api.plans.selectRandomExercisesForCategory, {
                bodyParts: nextSession.bodyParts,
                isCompound: nextSession.intensity === "heavy" ? true : undefined,
                count: exerciseCount,
                excludeExerciseIds: [],
                userId: args.userId,
            }) as Id<"exercises">[];

            if (exerciseIds.length === 0) {
                throw new Error(`No exercises found for body parts: ${nextSession.bodyParts.join(", ")}`);
            }
        }

        // Create workout session
        const weekNumber = Math.ceil((nextDate.getTime() - new Date(completedSession.date).getTime()) / (7 * 24 * 60 * 60 * 1000)) + completedSession.weekNumber;
        
        // Check for fatigue-based deload
        const fatigueCheck = await ctx.runQuery(api.plans.checkFatigueIndicators, {
            userId: args.userId,
            planId: args.planId,
            lookbackDays: 7,
        });
        const isDeloadWeek = fatigueCheck.shouldDeload ||
            (weekNumber > 1 && weekNumber % 4 === 0 &&
                strategy.recovery_notes.toLowerCase().includes("fatigue"));

        const sessionId: Id<"workout_sessions"> = await ctx.runMutation(api.plans.createWorkoutSession, {
            userId: args.userId,
            planId: args.planId,
            date: nextDateStr,
            weekNumber,
            dayOfWeek: nextSession.dayOfWeek,
            intensity: nextSession.intensity,
        });

        // Create exercise sets
        for (let i = 0; i < exerciseIds.length; i++) {
            const exerciseId = exerciseIds[i];
            
            // Check if this is a running exercise
            const exercise = await ctx.runQuery(api.plans.getExerciseById, { exerciseId });
            const isRunning = exercise?.name.toLowerCase().includes("running") || exercise?.name.toLowerCase() === "run";
            
            if (isRunning) {
                // For running: use reps to represent distance in miles, weight = 0
                // Intensity-based distance: heavy = longer/faster, moderate = medium, light = shorter/easy
                const distanceMiles = nextSession.intensity === "heavy" ? 4 + (weekNumber * 0.5) :
                                    nextSession.intensity === "moderate" ? 3 + (weekNumber * 0.3) :
                                    2 + (weekNumber * 0.2);
                const adjustedDistance = isDeloadWeek ? distanceMiles * 0.7 : distanceMiles;
                
                // Round to 0.1 mile precision
                const roundedDistance = Math.round(adjustedDistance * 10) / 10;
                
                await ctx.runMutation(api.plans.createExerciseSet, {
                    sessionId,
                    exerciseId,
                    plannedWeight: 0, // No weight for running
                    plannedReps: Math.round(roundedDistance * 10), // Store as tenths of miles (e.g., 3.5 miles = 35)
                    setNumber: 1,
                });
            } else {
                // Standard strength training exercise
                const targetReps = nextSession.intensity === "heavy" ? 5 :
                    nextSession.intensity === "moderate" ? 8 : 12;
                const sets = nextSession.intensity === "heavy" ? 4 : 3;

                const progression = await ctx.runQuery(api.plans.calculateProgressionForExercise, {
                    userId: args.userId,
                    exerciseId,
                    targetReps: isDeloadWeek ? targetReps + 2 : targetReps,
                });

                const weight = isDeloadWeek ? progression.weight * 0.9 : progression.weight;
                for (let setNum = 1; setNum <= sets; setNum++) {
                    await ctx.runMutation(api.plans.createExerciseSet, {
                        sessionId,
                        exerciseId,
                        plannedWeight: weight,
                        plannedReps: progression.reps,
                        setNumber: setNum,
                    });
                }
            }
        }

        // Assign meals
        if (plan.dietPlan) {
            const mealTypes = ["breakfast", "lunch", "dinner"];
            const selectedMealIds = await ctx.runQuery(api.plans.selectRandomMealsForDay, {
                targetCalories: plan.dietPlan.dailyCalories,
                mealCount: 3,
                excludeMealIds: [],
                mealTypes: mealTypes,
                userId: args.userId,
            }) as Id<"meals">[];

            for (let i = 0; i < selectedMealIds.length && i < 3; i++) {
                await ctx.runMutation(api.plans.createDailyMeal, {
                    sessionId,
                    mealId: selectedMealIds[i],
                    mealType: mealTypes[i],
                    order: i + 1,
                });
            }
        }

        return { success: true, sessionId };
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
        planId: v.id("plans"),
        sessionId: v.id("workout_sessions"),
        reason: v.optional(v.string()),
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

        const setsToReplace = allSetsForExercise.filter(s => s.exerciseId === oldExerciseId);

        if (setsToReplace.length === 0) {
            throw new Error("No sets found for this exercise");
        }

        // Check if any sets being replaced are completed
        const hasCompletedSets = setsToReplace.some(s => s.completed);
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

        const weekSessions = await ctx.runQuery(api.plans.getWorkoutSessionsByDateRange, {
            planId: args.planId,
            startDate: weekStart.toISOString().split("T")[0],
            endDate: weekEnd.toISOString().split("T")[0],
        });

        const exercisesUsedThisWeek = new Set<Id<"exercises">>();
        for (const ws of weekSessions) {
            const sets = await ctx.runQuery(api.plans.getExerciseSetsBySession, {
                sessionId: ws._id,
            });
            sets.forEach((s) => exercisesUsedThisWeek.add(s.exerciseId));
        }

        // Get new exercise with same body part
        const newExerciseIds = await ctx.runQuery(api.plans.selectRandomExercisesForCategory, {
            bodyParts: [oldExercise.bodyPart],
            isCompound: session.intensity === "heavy" ? true : undefined,
            count: 1,
            excludeExerciseIds: Array.from(exercisesUsedThisWeek),
            userId: args.userId,
        }) as Id<"exercises">[];

        if (newExerciseIds.length === 0) {
            throw new Error("No available exercises found for this body part");
        }

        const newExerciseId = newExerciseIds[0];

        // Get plan for progression calculation
        const plan = await ctx.runQuery(api.plans.getPlanById, { planId: args.planId });
        if (!plan || !plan.trainingStrategy) {
            throw new Error("Plan or training strategy not found");
        }

        const strategy = plan.trainingStrategy as TrainingStrategy;
        
        // Check for fatigue-based deload
        const fatigueCheck = await ctx.runQuery(api.plans.checkFatigueIndicators, {
            userId: args.userId,
            planId: args.planId,
            lookbackDays: 7,
        });
        const isDeloadWeek = fatigueCheck.shouldDeload ||
            (session.weekNumber > 1 && session.weekNumber % 4 === 0 &&
                strategy.recovery_notes.toLowerCase().includes("fatigue"));

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
        planId: v.id("plans"),
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

        const plan = await ctx.runQuery(api.plans.getPlanById, { planId: args.planId });
        if (!plan || !plan.dietPlan) {
            throw new Error("Plan or diet plan not found");
        }

        // Get meals used this week to avoid duplicates
        const session = await ctx.runQuery(api.plans.getWorkoutSessionById, {
            sessionId: dailyMeal.sessionId,
        });

        if (!session) {
            throw new Error("Session not found");
        }

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
            planId: args.planId,
            startDate: weekStart.toISOString().split("T")[0],
            endDate: weekEnd.toISOString().split("T")[0],
        });

        const mealsUsedThisWeek = new Set<Id<"meals">>();
        for (const ws of weekSessions) {
            const weekMeals = await ctx.runQuery(api.plans.getDailyMealsBySession, {
                sessionId: ws._id,
            });
            weekMeals.forEach((dm) => {
                if (dm._id !== args.dailyMealId) {
                    mealsUsedThisWeek.add(dm.mealId);
                }
            });
        }

        // Get new meal of same type
        const newMealIds = await ctx.runQuery(api.plans.selectRandomMealsForDay, {
            targetCalories: plan.dietPlan.dailyCalories,
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
            bodyPart: "cardio",
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
        splitType: v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS")),
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
 * Action to change split type and regenerate workouts
 */
export const changePlanSplit = action({
    args: {
        planId: v.id("plans"),
        userId: v.id("users"),
        newSplitType: v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS")),
    },
    handler: async (ctx, args) => {
        // Update the plan's split type
        await ctx.runMutation(api.plans.updatePlanSplitType, {
            planId: args.planId,
            splitType: args.newSplitType,
        });

        // Delete only future workout sessions and sets for this plan
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];
        
        const sessions = await ctx.runQuery(api.plans.getWorkoutSessionsByPlan, {
            planId: args.planId,
        });

        const futureSessionIds: Id<"workout_sessions">[] = [];
        for (const session of sessions) {
            // Only delete sessions on or after today
            if (session.date >= todayStr) {
                futureSessionIds.push(session._id);
                const sets = await ctx.runQuery(api.plans.getExerciseSetsBySession, {
                    sessionId: session._id,
                });
                for (const set of sets) {
                    await ctx.runMutation(api.plans.deleteExerciseSet, {
                        setId: set._id,
                    });
                }
                await ctx.runMutation(api.plans.deleteWorkoutSession, {
                    sessionId: session._id,
                });
            }
        }

        // Delete daily meals only for deleted future sessions
        const dailyMeals = await ctx.runQuery(api.plans.getAllDailyMealsByPlan, {
            planId: args.planId,
        });
        for (const meal of dailyMeals) {
            if (futureSessionIds.includes(meal.sessionId)) {
                await ctx.runMutation(api.plans.deleteDailyMeal, {
                    dailyMealId: meal._id,
                });
            }
        }

        // Regenerate workouts with new split
        await ctx.runAction(api.plans.generateWorkoutsFromStrategy, {
            planId: args.planId,
            userId: args.userId,
        });

        return { success: true };
    },
});

/**
 * Helper to delete future workouts for a plan starting from a given date
 */
export const deleteFutureWorkouts = mutation({
    args: {
        planId: v.id("plans"),
        startDate: v.string(),
    },
    handler: async (ctx, args) => {
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
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
    args: { planId: v.id("plans") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
            .collect();
    },
});

export const deleteWorkoutSession = mutation({
    args: { sessionId: v.id("workout_sessions") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.sessionId);
        return { success: true };
    },
});

export const getAllDailyMealsByPlan = query({
    args: { planId: v.id("plans") },
    handler: async (ctx, args) => {
        // Get all sessions for this plan
        const sessions = await ctx.db
            .query("workout_sessions")
            .withIndex("by_plan_id", (q) => q.eq("planId", args.planId))
            .collect();

        // Get all daily meals for these sessions
        const allMeals = [];
        for (const session of sessions) {
            const meals = await ctx.db
                .query("daily_meals")
                .withIndex("by_session_id", (q) => q.eq("sessionId", session._id))
                .collect();
            allMeals.push(...meals);
        }

        return allMeals;
    },
});

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
