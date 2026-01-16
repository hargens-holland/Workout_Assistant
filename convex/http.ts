import { httpRouter } from "convex/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { generateText } from "./llm";

const http = httpRouter();

http.route({
    path: "/clerk-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
        }

        const svix_id = request.headers.get("svix-id");
        const svix_signature = request.headers.get("svix-signature");
        const svix_timestamp = request.headers.get("svix-timestamp");

        if (!svix_id || !svix_signature || !svix_timestamp) {
            return new Response("No svix headers found", {
                status: 400,
            });
        }

        const payload = await request.json();
        const body = JSON.stringify(payload);

        const wh = new Webhook(webhookSecret);
        let evt: WebhookEvent;

        try {
            evt = wh.verify(body, {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            }) as WebhookEvent;
        } catch (err) {
            console.error("Error verifying webhook:", err);
            return new Response("Error occurred", { status: 400 });
        }

        const eventType = evt.type;

        if (eventType === "user.created") {
            const { id, first_name, last_name, image_url, email_addresses } = evt.data;

            const email = email_addresses[0].email_address;

            const name = `${first_name || ""} ${last_name || ""}`.trim();

            try {
                await ctx.runMutation(api.users.syncUser, {
                    email,
                    name,
                    avatar: image_url,
                    clerkId: id,
                });
            } catch (error) {
                console.log("Error creating user:", error);
                return new Response("Error creating user", { status: 500 });
            }
        }

        if (eventType === "user.updated") {
            const { id, email_addresses, first_name, last_name, image_url } = evt.data;

            const email = email_addresses[0].email_address;
            const name = `${first_name || ""} ${last_name || ""}`.trim();

            try {
                await ctx.runMutation(api.users.updateUser, {
                    clerkId: id,
                    email,
                    name,
                    avatar: image_url,
                });
            } catch (error) {
                console.log("Error updating user:", error);
                return new Response("Error updating user", { status: 500 });
            }
        }

        return new Response("Webhooks processed successfully", { status: 200 });
    }),
});

// Validate training strategy
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
    };
}

// validate diet plan to ensure it strictly follows schema
function validateDietPlan(plan: any) {
    // only keep the fields we want
    const validatedPlan = {
        dailyCalories: plan.dailyCalories,
        meals: plan.meals.map((meal: any) => ({
            name: meal.name,
            foods: meal.foods,
        })),
    };
    return validatedPlan;
}

