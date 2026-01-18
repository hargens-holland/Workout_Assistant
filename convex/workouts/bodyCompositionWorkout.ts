/**
 * Body Composition Workout Generator
 * 
 * Generates workout intent for body composition goals:
 * - Maintain intensity (balanced for muscle building and calorie burn)
 * - 3 compound sets, 3 accessory sets
 * - Rep ranges adjust based on goal direction
 * - Includes cardio based on cut/bulk and weight loss rate
 * 
 * Goal-Specific Parameters:
 * - direction: "increase" | "decrease" | "achieve"
 *   - "decrease" (weight loss): Higher reps (10-12 compounds, 12-15 accessories) for more calorie burn
 *   - "increase" (weight gain): Lower reps (6-8 compounds, 8-10 accessories) with heavier weights for muscle building
 *   - "achieve" (maintain): Balanced reps (8-10 compounds, 10-12 accessories)
 * - value: Target weight change (e.g., 10 for "lose 10 lbs" or "gain 10 lbs")
 * - unit: Unit of measurement (e.g., "lbs", "kg")
 * - weightLossPerWeek: Optional - amount to lose per week (affects calorie calculation and cardio frequency)
 * 
 * Progression Logic:
 * - Weight loss: Focus on higher reps, moderate weights, more volume for calorie burn
 * - Weight gain: Focus on lower reps, heavier weights, progressive overload for muscle building
 * - Progression: 2.5-5% weight increase when target reps are hit (more conservative for weight loss)
 * 
 * Cardio Logic:
 * - Bulk (increase): Once a week (light cardio for cardiovascular health)
 * - Cut (decrease): Every day or every other day based on weight loss rate
 *   - Fast weight loss (>2 lbs/week): Every day
 *   - Moderate weight loss (1-2 lbs/week): Every other day
 *   - Slow weight loss (<1 lb/week): 2-3 times per week
 */

import type { ActiveGoal, RecentWorkout, WorkoutIntent } from "../constraints";
import { rotateBodyParts, checkFatigue } from "./workoutUtils";

function shouldIncludeCardio(
    direction: "increase" | "decrease" | "achieve" | undefined,
    weightLossPerWeek?: number
): { include: boolean; type: "run" | "incline_walk" | "walk" | undefined; frequency: "daily" | "every_other_day" | "weekly" | undefined } {
    if (direction === "increase") {
        // Bulk: Once a week, light cardio
        return { include: true, type: "walk", frequency: "weekly" };
    } else if (direction === "decrease") {
        // Cut: Based on weight loss rate
        if (!weightLossPerWeek) {
            // Default: moderate weight loss
            return { include: true, type: "incline_walk", frequency: "every_other_day" };
        }
        
        if (weightLossPerWeek > 2) {
            // Fast weight loss: Every day
            return { include: true, type: "run", frequency: "daily" };
        } else if (weightLossPerWeek >= 1) {
            // Moderate weight loss: Every other day
            return { include: true, type: "incline_walk", frequency: "every_other_day" };
        } else {
            // Slow weight loss: 2-3 times per week (every other day)
            return { include: true, type: "walk", frequency: "every_other_day" };
        }
    }
    
    // Maintain/achieve: No cardio
    return { include: false, type: undefined, frequency: undefined };
}

export function generateBodyCompositionWorkout(
    activeGoal: ActiveGoal | null,
    recentWorkouts: RecentWorkout[],
    weightLossPerWeek?: number // Optional: amount to lose per week (lbs/kg)
): WorkoutIntent {
    const intensity = checkFatigue("maintain", recentWorkouts);
    const bodyParts = rotateBodyParts(recentWorkouts);

    // Adjust rep ranges based on goal direction
    let compoundReps = "8-10"; // Default: balanced
    let accessoryReps = "10-12"; // Default: balanced

    if (activeGoal?.direction === "decrease") {
        // Weight loss: Higher reps for more calorie burn and metabolic stress
        compoundReps = "10-12";
        accessoryReps = "12-15";
    } else if (activeGoal?.direction === "increase") {
        // Weight gain: Lower reps with heavier weights for muscle building
        compoundReps = "6-8";
        accessoryReps = "8-10";
    }
    // "achieve" or no direction: use default balanced ranges

    // Determine cardio inclusion based on direction and weight loss rate
    const cardioDecision = shouldIncludeCardio(activeGoal?.direction, weightLossPerWeek);

    return {
        bodyParts,
        intensity,
        compoundSets: 3,
        accessorySets: 3,
        repRanges: {
            compound: compoundReps,
            accessory: accessoryReps,
        },
        workoutType: "main", // Main lifting workout
        includeStretch: true, // Always include SEPARATE stretch workout for all goals
        stretchTemplate: "pre lift", // Pre-lift stretching
        includeCardio: cardioDecision.include,
        cardioType: cardioDecision.type, // Cardio is SEPARATE workout if included
    };
}
