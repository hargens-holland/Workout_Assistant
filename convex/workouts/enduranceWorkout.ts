/**
 * Endurance Workout Generator
 * 
 * Generates workout intent for endurance goals:
 * - Maintain intensity (sustainable for frequent training)
 * - 0 sets (cardio-only, no lifting)
 * - Focuses on specific exercise or rotates through cardio options
 * 
 * Goal-Specific Parameters:
 * - target.movement/exercise: Specific cardio exercise (e.g., "running", "cycling")
 * - target.metric: "distance" | "time" | "reps" (for distance/time-based goals)
 * - direction: "increase" | "achieve" (e.g., "increase distance", "achieve 5K time")
 * - value: Target value (e.g., 5 for "5 miles", 30 for "30 minutes")
 * - unit: Unit of measurement (e.g., "miles", "km", "minutes")
 * 
 * Progression Logic:
 * - If goal has target value: Progress toward that value (5-10% weekly increases)
 * - If goal is general: Rotate through cardio options, progress distance/time by 5% when target is hit
 * - Distance-based: Increase distance by 5-10% per week when target is achieved
 * - Time-based: Increase duration by 5-10% per week when target is achieved
 * - Pace-based: Improve pace gradually (decrease time for same distance)
 */

import type { ActiveGoal, RecentWorkout, WorkoutIntent } from "../constraints";

const ENDURANCE_CARDIO_OPTIONS = [
    "running",
    "swimming",
    "biking",
    "cycling",
    "rowing",
    "stair climber",
    "elliptical",
    "jump rope",
    "hiking",
] as const;

function getTargetExercise(
    activeGoal: ActiveGoal | null,
    recentWorkouts: RecentWorkout[]
): string | undefined {
    // If specific movement/exercise is specified, use that
    if (activeGoal?.target?.movement || activeGoal?.target?.exercise) {
        const exerciseName = activeGoal.target.exercise || activeGoal.target.movement || "";
        return exerciseName.toLowerCase();
    }

    // General endurance: rotate through cardio options
    const recentCardioExercises = new Set<string>();
    recentWorkouts.slice(-7).forEach(workout => {
        workout.exercises.forEach(ex => {
            const exNameLower = ex.name.toLowerCase();
            ENDURANCE_CARDIO_OPTIONS.forEach(option => {
                if (exNameLower.includes(option) || option.includes(exNameLower)) {
                    recentCardioExercises.add(option);
                }
            });
        });
    });

    const availableCardio = ENDURANCE_CARDIO_OPTIONS.filter(
        option => !recentCardioExercises.has(option)
    );

    if (availableCardio.length > 0) {
        return availableCardio[0];
    } else {
        // All options were recent, rotate through them
        const lastCardio = Array.from(recentCardioExercises)[recentCardioExercises.size - 1];
        const lastIndex = ENDURANCE_CARDIO_OPTIONS.findIndex(opt => opt === lastCardio);
        const nextIndex = (lastIndex + 1) % ENDURANCE_CARDIO_OPTIONS.length;
        return ENDURANCE_CARDIO_OPTIONS[nextIndex];
    }
}

export function generateEnduranceWorkout(
    activeGoal: ActiveGoal | null,
    recentWorkouts: RecentWorkout[]
): WorkoutIntent {
    // Get target exercise based on goal or rotation
    const targetExercise = getTargetExercise(activeGoal, recentWorkouts);

    // Determine stretch template based on target exercise
    let stretchTemplate = "full body"; // Default
    if (targetExercise) {
        const exerciseLower = targetExercise.toLowerCase();
        if (exerciseLower.includes("run") || exerciseLower.includes("jog")) {
            stretchTemplate = "pre run";
        } else if (exerciseLower.includes("swim")) {
            stretchTemplate = "full body"; // Swimming uses full body stretch
        } else {
            stretchTemplate = "full body";
        }
    }

    // Endurance workouts are always maintain intensity (sustainable for frequent training)
    // They focus on cardiovascular adaptation, not strength building
    // Workouts are ENDURANCE EXERCISE ONLY - progressively harder (longer distance and/or faster)
    // This is a SEPARATE workout from any lifting
    return {
        bodyParts: ["cardio"],
        intensity: "maintain",
        compoundSets: 0, // No lifting exercises
        accessorySets: 0, // No lifting exercises
        repRanges: {
            compound: "N/A",
            accessory: "N/A",
        },
        targetExercise, // Specific exercise or rotated option - ONLY this exercise
        workoutType: "endurance", // Separate workout type for endurance
        includeStretch: true, // Always include SEPARATE stretch workout for endurance goals
        stretchTemplate, // Stretch template based on exercise type
    };
}
