/**
 * Constrained AI Generation Functions
 * 
 * AI is used ONLY to select exercises/meals and format output.
 * All weights, volumes, calories, and set counts are determined by constraints.
 */

import { generateText } from "./llm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Id } from "./_generated/dataModel";
import { QueryCtx, ActionCtx } from "./_generated/server";
import type { WorkoutIntent, ProgressionTarget, NutritionIntent, RecentWorkout } from "./constraints";
import { getExerciseContext } from "../src/ai/retrieval/getExerciseContext";
import { getMealContext } from "../src/ai/retrieval/getMealContext";
import { getSplitDayTemplate } from "./split_templates";
import { api } from "./_generated/api";
import type { AIExplanationContext } from "./scheduledWorkouts";

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

    // Filter out stretch exercises from main workout (stretches go in separate session)
    const nonStretchExercises = allowedExercises.filter(ex => {
        const nameLower = ex.name.toLowerCase();
        // Exclude exercises with "stretch" in the name
        // Exclude exercises that are clearly stretches (circles, mobility movements)
        const isStretch = nameLower.includes("stretch") || 
                         nameLower.includes("circle") ||
                         nameLower.includes("mobility") ||
                         (nameLower.includes("doorway") && nameLower.includes("chest"));
        return !isStretch;
    });

    // Filter exercises by body parts
    const bodyPartLower = workoutIntent.bodyParts.map(bp => bp.toLowerCase());
    let relevantExercises = nonStretchExercises.filter(ex =>
        bodyPartLower.some(bp => ex.bodyPart.toLowerCase().includes(bp) || bp.includes(ex.bodyPart.toLowerCase()))
    );

    // If targetExercise is specified (for strength goals with primary lift or endurance goals), prioritize it
    let primaryLiftExercise: typeof relevantExercises[0] | null = null;
    if (workoutIntent.targetExercise) {
        const targetLower = workoutIntent.targetExercise.toLowerCase();
        
        // Find the primary lift exercise first
        primaryLiftExercise = relevantExercises.find(ex => {
            const exNameLower = ex.name.toLowerCase();
            return exNameLower === targetLower || 
                   exNameLower.includes(targetLower) || 
                   targetLower.includes(exNameLower);
        }) || null;
        
        // If not found in relevant exercises, search all non-stretch exercises
        if (!primaryLiftExercise) {
            primaryLiftExercise = nonStretchExercises.find(ex => {
                const exNameLower = ex.name.toLowerCase();
                return exNameLower === targetLower || 
                       exNameLower.includes(targetLower) ||
                       targetLower.includes(exNameLower);
            }) || null;
        }
        
        // Filter relevant exercises to include primary lift and supporting muscle groups
        // For strength goals, we want primary lift + other exercises for that split day
        // For endurance goals, we want only the target exercise
        const isEnduranceGoal = workoutIntent.bodyParts.some(bp => 
            bp.toLowerCase().includes("cardio") || 
            workoutIntent.targetExercise?.toLowerCase().includes("run") ||
            workoutIntent.targetExercise?.toLowerCase().includes("cycle")
        );
        
        if (isEnduranceGoal) {
            // Endurance: only target exercise
            relevantExercises = primaryLiftExercise 
                ? [primaryLiftExercise] 
                : relevantExercises.filter(ex => 
                    ex.name.toLowerCase().includes(targetLower) || 
                    targetLower.includes(ex.name.toLowerCase())
                );
        } else {
            // Strength: primary lift + other exercises for the split day
            // Keep all relevant exercises (they match the split day body parts)
            // Primary lift will be prioritized but we still want other exercises
            if (primaryLiftExercise && !relevantExercises.some(ex => ex._id === primaryLiftExercise!._id)) {
                // Primary lift not in relevant exercises, add it
                relevantExercises.push(primaryLiftExercise);
            }
            // Don't filter out other exercises - we want the full split day workout
        }
    }

    if (relevantExercises.length === 0) {
        throw new Error(`No allowed exercises found for body parts: ${workoutIntent.bodyParts.join(", ")}${workoutIntent.targetExercise ? ` and target exercise: ${workoutIntent.targetExercise}` : ""}`);
    }

    // Build exercise list for AI prompt
    // If primary lift exists, put it FIRST in the list
    const exerciseList: Array<{ name: string; bodyPart: string; isCompound: boolean; equipment: string; isPrimaryLift?: boolean }> = [];
    
    if (primaryLiftExercise) {
        // Add primary lift first
        exerciseList.push({
            name: primaryLiftExercise.name,
            bodyPart: primaryLiftExercise.bodyPart,
            isCompound: primaryLiftExercise.isCompound,
            equipment: primaryLiftExercise.equipment || "bodyweight",
            isPrimaryLift: true,
        });
    }
    
    // Add other relevant exercises (accessories)
    exerciseList.push(...relevantExercises.map(ex => ({
        name: ex.name,
        bodyPart: ex.bodyPart,
        isCompound: ex.isCompound,
        equipment: ex.equipment || "bodyweight",
    })));

    // Build progression constraints for AI
    const progressionConstraints = Object.entries(progressionTargets)
        .map(([exerciseName, target]) => 
            `${exerciseName}: ${target.nextWeight}kg × ${target.targetReps} reps`
        )
        .join("\n");

    // Determine set counts
    // Strengthen intensity uses fewer exercises (more focus), maintain/recover use more variety
    const compoundExerciseCount = workoutIntent.intensity === "strengthen" ? 2 : 3;
    const accessoryExerciseCount = workoutIntent.intensity === "strengthen" ? 2 : 3;

    // Build AI prompt with strict constraints
    const isStrengthGoal = workoutIntent.targetExercise && !workoutIntent.bodyParts.some(bp => 
        bp.toLowerCase().includes("cardio")
    );
    
    const targetExerciseNote = workoutIntent.targetExercise 
        ? isStrengthGoal
            ? `\nCRITICAL: Today is a PRIMARY LIFT TEST DAY. The exercise "${workoutIntent.targetExercise}" is the user's strength goal. You MUST select it FIRST, then select ${accessoryExerciseCount} OTHER exercises for the same muscle groups (${workoutIntent.bodyParts.join(", ")}). Do NOT only select the primary lift - include other exercises for those muscles too.`
            : `\nCRITICAL: You MUST select ONLY exercises related to "${workoutIntent.targetExercise}". This is the user's specific goal exercise.`
        : "";

    const prompt = `You are a fitness coach generating a daily workout plan. You MUST follow these constraints exactly:

CONSTRAINTS:
1. Body parts to target: ${workoutIntent.bodyParts.join(", ")}${targetExerciseNote}
2. Intensity: ${workoutIntent.intensity}
3. Compound exercises: ${compoundExerciseCount} exercises, ${workoutIntent.compoundSets} sets each
4. Accessory exercises: ${accessoryExerciseCount} exercises, ${workoutIntent.accessorySets} sets each
5. Rep ranges: Compound ${workoutIntent.repRanges.compound}, Accessory ${workoutIntent.repRanges.accessory}

PROGRESSION TARGETS (use EXACT weights and reps if exercise exists here):
${progressionConstraints || "No previous progression data - use conservative starting weights"}

ALLOWED EXERCISES (select ONLY from this list):
${JSON.stringify(exerciseList, null, 2)}

CRITICAL RULES:
${workoutIntent.targetExercise 
    ? isStrengthGoal
        ? `- The exercise "${workoutIntent.targetExercise}" is the user's PRIMARY LIFT goal. You MUST select it FIRST in your response.
