/**
 * Validation Layer
 * 
 * Validates AI-generated workouts and meals against constraints.
 * Rejects invalid outputs and triggers regeneration if needed.
 */

import type { WorkoutBlueprint, MealPlan } from "./constrainedGeneration";
import type { WorkoutIntent, ProgressionTarget, NutritionIntent } from "./constraints";

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate workout blueprint against constraints
 */
export function validateWorkoutBlueprint(
    blueprint: WorkoutBlueprint,
    workoutIntent: WorkoutIntent,
    progressionTargets: Record<string, ProgressionTarget>,
    allowedExerciseNames: string[]
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check exercise count
    // Strengthen intensity uses fewer exercises (more focus), maintain/recover use more variety
    const expectedCompoundCount = workoutIntent.intensity === "strengthen" ? 2 : 3;
    const expectedAccessoryCount = workoutIntent.intensity === "strengthen" ? 2 : 3;
    const expectedTotal = expectedCompoundCount + expectedAccessoryCount;

    if (blueprint.exercises.length !== expectedTotal) {
        errors.push(
            `Expected ${expectedTotal} exercises (${expectedCompoundCount} compound, ${expectedAccessoryCount} accessory), got ${blueprint.exercises.length}`
        );
    }

    // Validate each exercise
    let compoundCount = 0;
    let accessoryCount = 0;

    for (const exercise of blueprint.exercises) {
        // Check if exercise is allowed
        const isAllowed = allowedExerciseNames.some(name =>
            name.toLowerCase() === exercise.exercise.toLowerCase()
        );

        if (!isAllowed) {
            errors.push(`Exercise "${exercise.exercise}" is not in allowed list`);
        }

        // Check set count
        const progressionTarget = progressionTargets[exercise.exercise];
        const expectedSets = progressionTarget 
            ? (progressionTarget.nextWeight > 0 ? workoutIntent.compoundSets : workoutIntent.accessorySets)
            : workoutIntent.compoundSets; // Default to compound sets

        if (exercise.sets.length !== expectedSets) {
            errors.push(
                `Exercise "${exercise.exercise}" has ${exercise.sets.length} sets, expected ${expectedSets}`
            );
        }

        // Check if compound or accessory (heuristic: compound exercises typically have higher weight)
        const avgWeight = exercise.sets.reduce((sum, s) => sum + s.weight, 0) / exercise.sets.length;
        const isCompound = avgWeight > 20; // Heuristic threshold

        if (isCompound) {
            compoundCount++;
        } else {
            accessoryCount++;
        }

        // Validate sets match progression target
        if (progressionTarget) {
            exercise.sets.forEach((set, index) => {
                if (Math.abs(set.weight - progressionTarget.nextWeight) > 0.1) {
                    errors.push(
                        `Set ${index + 1} of "${exercise.exercise}" has weight ${set.weight}kg, expected ${progressionTarget.nextWeight}kg`
                    );
                }
                if (set.reps !== progressionTarget.targetReps) {
                    errors.push(
                        `Set ${index + 1} of "${exercise.exercise}" has ${set.reps} reps, expected ${progressionTarget.targetReps}`
                    );
                }
            });
        }

        // Validate rep ranges
        const repRange = isCompound ? workoutIntent.repRanges.compound : workoutIntent.repRanges.accessory;
        const [minReps, maxReps] = repRange.split("-").map(r => parseInt(r.trim()));

        exercise.sets.forEach((set, index) => {
            if (set.reps < minReps || set.reps > maxReps) {
                warnings.push(
                    `Set ${index + 1} of "${exercise.exercise}" has ${set.reps} reps, expected ${repRange}`
                );
            }
        });

        // Validate weights are reasonable (non-negative, not excessive)
        exercise.sets.forEach((set, index) => {
            if (set.weight < 0) {
                errors.push(`Set ${index + 1} of "${exercise.exercise}" has negative weight`);
            }
            if (set.weight > 500) {
                warnings.push(`Set ${index + 1} of "${exercise.exercise}" has very high weight ${set.weight}kg`);
            }
            if (set.reps < 1) {
                errors.push(`Set ${index + 1} of "${exercise.exercise}" has invalid rep count ${set.reps}`);
            }
        });
    }

    // Check compound/accessory balance
    if (compoundCount < expectedCompoundCount) {
        warnings.push(`Expected ${expectedCompoundCount} compound exercises, found ${compoundCount}`);
    }
    if (accessoryCount < expectedAccessoryCount) {
        warnings.push(`Expected ${expectedAccessoryCount} accessory exercises, found ${accessoryCount}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate meal plan against constraints
 */
export function validateMealPlan(
    mealPlan: MealPlan,
    nutritionIntent: NutritionIntent,
    allowedMealNames: string[]
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check meal count
    if (mealPlan.meals.length < 3 || mealPlan.meals.length > 5) {
        warnings.push(`Expected 3-4 meals, got ${mealPlan.meals.length}`);
    }

    let totalCalories = 0;
    let totalProtein = 0;

    // Validate each meal
    for (const meal of mealPlan.meals) {
        // Check if meal is allowed
        const isAllowed = allowedMealNames.some(name =>
            name.toLowerCase() === meal.name.toLowerCase()
        );

        if (!isAllowed) {
            errors.push(`Meal "${meal.name}" is not in allowed list`);
        }

        // Validate calories are reasonable
        if (meal.calories < 100 || meal.calories > 1500) {
            warnings.push(`Meal "${meal.name}" has unusual calorie count: ${meal.calories} kcal`);
        }

        // Validate protein is reasonable
        if (meal.protein < 0 || meal.protein > 100) {
            warnings.push(`Meal "${meal.name}" has unusual protein count: ${meal.protein}g`);
        }

        totalCalories += meal.calories;
        totalProtein += meal.protein;
    }

    // Validate total calories
    const calorieDiff = Math.abs(totalCalories - nutritionIntent.calorieTarget);
    if (calorieDiff > 50) {
        errors.push(
            `Total calories ${totalCalories} kcal is ${calorieDiff} kcal away from target ${nutritionIntent.calorieTarget} kcal (max 50 kcal tolerance)`
        );
    } else if (calorieDiff > 25) {
        warnings.push(
            `Total calories ${totalCalories} kcal is ${calorieDiff} kcal away from target ${nutritionIntent.calorieTarget} kcal`
        );
    }

    // Validate protein minimum
    if (totalProtein < nutritionIntent.proteinMin) {
        errors.push(
            `Total protein ${totalProtein}g is below minimum ${nutritionIntent.proteinMin}g`
        );
    } else if (totalProtein < nutritionIntent.proteinMin * 1.1) {
        warnings.push(
            `Total protein ${totalProtein}g is close to minimum ${nutritionIntent.proteinMin}g`
        );
    }

    // Check for duplicate meals
    const mealNames = mealPlan.meals.map(m => m.name.toLowerCase());
    const duplicates = mealNames.filter((name, index) => mealNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
        warnings.push(`Duplicate meals found: ${duplicates.join(", ")}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Check if exercises/meals are blocked
 */
export function checkBlockedItems(
    itemNames: string[],
    blockedItems: Array<{ itemName: string }>
): string[] {
    const blockedNames = blockedItems.map(item => item.itemName.toLowerCase());
    return itemNames.filter(name =>
        blockedNames.some(blocked => blocked === name.toLowerCase())
    );
}