http.route({
    path: "/generate-program",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const payload = await request.json();

            const {
                user_id,
                age,
                height,
                weight,
                injuries,
                workout_days,
                fitness_goal,
                fitness_level,
                dietary_restrictions,
            } = payload;

            console.log("Payload is here:", payload);

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
Age: ${age}
Height: ${height}
Weight: ${weight}
Injuries or limitations: ${injuries}
Available days for workout: ${workout_days}
Fitness goal: ${fitness_goal}
Fitness level: ${fitness_level}

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

            const strategyText = await generateText({
                messages: [{ role: "user", content: strategyPrompt }],
                modelRole: "planning",
            });

            // VALIDATE THE INPUT COMING FROM AI
            let trainingStrategy = JSON.parse(strategyText);
            trainingStrategy = validateStrategy(trainingStrategy);

            // Create minimal placeholder workout plan to satisfy schema
            const placeholderWorkoutPlan = {
                schedule: [],
                exercises: [],
            };

            const dietPrompt = `You are an experienced nutrition coach creating a personalized diet plan based on:
        Age: ${age}
        Height: ${height}
        Weight: ${weight}
        Fitness goal: ${fitness_goal}
        Dietary restrictions: ${dietary_restrictions}
        
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

            const dietPlanText = await generateText({
                messages: [{ role: "user", content: dietPrompt }],
                modelRole: "planning",
            });

            // VALIDATE THE INPUT COMING FROM AI
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

            // Plans are deprecated - create goal and update profile instead
            // Helper function to convert fitness goal to goal category
            function fitnessGoalToCategory(fitnessGoal: string): "body_composition" | "strength" | "endurance" | "mobility" | "skill" {
                const lower = fitnessGoal.toLowerCase();
                if (lower.includes("lose") || lower.includes("fat") || lower.includes("weight") || lower.includes("cut")) {
                    return "body_composition";
                }
                if (lower.includes("strength") || lower.includes("strong") || lower.includes("power") || lower.includes("lift")) {
                    return "strength";
                }
                if (lower.includes("endurance") || lower.includes("cardio") || lower.includes("run") || lower.includes("marathon")) {
                    return "endurance";
                }
                if (lower.includes("mobility") || lower.includes("flexibility")) {
                    return "mobility";
                }
                if (lower.includes("skill") || lower.includes("technique")) {
                    return "skill";
                }
                return "body_composition";
            }

            // Create goal instead of plan
            const goalCategory = fitnessGoalToCategory(fitness_goal);
            const goalDirection = goalCategory === "body_composition"
                ? (fitness_goal.toLowerCase().includes("lose") || fitness_goal.toLowerCase().includes("fat") ? "decrease" : "increase")
                : "increase";

            await ctx.runMutation(api.goals.createGoal, {
                userId: user_id,
                category: goalCategory,
                direction: goalDirection,
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        message: "Goal created successfully. Use generateDailyWorkoutAndMeals to generate today's workout.",
                        trainingStrategy: trainingStrategy,
                        dietPlan: transformedDietPlan,
                    },
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        } catch (error) {
            console.error("Error generating fitness plan:", error);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

http.route({
    path: "/add-meal",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const payload = await request.json();

            const { plan_id, meal } = payload;

            if (!plan_id) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "plan_id is required",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            if (!meal || !meal.name || !Array.isArray(meal.foods) || typeof meal.calories !== "number") {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "Invalid meal data. Required: name (string), foods (array), calories (number)",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            const result = await ctx.runMutation(api.plans.addMealToPlan, {
                planId: plan_id,
                meal: {
                    name: meal.name,
                    foods: meal.foods,
                    calories: meal.calories,
                    instructions: meal.instructions,
                },
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    data: result,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        } catch (error) {
            console.error("Error adding meal:", error);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

http.route({
    path: "/update-meal",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const payload = await request.json();

            const { plan_id, meal_index, meal } = payload;

            if (!plan_id || typeof meal_index !== "number") {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "plan_id and meal_index are required",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            if (!meal || !meal.name || !Array.isArray(meal.foods) || typeof meal.calories !== "number") {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "Invalid meal data. Required: name (string), foods (array), calories (number)",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            const result = await ctx.runMutation(api.plans.updateMealInPlan, {
                planId: plan_id,
                mealIndex: meal_index,
                meal: {
                    name: meal.name,
                    foods: meal.foods,
                    calories: meal.calories,
                    instructions: meal.instructions,
                },
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    data: result,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        } catch (error) {
            console.error("Error updating meal:", error);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

http.route({
    path: "/remove-meal",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const payload = await request.json();

            const { plan_id, meal_index } = payload;

            if (!plan_id || typeof meal_index !== "number") {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "plan_id and meal_index are required",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            const result = await ctx.runMutation(api.plans.removeMealFromPlan, {
                planId: plan_id,
                mealIndex: meal_index,
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    data: result,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        } catch (error) {
            console.error("Error removing meal:", error);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

http.route({
    path: "/import-meals",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const payload = await request.json();

            const { meals } = payload;

            if (!meals || !Array.isArray(meals)) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "meals must be an array",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            // Validate meal structure
            for (const meal of meals) {
                if (!meal.name || typeof meal.name !== "string") {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Each meal must have a 'name' (string)",
                        }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                }
                if (!Array.isArray(meal.foods)) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Each meal must have a 'foods' (array)",
                        }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                }
                if (typeof meal.calories !== "number") {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Each meal must have 'calories' (number)",
                        }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                }
                if (!Array.isArray(meal.instructions)) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Each meal must have 'instructions' (array)",
                        }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                }
            }

            const result = await ctx.runAction(api.plans.importMeals, {
                meals: meals.map((meal: any) => ({
                    name: meal.name,
                    foods: meal.foods,
                    calories: meal.calories,
                    instructions: meal.instructions,
                })),
            });

            return new Response(
                JSON.stringify({
                    success: result.success,
                    imported: result.imported,
                    failed: result.failed,
                    results: result.results,
                    errors: result.errors,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        } catch (error) {
            console.error("Error importing meals:", error);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

export default http;