- After selecting the primary lift, select ${accessoryExerciseCount} OTHER exercises from the same muscle groups (${workoutIntent.bodyParts.join(", ")}).
- IMPORTANT: Include OTHER exercises for these muscles, not just the primary lift. The workout should have variety.
- The primary lift should appear FIRST in the exercises array, followed by other exercises for those muscle groups.`
        : `- You MUST select ONLY exercises related to "${workoutIntent.targetExercise}". This is the user's specific goal - focus ONLY on improving this exercise.`
    : `- Select ${compoundExerciseCount} compound exercises and ${accessoryExerciseCount} accessory exercises for the body parts: ${workoutIntent.bodyParts.join(", ")}`}
- For each exercise, create EXACTLY the number of sets specified above
- If an exercise has a progression target, use EXACTLY that weight and those reps for ALL sets
- If an exercise has no progression target, use conservative starting weights (estimate based on exercise type)
- DO NOT invent weights - use the progression targets or reasonable defaults
- DO NOT change the number of sets
- DO NOT add exercises not in the allowed list
${workoutIntent.targetExercise && !isStrengthGoal ? `- DO NOT select other exercises - ONLY select exercises that match "${workoutIntent.targetExercise}"` : ""}

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

        // For strength goals with primary lift, validate it appears first
        if (workoutIntent.targetExercise && primaryLiftExercise && isStrengthGoal) {
            const firstExercise = parsed.exercises[0];
            if (!firstExercise) {
                throw new Error("Workout must include at least one exercise");
            }
            
            const firstExerciseName = firstExercise.exercise.toLowerCase();
            const targetLower = workoutIntent.targetExercise.toLowerCase();
            const primaryLiftName = primaryLiftExercise.name.toLowerCase();
            
            // Check if first exercise matches the primary lift
            if (firstExerciseName !== primaryLiftName && 
                !firstExerciseName.includes(targetLower) && 
                !targetLower.includes(firstExerciseName)) {
                throw new Error(
                    `Primary lift "${workoutIntent.targetExercise}" must appear FIRST in the workout. ` +
                    `Found "${firstExercise.exercise}" instead. Please regenerate.`
                );
            }
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
 * Get exercises from database matching body part and type
 */
async function getExercisesForTemplate(
    ctx: ActionCtx,
    bodyPart: string,
    isCompound: boolean,
    blockedExerciseIds: string[]
): Promise<Array<{ _id: Id<"exercises">; name: string; bodyPart: string; isCompound: boolean }>> {
    // Get all exercises from database
    const allExercises = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {});
    
    // Filter by body part (fuzzy matching)
    const bodyPartLower = bodyPart.toLowerCase();
    let matching = allExercises.filter(ex => {
        const exBodyPart = ex.bodyPart?.toLowerCase();
        if (!exBodyPart) return false;
        return exBodyPart.includes(bodyPartLower) || bodyPartLower.includes(exBodyPart);
    });
    
    // Filter by compound/accessory type
    matching = matching.filter(ex => ex.isCompound === isCompound);
    
    // Filter out blocked exercises
    matching = matching.filter(ex => !blockedExerciseIds.includes(ex._id));
    
    // Map to ensure bodyPart is always a string (not undefined)
    return matching.map(ex => ({
        _id: ex._id,
        name: ex.name,
        bodyPart: ex.bodyPart || ex.bodyParts?.[0] || "",
        isCompound: ex.isCompound,
    }));
}

