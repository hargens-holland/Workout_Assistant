import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import Groq from "groq-sdk";

/* =======================
   Types
======================= */

type AIWorkoutPlan = {
    schedule: string[];
    exercises: Array<{
        day: string;
        routines: Array<{
            name: string;
            sets: number;
            reps: number;
        }>;
    }>;
};

type AIMealPlan = {
    dailyCalories: number;
    meals: Array<{
        name: string;
        foods: string[];
    }>;
};

/* =======================
   Transformation Functions
======================= */

/**
 * Transforms AI workout plan response to match database schema
 */
function transformWorkoutPlan(aiPlan: AIWorkoutPlan) {
    return {
        schedule: aiPlan.schedule,
        exercises: aiPlan.exercises.map((exercise) => ({
            day: exercise.day,
            // Transform "routines" (plural) to "routine" (singular) as per schema
            routine: exercise.routines.map((routine) => ({
                name: routine.name,
                sets: routine.sets,
                reps: routine.reps,
                // Optional fields can be added later if needed
                duration: undefined,
                description: undefined,
                exercise: undefined,
            })),
        })),
    };
}

/**
 * Transforms AI meal plan response to match database schema
 * Estimates calories per meal and adds placeholder instructions
 */
function transformMealPlan(aiPlan: AIMealPlan) {
    const totalMeals = aiPlan.meals.length;
    const caloriesPerMeal = Math.floor(aiPlan.dailyCalories / totalMeals);

    return {
        dailyCalories: aiPlan.dailyCalories,
        meals: aiPlan.meals.map((meal) => ({
            name: meal.name,
            foods: meal.foods,
            // Distribute calories evenly across meals (can be improved with AI)
            calories: caloriesPerMeal,
            // Add placeholder instructions (can be enhanced later)
            instructions: [`Enjoy your ${meal.name.toLowerCase()} with the listed foods.`],
        })),
    };
}

/* =======================
   Convex Actions & Mutations
======================= */

/**
 * Action to generate workout and meal plans using Groq AI
 */
export const generatePlan = action({
    args: {
        workoutPrompt: v.string(),
        mealPlanPrompt: v.string(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            // Debug: Log available env vars (without values for security)
            const envKeys = Object.keys(process.env).filter(key => key.includes("GROQ") || key.includes("API"));
            console.error("Available env vars containing 'GROQ' or 'API':", envKeys);
            throw new Error("GROQ_API_KEY not configured. Please add it in Convex Dashboard → Settings → Environment Variables");
        }

        const groq = new Groq({
            apiKey: apiKey,
        });

        // Generate workout plan
        const workoutCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: args.workoutPrompt,
                },
            ],
            model: "llama-3.3-70b-versatile", // Current Groq model (replacement for decommissioned llama-3.1-70b-versatile)
            temperature: 0.4,
            top_p: 0.9,
            response_format: { type: "json_object" },
        });

        const workoutPlanText = workoutCompletion.choices[0]?.message?.content || "";
        let aiWorkoutPlan: AIWorkoutPlan;
        try {
            aiWorkoutPlan = JSON.parse(workoutPlanText);
        } catch (e) {
            throw new Error(`Failed to parse workout plan: ${e}`);
        }

        // Generate meal plan
        const mealCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: args.mealPlanPrompt,
                },
            ],
            model: "llama-3.3-70b-versatile", // Current Groq model (replacement for decommissioned llama-3.1-70b-versatile)
            temperature: 0.4,
            top_p: 0.9,
            response_format: { type: "json_object" },
        });

        const mealPlanText = mealCompletion.choices[0]?.message?.content || "";
        let aiMealPlan: AIMealPlan;
        try {
            aiMealPlan = JSON.parse(mealPlanText);
        } catch (e) {
            throw new Error(`Failed to parse meal plan: ${e}`);
        }

        // Transform to match database schema
        const workoutPlan = transformWorkoutPlan(aiWorkoutPlan);
        const dietPlan = transformMealPlan(aiMealPlan);

        return {
            success: true,
            workoutPlan,
            dietPlan,
        };
    },
});

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
 * Action that generates and saves a plan in one call
 */
export const generateAndSavePlan = action({
    args: {
        workoutPrompt: v.string(),
        mealPlanPrompt: v.string(),
        userID: v.id("users"),
        planName: v.string(),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        planId: string;
        workoutPlan: ReturnType<typeof transformWorkoutPlan>;
        dietPlan: ReturnType<typeof transformMealPlan>;
    }> => {
        // Generate the plans
        const result = await ctx.runAction(api.plans.generatePlan, {
            workoutPrompt: args.workoutPrompt,
            mealPlanPrompt: args.mealPlanPrompt,
        });

        if (!result.success) {
            throw new Error("Failed to generate plans");
        }

        // Save to database
        const planId: string = await ctx.runMutation(api.plans.createPlan, {
            userID: args.userID,
            name: args.planName,
            workoutPlan: result.workoutPlan,
            dietPlan: result.dietPlan,
            isActive: true,
        });

        return {
            success: true,
            planId,
            workoutPlan: result.workoutPlan,
            dietPlan: result.dietPlan,
        };
    },
});
