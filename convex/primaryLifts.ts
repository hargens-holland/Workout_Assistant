/**
 * Primary Lifts Definition and Validation
 * 
 * Defines approved PRIMARY LIFTS for strength goals.
 * Only these exercises can be used as targets for strength goals.
 */

import type { Id } from "./_generated/dataModel";

/**
 * Supporting muscle groups for each primary lift category
 * Used to select appropriate accessories for strength workouts
 */
export const PRIMARY_LIFT_SUPPORTING_MUSCLES: Record<string, string[]> = {
    // Upper Push primary lifts
    "bench press": ["chest", "triceps", "front delts"],
    "incline dumbbell press": ["chest", "triceps", "front delts"],
    "chest press": ["chest", "triceps", "front delts"],
    "dumbbell chest press": ["chest", "triceps", "front delts"],
    "dips": ["triceps", "chest", "front delts"],
    "push-ups": ["chest", "triceps", "front delts"],
    "push ups": ["chest", "triceps", "front delts"],
    "shoulder press": ["front delts", "triceps", "lateral delts"],
    "incline dumbbell chest press": ["chest", "triceps", "front delts"],
    "chest cable fly": ["chest", "front delts"],

    // Upper Pull primary lifts
    "pull-ups": ["lats", "biceps", "upper back", "rear delts"],
    "pull ups": ["lats", "biceps", "upper back", "rear delts"],
    "chin-ups": ["lats", "biceps", "upper back", "rear delts"],
    "chin ups": ["lats", "biceps", "upper back", "rear delts"],
    "lat pulldown": ["lats", "biceps", "upper back"],
    "barbell row": ["upper back", "lats", "biceps", "rear delts"],
    "dumbbell row": ["upper back", "lats", "biceps", "rear delts"],
    "seated cable row": ["upper back", "lats", "biceps", "rear delts"],

    // Lower Body primary lifts
    "squat": ["quads", "glutes", "hamstrings"],
    "deadlift": ["hamstrings", "glutes", "lower back"],
    "romanian deadlift": ["hamstrings", "glutes", "lower back"],
    "rdl": ["hamstrings", "glutes", "lower back"],
    "leg press": ["quads", "glutes"],
    "split squat": ["quads", "glutes"],
    "bulgarian split squat": ["quads", "glutes"],

    // Arms primary lifts
    "barbell curl": ["biceps", "forearms"],
    "dumbbell curl": ["biceps", "forearms"],

    // Core primary lifts
    "plank": ["abs", "obliques"],
    "sit-ups": ["abs", "obliques"],
    "sit ups": ["abs", "obliques"],
};

/**
 * Get supporting muscle groups for a primary lift
 * 
 * @param primaryLiftName - The name of the primary lift (normalized)
 * @returns Array of supporting muscle group names
 */
export function getSupportingMuscleGroups(primaryLiftName: string): string[] {
    const normalized = normalizeExerciseName(primaryLiftName);

    // Try exact match first
    if (PRIMARY_LIFT_SUPPORTING_MUSCLES[normalized]) {
        return PRIMARY_LIFT_SUPPORTING_MUSCLES[normalized];
    }

    // Try to find matching primary lift
    const matchingLift = findMatchingPrimaryLift(primaryLiftName);
    if (matchingLift) {
        const matchingNormalized = normalizeExerciseName(matchingLift);
        if (PRIMARY_LIFT_SUPPORTING_MUSCLES[matchingNormalized]) {
            return PRIMARY_LIFT_SUPPORTING_MUSCLES[matchingNormalized];
        }
    }

    // Default: return empty array (will fall back to generic rotation)
    return [];
}

/**
 * Approved PRIMARY LIFTS for strength goals
 * 
 * Organized by movement pattern for reference:
 * - Upper Push: Chest, shoulders, triceps
 * - Upper Pull: Back, lats, biceps
 * - Lower Body: Quads, hamstrings, glutes
 * - Arms: Biceps, triceps (secondary strength goals only)
 * - Core: Abs, obliques
 */