/**
 * Get exercises used in recent workouts of the same split day type
 */
async function getRecentlyUsedExercises(
    ctx: ActionCtx,
    userId: Id<"users">,
    splitDayName: string,
    recentWorkouts: RecentWorkout[],
    lookbackWorkouts: number = 3
): Promise<Set<Id<"exercises">>> {
    const recentlyUsed = new Set<Id<"exercises">>();
    
    // Get the template to determine which body parts match this split day
    const template = getSplitDayTemplate(splitDayName);
    if (!template) {
        return recentlyUsed;
    }
    
    // Get body parts for this split day
    const splitDayBodyParts = new Set(
        template.exercises.map(ex => ex.bodyPart.toLowerCase())
    );
    
    // Find recent workouts that match this split day type
    const matchingWorkouts: RecentWorkout[] = [];
    for (const workout of recentWorkouts) {
        const workoutBodyParts = new Set(
            workout.bodyParts.map(bp => bp.toLowerCase())
        );
        
        // Check if workout matches this split day type
        let matches = false;
        for (const bodyPart of splitDayBodyParts) {
            if (Array.from(workoutBodyParts).some(wbp => 
                wbp.includes(bodyPart) || bodyPart.includes(wbp)
            )) {
                matches = true;
                break;
            }
        }
        
        if (matches) {
            matchingWorkouts.push(workout);
        }
    }
    
    // Get exercises from the last N matching workouts
    const workoutsToCheck = matchingWorkouts.slice(-lookbackWorkouts);
    
    // Get all exercises once (more efficient than querying in loop)
    const exerciseContext = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {});
    const exerciseNameToId = new Map<string, Id<"exercises">>();
    for (const ex of exerciseContext) {
        exerciseNameToId.set(ex.name.toLowerCase(), ex._id);
    }
    
    for (const workout of workoutsToCheck) {
        for (const exercise of workout.exercises) {
            const exerciseId = exerciseNameToId.get(exercise.name.toLowerCase());
            if (exerciseId) {
                recentlyUsed.add(exerciseId);
            }
        }
    }
    
    return recentlyUsed;
}

/**
 * Randomly select an exercise from candidates, with preference for less recently used
 */
