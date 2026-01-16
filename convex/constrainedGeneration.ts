/**
 * Constrained AI Generation Functions
 * 
 * AI is used ONLY to select exercises/meals and format output.
 * All weights, volumes, calories, and set counts are determined by constraints.
 */

import { generateText } from "./llm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import type { WorkoutIntent, ProgressionTarget, NutritionIntent } from "./constraints";
import { getExerciseContext } from "../src/ai/retrieval/getExerciseContext";
import { getMealContext } from "../src/ai/retrieval/getMealContext";

/**
 * Generate plain text (not JSON) using Gemini LLM
 */
async function generatePlainText(prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-001",
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            // No responseMimeType - returns plain text
        },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Workout Blueprint - structured output from AI
 */
export interface WorkoutBlueprint {
    exercises: Array<{
        exercise: string;
        sets: Array<{
            weight: number;
            reps: number;
        }>;
    }>;
}

/**
 * Meal Plan - structured output from AI
 */
export interface MealPlan {
    meals: Array<{
        name: string;
        calories: number;
        protein: number;
        ingredients: string[];
        instructions: string[];
    }>;
}

/**
 * Generate daily workout using AI, constrained by workout intent and progression targets
 * 
 * AI MUST:
 * - Only select from allowed exercises
 * - Use EXACT weights and rep targets from progressionTargets
 * - Use EXACT number of sets from workoutIntent
 * - NOT invent weights, reps, or sets
 */
