import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("plans", args);
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

        // Validate and fix workout plan
        function validateWorkoutPlan(plan: any) {
            return {
                schedule: plan.schedule,
                exercises: plan.exercises.map((exercise: any) => ({
                    day: exercise.day,
                    routines: exercise.routines.map((routine: any) => ({
                        name: routine.name,
                        sets: typeof routine.sets === "number" ? routine.sets : parseInt(routine.sets) || 1,
                        reps: typeof routine.reps === "number" ? routine.reps : parseInt(routine.reps) || 10,
                    })),
                })),
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

        const workoutPrompt = `You are an experienced fitness coach creating a personalized workout plan based on:
Age: ${args.age}
Height: ${args.height}
Weight: ${args.weight}
Injuries or limitations: ${args.injuries}
Available days for workout: ${args.workout_days}
Fitness goal: ${args.fitness_goal}
Fitness level: ${args.fitness_level}

As a professional coach:
- Consider muscle group splits to avoid overtraining the same muscles on consecutive days
- Design exercises that match the fitness level and account for any injuries
- Structure the workouts to specifically target the user's fitness goal

CRITICAL SCHEMA INSTRUCTIONS:
- Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
- "sets" and "reps" MUST ALWAYS be NUMBERS, never strings
- For example: "sets": 3, "reps": 10
- Do NOT use text like "reps": "As many as possible" or "reps": "To failure"
- Instead use specific numbers like "reps": 12 or "reps": 15
- For cardio, use "sets": 1, "reps": 1 or another appropriate number
- NEVER include strings for numerical fields
- NEVER add extra fields not shown in the example below

Return a JSON object with this EXACT structure:
{
  "schedule": ["Monday", "Wednesday", "Friday"],
  "exercises": [
    {
      "day": "Monday",
      "routines": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 10
        }
      ]
    }
  ]
}

DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

        const workoutResult = await model.generateContent(workoutPrompt);
        const workoutPlanText = workoutResult.response.text();
        let workoutPlan = JSON.parse(workoutPlanText);
        workoutPlan = validateWorkoutPlan(workoutPlan);

        // Transform to match schema (routines plural)
        const transformedWorkoutPlan = {
            schedule: workoutPlan.schedule,
            exercises: workoutPlan.exercises.map((exercise: any) => ({
                day: exercise.day,
                routines: exercise.routines.map((routine: any) => ({
                    name: routine.name,
                    sets: routine.sets,
                    reps: routine.reps,
                })),
            })),
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
        let dietPlan = JSON.parse(dietPlanText);
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

        // Save to database
        const planId: string = await ctx.runMutation(api.plans.createPlan, {
            userId: args.userId,
            dietPlan: transformedDietPlan,
            isActive: true,
            workoutPlan: transformedWorkoutPlan,
            name: `${args.fitness_goal} Plan - ${new Date().toLocaleDateString()}`,
        });

        return {
            success: true as const,
            data: {
                planId,
                workoutPlan: transformedWorkoutPlan,
                dietPlan: transformedDietPlan,
            },
        };
    },
});