function selectRandomExercise<T extends { _id: Id<"exercises"> }>(
    candidates: T[],
    recentlyUsed: Set<Id<"exercises">>
): T | null {
    if (candidates.length === 0) {
        return null;
    }
    
    // Separate into recently used and not recently used
    const notRecentlyUsed = candidates.filter(ex => !recentlyUsed.has(ex._id));
    const recentlyUsedList = candidates.filter(ex => recentlyUsed.has(ex._id));
    
    // Prefer exercises not used recently (80% chance), but allow recently used if needed
    const pool = notRecentlyUsed.length > 0 && Math.random() < 0.8
        ? notRecentlyUsed
        : candidates;
    
    // Random selection
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex] || null;
}

/**
 * Get default weight and reps for an exercise based on type, rep range, intensity, and progression target
 */
function getDefaultWeightAndReps(
    exerciseType: "compound" | "accessory",
    repRange: string,
    intensity: "strengthen" | "maintain" | "recover",
    progressionTarget?: ProgressionTarget
): { weight: number; reps: number } {
    // Parse rep range
    const [minReps, maxReps] = repRange.split("-").map(r => parseInt(r.trim()));
    const targetReps = Math.floor((minReps + maxReps) / 2);
    
    // Base weight from progression target or default
    let baseWeight: number;
    if (progressionTarget && progressionTarget.nextWeight > 0) {
        baseWeight = progressionTarget.nextWeight;
    } else {
        // Conservative default weights based on exercise type
        baseWeight = exerciseType === "compound" ? 20 : 10; // kg
    }
    
    // Apply intensity-based adjustments
    let workoutWeight: number;
    let workoutReps: number;
    
    if (intensity === "strengthen") {
        // Strengthen: Use full progression target weight
        // If user hit target reps in previous workout, weight should already be increased
        workoutWeight = baseWeight;
        workoutReps = progressionTarget?.targetReps || targetReps;
    } else if (intensity === "maintain") {
        // Maintain: Slight reduction (5%) or maintain current weight
        // Allows for slight increases if progression target suggests it
        if (progressionTarget && progressionTarget.nextWeight > 0) {
            // Use progression target but slightly conservative (95% of progression)
            workoutWeight = baseWeight * 0.95;
        } else {
            workoutWeight = baseWeight;
        }
        workoutReps = progressionTarget?.targetReps || targetReps;
    } else {
        // Recover: Drop weight by 20% from progression target to help recovery
        workoutWeight = baseWeight * 0.80;
        // Increase reps slightly for easier recovery work
        workoutReps = targetReps + 2;
    }
    
    // Round weight to nearest 2.5kg for practical loading
    workoutWeight = Math.round(workoutWeight / 2.5) * 2.5;
    if (workoutWeight < 2.5) workoutWeight = 2.5; // Minimum weight
    
    return {
        weight: workoutWeight,
        reps: workoutReps,
    };
}

/**
 * Generate workout from hardcoded split template
 * 
 * Replaces AI-based exercise selection with database queries and template matching.
 */