export const PRIMARY_LIFTS = [
    // Upper Push
    "bench press",
    "incline dumbbell press",
    "chest press",
    "dumbbell chest press",
    "dips",
    "push-ups",
    "push ups",
    "shoulder press",
    "incline dumbbell chest press",
    "chest cable fly",

    // Upper Pull
    "pull-ups",
    "pull ups",
    "chin-ups",
    "chin ups",
    "lat pulldown",
    "barbell row",
    "dumbbell row",
    "seated cable row",

    // Lower Body
    "squat",
    "deadlift",
    "romanian deadlift",
    "rdl",
    "leg press",
    "split squat",
    "bulgarian split squat",

    // Arms (secondary strength goals only)
    "barbell curl",
    "dumbbell curl",

    // Core
    "plank",
    "sit-ups",
    "sit ups",
] as const;

/**
 * Normalize exercise name for comparison
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Handle common variations
 */
function normalizeExerciseName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Check if an exercise is an approved PRIMARY LIFT
 * 
 * @param exerciseName - The exercise name to check (case-insensitive)
 * @returns true if the exercise is an approved primary lift
 */
export function isPrimaryLift(exerciseName: string): boolean {
    if (!exerciseName) return false;

    const normalized = normalizeExerciseName(exerciseName);

    // Check exact match
    if (PRIMARY_LIFTS.includes(normalized as any)) {
        return true;
    }

    // Check if any primary lift is contained in the exercise name (for variations)
    // e.g., "Bench Press" matches "bench press", "Incline Bench Press" matches "bench press"
    return PRIMARY_LIFTS.some(lift => {
        const liftNormalized = normalizeExerciseName(lift);
        return normalized.includes(liftNormalized) || liftNormalized.includes(normalized);
    });
}

/**
 * Find the matching primary lift name for an exercise
 * 
 * @param exerciseName - The exercise name to match
 * @returns The matching primary lift name, or null if not found
 */
export function findMatchingPrimaryLift(exerciseName: string): string | null {
    if (!exerciseName) return null;

    const normalized = normalizeExerciseName(exerciseName);

    // Check exact match first
    const exactMatch = PRIMARY_LIFTS.find(lift =>
        normalizeExerciseName(lift) === normalized
    );
    if (exactMatch) return exactMatch;

    // Check if any primary lift is contained in the exercise name
    const partialMatch = PRIMARY_LIFTS.find(lift => {
        const liftNormalized = normalizeExerciseName(lift);
        return normalized.includes(liftNormalized) || liftNormalized.includes(normalized);
    });

    return partialMatch || null;
}

/**
 * Validate that an exercise name exists in the database and is a primary lift
 * 
 * @param ctx - Convex query context
 * @param exerciseName - The exercise name to validate (can be empty for overall strength goals)
 * @returns Object with isValid flag and error message if invalid
 */
export async function validatePrimaryLiftForGoal(
    ctx: { db: any },
    exerciseName: string | undefined | null
): Promise<{ isValid: boolean; error?: string }> {
    // Allow empty exercise name for "overall strength" goals
    if (!exerciseName || !exerciseName.trim()) {
        return { isValid: true }; // Overall strength goal is valid
    }

    // Check if exercise exists in database (case-insensitive)
    const exercises = await ctx.db
        .query("exercises")
        .collect();

    const normalizedInput = normalizeExerciseName(exerciseName);
    const matchingExercise = exercises.find((ex: { name: string }) =>
        normalizeExerciseName(ex.name) === normalizedInput ||
        normalizeExerciseName(ex.name).includes(normalizedInput) ||
        normalizedInput.includes(normalizeExerciseName(ex.name))
    );

    if (!matchingExercise) {
        return {
            isValid: false,
            error: `Exercise "${exerciseName}" not found in exercise database. Please select an exercise from the available exercises.`,
        };
    }

    // Check if it's a primary lift
    if (!isPrimaryLift(matchingExercise.name)) {
        const matchingLift = findMatchingPrimaryLift(matchingExercise.name);
        if (matchingLift) {
            return {
                isValid: false,
                error: `"${exerciseName}" is not an approved PRIMARY LIFT for strength goals. Did you mean "${matchingLift}"? Approved primary lifts include: bench press, squat, deadlift, pull-ups, and others. See the strength goal requirements for the full list.`,
            };
        }

        return {
            isValid: false,
            error: `"${exerciseName}" is not an approved PRIMARY LIFT for strength goals. Strength goals can only target approved primary lifts such as: bench press, squat, deadlift, pull-ups, barbell row, etc.`,
        };
    }

    return { isValid: true };
}