export async function generateDailyWorkout({
    workoutIntent,
    progressionTargets,
    exerciseContext,
    blockedExerciseIds,
}: {
    workoutIntent: WorkoutIntent;
    progressionTargets: Record<string, ProgressionTarget>;
    exerciseContext: Array<{ _id: Id<"exercises">; name: string; bodyPart: string; isCompound: boolean; equipment?: string }>;
    blockedExerciseIds: string[];
}): Promise<WorkoutBlueprint> {
    // Filter out blocked exercises
    const allowedExercises = exerciseContext.filter(
        ex => !blockedExerciseIds.includes(ex._id)
    );

    // Filter exercises by body parts
    const bodyPartLower = workoutIntent.bodyParts.map(bp => bp.toLowerCase());
    const relevantExercises = allowedExercises.filter(ex =>
        bodyPartLower.some(bp => ex.bodyPart.toLowerCase().includes(bp) || bp.includes(ex.bodyPart.toLowerCase()))
    );

    if (relevantExercises.length === 0) {
        throw new Error(`No allowed exercises found for body parts: ${workoutIntent.bodyParts.join(", ")}`);
    }

    // Build exercise list for AI prompt
    const exerciseList = relevantExercises.map(ex => ({
        name: ex.name,
        bodyPart: ex.bodyPart,
        isCompound: ex.isCompound,
        equipment: ex.equipment || "bodyweight",
    }));

    // Build progression constraints for AI
    const progressionConstraints = Object.entries(progressionTargets)
        .map(([exerciseName, target]) => 
            `${exerciseName}: ${target.nextWeight}kg × ${target.targetReps} reps`
        )
        .join("\n");

    // Determine set counts
    const compoundExerciseCount = workoutIntent.intensity === "heavy" ? 2 : 3;
    const accessoryExerciseCount = workoutIntent.intensity === "heavy" ? 2 : 3;

    // Build AI prompt with strict constraints
    const prompt = `You are a fitness coach generating a daily workout plan. You MUST follow these constraints exactly:

CONSTRAINTS:
1. Body parts to target: ${workoutIntent.bodyParts.join(", ")}
2. Intensity: ${workoutIntent.intensity}
3. Compound exercises: ${compoundExerciseCount} exercises, ${workoutIntent.compoundSets} sets each
4. Accessory exercises: ${accessoryExerciseCount} exercises, ${workoutIntent.accessorySets} sets each
5. Rep ranges: Compound ${workoutIntent.repRanges.compound}, Accessory ${workoutIntent.repRanges.accessory}

PROGRESSION TARGETS (use EXACT weights and reps if exercise exists here):
${progressionConstraints || "No previous progression data - use conservative starting weights"}

ALLOWED EXERCISES (select ONLY from this list):
${JSON.stringify(exerciseList, null, 2)}

CRITICAL RULES:
- Select ${compoundExerciseCount} compound exercises and ${accessoryExerciseCount} accessory exercises
- For each exercise, create EXACTLY the number of sets specified above
- If an exercise has a progression target, use EXACTLY that weight and those reps for ALL sets
- If an exercise has no progression target, use conservative starting weights (estimate based on exercise type)
- DO NOT invent weights - use the progression targets or reasonable defaults
- DO NOT change the number of sets
- DO NOT add exercises not in the allowed list

Return a JSON object with this exact structure:
{
  "exercises": [
    {
      "exercise": "exercise name",
      "sets": [
        {
          "weight": number (in kg),
          "reps": number
        }
      ]
    }
  ]
}`;

    try {
        const response = await generateText({
            messages: [{ role: "user", content: prompt }],
        });

        // Parse JSON response
        const parsed = JSON.parse(response) as WorkoutBlueprint;

        // Validate structure
        if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
            throw new Error("Invalid workout blueprint structure");
        }

        // Validate each exercise
        for (const exercise of parsed.exercises) {
            if (!exercise.exercise || !exercise.sets || !Array.isArray(exercise.sets)) {
                throw new Error(`Invalid exercise structure: ${JSON.stringify(exercise)}`);
            }

            // Check if exercise is in allowed list
            const exerciseName = exercise.exercise.toLowerCase();
            const isAllowed = relevantExercises.some(ex => 
                ex.name.toLowerCase() === exerciseName
            );

            if (!isAllowed) {
                throw new Error(`Exercise "${exercise.exercise}" is not in allowed list`);
            }

            // Validate sets
            const expectedSets = relevantExercises.find(ex => 
                ex.name.toLowerCase() === exerciseName
            )?.isCompound ? workoutIntent.compoundSets : workoutIntent.accessorySets;

            if (exercise.sets.length !== expectedSets) {
                throw new Error(
                    `Exercise "${exercise.exercise}" has ${exercise.sets.length} sets, expected ${expectedSets}`
                );
            }

            // Validate weights and reps match progression target if exists
            const progressionTarget = progressionTargets[exercise.exercise];
            if (progressionTarget) {
                exercise.sets.forEach((set, index) => {
                    if (Math.abs(set.weight - progressionTarget.nextWeight) > 0.1) {
                        throw new Error(
                            `Set ${index + 1} of "${exercise.exercise}" has weight ${set.weight}kg, expected ${progressionTarget.nextWeight}kg`
                        );
                    }
                    if (set.reps !== progressionTarget.targetReps) {
                        throw new Error(
                            `Set ${index + 1} of "${exercise.exercise}" has ${set.reps} reps, expected ${progressionTarget.targetReps}`
                        );
                    }
                });
            }

            // Validate reps are within range
            const isCompound = relevantExercises.find(ex => 
                ex.name.toLowerCase() === exerciseName
            )?.isCompound || false;
            const repRange = isCompound ? workoutIntent.repRanges.compound : workoutIntent.repRanges.accessory;
            const [minReps, maxReps] = repRange.split("-").map(r => parseInt(r.trim()));

            exercise.sets.forEach((set, index) => {
                if (set.reps < minReps || set.reps > maxReps) {
                    // Allow slight variance but warn
                    console.warn(
                        `Set ${index + 1} of "${exercise.exercise}" has ${set.reps} reps, expected ${repRange}`
                    );
                }
            });
        }

        return parsed;
    } catch (error) {
        console.error("Error generating workout:", error);
        throw new Error(`Failed to generate workout: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generate daily meals using AI, constrained by nutrition intent
 * 
 * AI MUST:
 * - Only select from allowed meals
 * - Match EXACT calorie target (within 50 kcal tolerance)
 * - Meet protein minimum
 * - NOT invent calories
 */
export async function generateDailyMeals({
    nutritionIntent,
    mealContext,
    blockedMealIds,
}: {
    nutritionIntent: NutritionIntent;
    mealContext: Array<{ _id: Id<"meals">; name: string; calories: number; mealType?: string[] }>;
    blockedMealIds: string[];
}): Promise<MealPlan> {
    // Filter out blocked meals
    const allowedMeals = mealContext.filter(
        meal => !blockedMealIds.includes(meal._id)
    );

    if (allowedMeals.length === 0) {
        throw new Error("No allowed meals available");
    }

    // Filter meals by carb bias if needed (optional enhancement)
    // For now, use all allowed meals

    // Build meal list for AI prompt
    const mealList = allowedMeals.map(meal => ({
        name: meal.name,
        calories: meal.calories,
        mealType: meal.mealType || [],
    }));

    // Build AI prompt with strict constraints
    const prompt = `You are a nutritionist generating a daily meal plan. You MUST follow these constraints exactly:

CONSTRAINTS:
1. Total daily calories: ${nutritionIntent.calorieTarget} kcal (must be within 50 kcal)
2. Minimum protein: ${nutritionIntent.proteinMin}g
3. Carb bias: ${nutritionIntent.carbBias}

ALLOWED MEALS (select and combine from this list):
${JSON.stringify(mealList, null, 2)}

CRITICAL RULES:
- Select 3-4 meals from the allowed list
- Total calories MUST be between ${nutritionIntent.calorieTarget - 50} and ${nutritionIntent.calorieTarget + 50} kcal
- Total protein MUST be at least ${nutritionIntent.proteinMin}g
- DO NOT invent calories - use the exact calories from the meal list
- DO NOT create meals not in the allowed list
- Include breakfast, lunch, dinner, and optionally a snack

Return a JSON object with this exact structure:
{
  "meals": [
    {
      "name": "meal name",
      "calories": number (from meal list),
      "protein": number (grams, estimate based on meal),
      "ingredients": ["ingredient1", "ingredient2", ...],
      "instructions": ["step1", "step2", ...]
    }
  ]
}`;

    try {
        const response = await generateText({
            messages: [{ role: "user", content: prompt }],
        });

        // Parse JSON response
        const parsed = JSON.parse(response) as MealPlan;

        // Validate structure
        if (!parsed.meals || !Array.isArray(parsed.meals)) {
            throw new Error("Invalid meal plan structure");
        }

        // Validate each meal
        let totalCalories = 0;
        let totalProtein = 0;

        for (const meal of parsed.meals) {
            if (!meal.name || typeof meal.calories !== "number" || typeof meal.protein !== "number") {
                throw new Error(`Invalid meal structure: ${JSON.stringify(meal)}`);
            }

            // Check if meal is in allowed list
            const mealName = meal.name.toLowerCase();
            const allowedMeal = allowedMeals.find(m => 
                m.name.toLowerCase() === mealName
            );

            if (!allowedMeal) {
                throw new Error(`Meal "${meal.name}" is not in allowed list`);
            }

            // Validate calories match meal list
            if (Math.abs(meal.calories - allowedMeal.calories) > 1) {
                throw new Error(
                    `Meal "${meal.name}" has ${meal.calories} kcal, but allowed meal has ${allowedMeal.calories} kcal`
                );
            }

            totalCalories += meal.calories;
            totalProtein += meal.protein;
        }

        // Validate total calories
        const calorieDiff = Math.abs(totalCalories - nutritionIntent.calorieTarget);
        if (calorieDiff > 100) {
            throw new Error(
                `Total calories ${totalCalories} kcal is ${calorieDiff} kcal away from target ${nutritionIntent.calorieTarget} kcal (max 100 kcal tolerance)`
            );
        }

        // Validate protein minimum
        if (totalProtein < nutritionIntent.proteinMin) {
            throw new Error(
                `Total protein ${totalProtein}g is below minimum ${nutritionIntent.proteinMin}g`
            );
        }

        return parsed;
    } catch (error) {
        console.error("Error generating meals:", error);
        throw new Error(`Failed to generate meals: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generate a brief explanation of why this workout was chosen based on the goal
 */
export async function generateWorkoutExplanation({
    workoutBlueprint,
    workoutIntent,
    activeGoal,
}: {
    workoutBlueprint: WorkoutBlueprint;
    workoutIntent: WorkoutIntent;
    activeGoal: { category: string; target?: { exercise?: string; movement?: string }; direction?: string; value?: number; unit?: string };
}): Promise<string> {
    const exerciseNames = workoutBlueprint.exercises.map(e => e.exercise).join(", ");
    const bodyParts = workoutIntent.bodyParts.join(", ");
    
    const goalDescription = activeGoal.category === "strength" && activeGoal.target?.exercise
        ? `your goal to ${activeGoal.direction || "improve"} ${activeGoal.target.exercise}${activeGoal.value ? ` to ${activeGoal.value} ${activeGoal.unit || "lbs"}` : ""}`
        : activeGoal.category === "body_composition"
        ? `your ${activeGoal.direction || "body composition"} goal${activeGoal.value ? ` of ${activeGoal.value} ${activeGoal.unit || "lbs"}` : ""}`
        : `your ${activeGoal.category} goal`;

    const prompt = `You are a fitness coach explaining today's workout in the context of the user's overall fitness plan. Write 2-3 sentences explaining:
- Why these specific exercises (${exerciseNames}) were selected for today
- How this ${workoutIntent.intensity} intensity workout targeting ${bodyParts} strategically supports ${goalDescription}
- How this workout fits into the broader plan to achieve their goal

Be concise, motivational, and contextual. Explain it as part of a cohesive plan, not just a standalone workout. Write in second person (e.g., "Today's workout is designed to...").`;

    try {
        const response = await generatePlainText(prompt);
        return response.trim();
    } catch (error) {
        console.error("Error generating workout explanation:", error);
        return `This ${workoutIntent.intensity} workout targets ${bodyParts} to support your ${activeGoal.category} goals.`;
    }
}

/**
 * Generate a brief explanation of why these meals were chosen based on the goal
 */
export async function generateMealExplanation({
    mealPlan,
    nutritionIntent,
    activeGoal,
}: {
    mealPlan: MealPlan;
    nutritionIntent: NutritionIntent;
    activeGoal: { category: string; target?: { exercise?: string; movement?: string }; direction?: string; value?: number; unit?: string };
}): Promise<string> {
    const mealNames = mealPlan.meals.map(m => m.name).join(", ");
    
    const goalDescription = activeGoal.category === "strength" && activeGoal.target?.exercise
        ? `your goal to ${activeGoal.direction || "improve"} ${activeGoal.target.exercise}`
        : activeGoal.category === "body_composition"
        ? `your ${activeGoal.direction || "body composition"} goal`
        : `your ${activeGoal.category} goal`;

    const prompt = `You are a nutritionist explaining today's meal plan in the context of the user's overall fitness plan. Write 2-3 sentences explaining:
- Why these specific meals (${mealNames}) were selected for today
- How the ${nutritionIntent.calorieTarget} calorie target and ${nutritionIntent.proteinMin}g protein minimum strategically support ${goalDescription}
- How this meal plan works together with their workout plan to maximize results

Be concise, motivational, and contextual. Explain it as part of a cohesive plan that complements their training. Write in second person (e.g., "Today's meals are designed to...").`;

    try {
        const response = await generatePlainText(prompt);
        return response.trim();
    } catch (error) {
        console.error("Error generating meal explanation:", error);
        return `These meals provide ${nutritionIntent.calorieTarget} calories and ${nutritionIntent.proteinMin}g protein to support your ${activeGoal.category} goals.`;
    }
}