export async function generateWorkoutFromTemplate({
    workoutIntent,
    progressionTargets,
    splitDayName,
    userId,
    ctx,
    recentWorkouts,
    blockedExerciseIds,
}: {
    workoutIntent: WorkoutIntent;
    progressionTargets: Record<string, ProgressionTarget>;
    splitDayName: string;
    userId: Id<"users">;
    ctx: ActionCtx;
    recentWorkouts: RecentWorkout[];
    blockedExerciseIds: string[];
}): Promise<WorkoutBlueprint> {
    // Get the split day template
    const template = getSplitDayTemplate(splitDayName);
    if (!template) {
        throw new Error(`No template found for split day: ${splitDayName}`);
    }
    
    // Get recently used exercises for this split day type
    const recentlyUsedExercises = await getRecentlyUsedExercises(
        ctx,
        userId,
        splitDayName,
        recentWorkouts,
        3 // Look at last 3 workouts of same type
    );
    
    // Sort exercises by priority
    const sortedExercises = [...template.exercises].sort((a, b) => a.priority - b.priority);
    
    // Handle primary lift if specified (must be first)
    let primaryLiftExercise: { _id: Id<"exercises">; name: string; bodyPart: string; isCompound: boolean } | null = null;
    if (workoutIntent.targetExercise) {
        const targetLower = workoutIntent.targetExercise.toLowerCase();
        
        // Find primary lift in database
        const allExercises = await ctx.runQuery(api.plans.getExerciseContextForGeneration, {});
        const found: { _id: Id<"exercises">; name: string; bodyPart?: string; bodyParts?: string[]; isCompound: boolean } | undefined = allExercises.find(ex => {
            const exNameLower = ex.name.toLowerCase();
            return exNameLower === targetLower ||
                   exNameLower.includes(targetLower) ||
                   targetLower.includes(exNameLower);
        });
        if (found) {
            primaryLiftExercise = {
                _id: found._id,
                name: found.name,
                bodyPart: found.bodyPart || found.bodyParts?.[0] || "",
                isCompound: found.isCompound,
            };
        }
        
        if (primaryLiftExercise && blockedExerciseIds.includes(primaryLiftExercise._id)) {
            // Primary lift is blocked, can't use it
            primaryLiftExercise = null;
        }
    }
    
    // Build workout exercises
    const workoutExercises: Array<{
        exercise: string;
        sets: Array<{ weight: number; reps: number }>;
    }> = [];
    
    // If we have a primary lift, add it first (matching first compound slot)
    if (primaryLiftExercise) {
        const firstCompoundSlot = sortedExercises.find(ex => ex.type === "compound");
        if (firstCompoundSlot) {
            const progressionTarget = progressionTargets[primaryLiftExercise.name];
            const { weight, reps } = getDefaultWeightAndReps(
                "compound",
                workoutIntent.repRanges.compound,
                workoutIntent.intensity,
                progressionTarget
            );
            
            const sets = Array(workoutIntent.compoundSets).fill(null).map(() => ({
                weight,
                reps,
            }));
            
            workoutExercises.push({
                exercise: primaryLiftExercise.name,
                sets,
            });
            
            // Remove the first compound slot from template (already filled)
            sortedExercises.splice(sortedExercises.indexOf(firstCompoundSlot), 1);
        }
    }
    
    // Fill remaining template slots
    for (const templateExercise of sortedExercises) {
        
        // Get candidates for this slot
        const candidates = await getExercisesForTemplate(
            ctx,
            templateExercise.bodyPart,
            templateExercise.type === "compound",
            blockedExerciseIds
        );
        
        // Filter out exercises already in workout
        const usedNames = new Set(workoutExercises.map(ex => ex.exercise.toLowerCase()));
        const availableCandidates = candidates.filter(ex => 
            !usedNames.has(ex.name.toLowerCase())
        );
        
        // Filter out recently used exercises (but allow if no other options)
        let finalCandidates = availableCandidates.filter(ex => 
            !recentlyUsedExercises.has(ex._id)
        );
        
        // If no candidates after filtering, use all available
        if (finalCandidates.length === 0) {
            finalCandidates = availableCandidates;
        }
        
        // If still no candidates, skip this slot
        if (finalCandidates.length === 0) {
            console.warn(`No exercises found for ${templateExercise.bodyPart} (${templateExercise.type})`);
            continue;
        }
        
        // Randomly select from candidates
        const selected = selectRandomExercise(finalCandidates, recentlyUsedExercises);
        if (!selected) {
            continue;
        }
        
        // Get progression target or defaults
        const progressionTarget = progressionTargets[selected.name];
        const { weight, reps } = getDefaultWeightAndReps(
            templateExercise.type,
            templateExercise.type === "compound" 
                ? workoutIntent.repRanges.compound 
                : workoutIntent.repRanges.accessory,
            workoutIntent.intensity,
            progressionTarget
        );
        
        // Determine number of sets
        const numSets = templateExercise.type === "compound"
            ? workoutIntent.compoundSets
            : workoutIntent.accessorySets;
        
        const sets = Array(numSets).fill(null).map(() => ({
            weight,
            reps,
        }));
        
        workoutExercises.push({
            exercise: selected.name,
            sets,
        });
    }
    
    if (workoutExercises.length === 0) {
        throw new Error(`No exercises could be selected for split day: ${splitDayName}`);
    }
    
    return {
        exercises: workoutExercises,
    };
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
 * Generate a detailed explanation of why this workout was chosen based on the goal
 * Uses the full AIExplanationContext following the structure from AI_EXPLANATION_PROMPT.md
 */
export async function generateWorkoutExplanation({
    aiContext,
}: {
    aiContext: AIExplanationContext;
}): Promise<string> {
    const exerciseNames = aiContext.workoutBlueprint.exercises.map(e => e.exercise).join(", ");
    const bodyParts = aiContext.workoutIntent.bodyParts.join(", ");
    
    // Build the full context JSON for the AI
    const contextJSON = JSON.stringify({
        userId: aiContext.userId,
        userName: aiContext.userName,
        goalType: aiContext.goalType,
        goalDescription: aiContext.goalDescription,
        splitType: aiContext.splitType,
        splitDayName: aiContext.splitDayName,
        workoutDays: aiContext.workoutDays,
        injuries: aiContext.injuries,
        intensity: aiContext.intensity,
        workoutIntent: aiContext.workoutIntent,
        workoutBlueprint: aiContext.workoutBlueprint,
        recentProgress: aiContext.recentProgress,
        equipment: aiContext.equipment,
    }, null, 2);

    const prompt = `You are an expert fitness coach AI assistant. Your role is to generate personalized, motivational explanations for daily workout plans based on comprehensive user context data.

## Your Task

Generate a 2-3 sentence workout explanation that:

1. **Explains Exercise Selection**: Why these specific exercises were chosen
   - Reference the split day (e.g., "Today is your Push day")
   - Mention body parts being targeted
   - Note any injury considerations
   - Reference equipment availability if relevant

2. **Explains Intensity & Strategy**: How the intensity level supports the goal
   - "strengthen": Focus on progressive overload, building strength
   - "maintain": Maintaining current strength while allowing recovery
   - "recover": Lower intensity to aid recovery from injury or fatigue
   - Connect to the user's goal

3. **Explains Plan Integration**: How this workout fits into the broader plan
   - Reference the workout schedule
   - Mention how it builds on recent progress
   - Connect to the overall goal timeline

**Tone**: Concise, motivational, contextual. Write in second person (e.g., "Today's workout is designed to...").

## Context Data

${contextJSON}

**Generate a workout explanation using the context above. Return only the explanation text, no JSON wrapper.**`;

    try {
        const response = await generatePlainText(prompt);
        return response.trim();
    } catch (error) {
        console.error("Error generating workout explanation:", error);
        const bodyParts = aiContext.workoutIntent.bodyParts.join(", ");
        return `This ${aiContext.intensity} workout targets ${bodyParts} to support your ${aiContext.goalType} goals.`;
    }
}

/**
 * Generate a detailed explanation of why these meals were chosen based on the goal
 * Uses the full AIExplanationContext following the structure from AI_EXPLANATION_PROMPT.md
 */
export async function generateMealExplanation({
    aiContext,
}: {
    aiContext: AIExplanationContext;
}): Promise<string> {
    const mealNames = aiContext.mealPlan.meals.map(m => m.name).join(", ");
    
    // Build the full context JSON for the AI
    const contextJSON = JSON.stringify({
        userId: aiContext.userId,
        userName: aiContext.userName,
        goalType: aiContext.goalType,
        goalDescription: aiContext.goalDescription,
        workoutDays: aiContext.workoutDays,
        injuries: aiContext.injuries,
        intensity: aiContext.intensity,
        workoutIntent: aiContext.workoutIntent,
        nutritionIntent: aiContext.nutritionIntent,
        mealPlan: aiContext.mealPlan,
    }, null, 2);

    const prompt = `You are an expert nutritionist AI assistant. Your role is to generate personalized, motivational explanations for daily meal plans based on comprehensive user context data.

## Your Task

Generate a 2-3 sentence meal explanation that:

1. **Explains Meal Selection**: Why these specific meals were chosen
   - Reference calorie and protein targets
   - Mention how they support the workout (pre/post workout nutrition)
   - Note any dietary preferences or restrictions if relevant

2. **Explains Nutrition Strategy**: How the macros support the goal
   - Connect calorie target to goal type (strength = maintenance/slight surplus, body comp = deficit/surplus based on direction)
   - Explain protein minimum for muscle recovery/growth
   - Mention carb bias if relevant (high carbs for strength/endurance, lower for body comp)

3. **Explains Integration**: How meals work with the workout plan
   - Reference today's workout intensity
   - Explain timing considerations if relevant
   - Connect to overall goal progress

**Tone**: Concise, motivational, contextual. Write in second person (e.g., "Today's meals are designed to...").

## Context Data

${contextJSON}

**Generate a meal explanation using the context above. Return only the explanation text, no JSON wrapper.**`;

    try {
        const response = await generatePlainText(prompt);
        return response.trim();
    } catch (error) {
        console.error("Error generating meal explanation:", error);
        return `These meals provide ${aiContext.nutritionIntent.calorieTarget} calories and ${aiContext.nutritionIntent.proteinMin}g protein to support your ${aiContext.goalType} goals.`;
    }
}
