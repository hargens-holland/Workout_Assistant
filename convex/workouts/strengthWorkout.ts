/**
 * Strength Workout Generator
 * 
 * Generates workout intent for strength goals:
 * 
 * Two types of strength goals:
 * 1. Specific Primary Lift Goal: Targets a specific approved primary lift (e.g., "bench press to 225 lbs")
 *    - Follows normal split rotation (PPL, Upper/Lower, etc.)
 *    - When it's the primary lift's day, emphasizes it but still includes other exercises
 *    - Uses supporting muscle groups for accessories
 *    - Heavy intensity, 4 compound sets, 2 accessory sets
 *    - 4-6 rep range for compounds, 8-10 for accessories
 * 
 * 2. Overall Strength Goal: General strength improvement (no specific exercise)
 *    - Follows normal split rotation
 *    - Heavy intensity, 4 compound sets, 2 accessory sets
 *    - 4-6 rep range for compounds, 8-10 for accessories
 */

import type { ActiveGoal, RecentWorkout, WorkoutIntent } from "../constraints";
import type { SplitType } from "../splits";
import {
    rotateBodyParts,
    checkFatigue,
    determineSplitDay,
    getBodyPartsForSplitDay,
    isPrimaryLiftDay,
    shouldTestPrimaryLift
} from "./workoutUtils";
import { findMatchingPrimaryLift, getSupportingMuscleGroups } from "../primaryLifts";

export function generateStrengthWorkout(
    activeGoal: ActiveGoal | null,
    recentWorkouts: RecentWorkout[],
    splitType?: SplitType,
    yesterdayDate?: string
): WorkoutIntent {
    const intensity = checkFatigue("strengthen", recentWorkouts);

    // Determine which day of the split cycle we're on
    // If yesterday was missed, we'll repeat the same split day
    const splitDay = determineSplitDay(splitType, recentWorkouts, yesterdayDate);

    // Check if this is a specific primary lift goal or overall strength goal
    const targetExercise = activeGoal?.target?.exercise;

    if (targetExercise) {
        // Specific Primary Lift Goal
        // Find the matching primary lift name
        const primaryLift = findMatchingPrimaryLift(targetExercise);

        if (primaryLift) {
            // Get supporting muscle groups for this primary lift
            const supportingMuscles = getSupportingMuscleGroups(primaryLift);

            // Get body parts based on split day, but factor in primary lift
            // This ensures we follow the split but emphasize primary lift on its day
            const bodyParts = getBodyPartsForSplitDay(
                splitType,
                splitDay,
                supportingMuscles.length > 0 ? supportingMuscles : null,
                recentWorkouts
            );

            // Check if today is the primary lift's day
            const isTodayPrimaryLiftDay = isPrimaryLiftDay(
                splitType,
                splitDay,
                supportingMuscles.length > 0 ? supportingMuscles : null
            );

            // Only test/prioritize primary lift periodically (once every ~2 weeks), not every workout
            // This allows normal split rotation with other exercises
            const shouldTest = shouldTestPrimaryLift(
                primaryLift,
                recentWorkouts,
                isTodayPrimaryLiftDay,
                splitType,
                splitDay
            );

            return {
                bodyParts,
                intensity,
                compoundSets: 4,
                accessorySets: 2,
                repRanges: {
                    compound: "4-6",
                    accessory: "8-10",
                },
                workoutType: "main", // Main lifting workout
                includeStretch: true, // Always include SEPARATE stretch workout
                stretchTemplate: "pre lift", // Pre-lift stretching
                // Only set targetExercise when it's time to test the primary lift
                // This ensures we still do other exercises for that muscle group on other days
                targetExercise: shouldTest ? primaryLift : undefined,
            };
        } else {
            // Exercise specified but not a primary lift (shouldn't happen due to validation, but handle gracefully)
            const bodyParts = getBodyPartsForSplitDay(splitType, splitDay, null, recentWorkouts);
            return {
                bodyParts,
                intensity,
                compoundSets: 4,
                accessorySets: 2,
                repRanges: {
                    compound: "4-6",
                    accessory: "8-10",
                },
            };
        }
    } else {
        // Overall Strength Goal - no specific exercise target
        // Follow normal split rotation
        const bodyParts = getBodyPartsForSplitDay(splitType, splitDay, null, recentWorkouts);

        return {
            bodyParts,
            intensity,
            compoundSets: 4,
            accessorySets: 2,
            repRanges: {
                compound: "4-6",
                accessory: "8-10",
            },
            workoutType: "main", // Main lifting workout
            includeStretch: true, // Always include SEPARATE stretch workout
            stretchTemplate: "pre lift", // Pre-lift stretching
            // No targetExercise - this is overall strength, so we rotate exercises
        };
    }
}
