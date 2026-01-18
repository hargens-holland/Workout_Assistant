/**
 * Mobility Workout Generator
 * 
 * Generates workout intent for mobility goals:
 * - Maintain intensity (focus on form and range of motion, not strength)
 * - 2 compound sets, 2 accessory sets
 * - 12-15 rep range for compounds, 15-20 for accessories
 * 
 * Goal-Specific Parameters:
 * - target.movement: Specific movement pattern to improve (e.g., "hip mobility", "shoulder flexibility")
 * - target.metric: "rom" (range of motion) - primary metric for mobility goals
 * - target.exercise: Specific exercise if applicable (e.g., "hip flexor stretch", "shoulder dislocates")
 * - direction: "increase" | "achieve" (e.g., "increase hip ROM", "achieve full squat depth")
 * - value: Target ROM value if quantifiable (e.g., degrees of flexibility)
 * 
 * Progression Logic:
 * - Focus on quality of movement over quantity of weight
 * - Progress through increased ROM, longer hold times, or slight weight increases (1-2.5kg)
 * - Only progress when form is perfect and full ROM is achieved
 * - High rep ranges (12-20) ensure adequate time under tension for connective tissue adaptation
 * - Weight uses 95% of progression target to allow slight increases while maintaining form focus
 */

import type { ActiveGoal, RecentWorkout, WorkoutIntent } from "../constraints";
import { rotateBodyParts } from "./workoutUtils";

export function generateMobilityWorkout(
    activeGoal: ActiveGoal | null,
    recentWorkouts: RecentWorkout[]
): WorkoutIntent {
    // For mobility goals, if a specific movement/exercise is targeted, focus on those body parts
    let bodyParts: string[];
    
    if (activeGoal?.target?.movement || activeGoal?.target?.exercise) {
        // Map common mobility movements to body parts
        const movement = (activeGoal.target.movement || activeGoal.target.exercise || "").toLowerCase();
        
        if (movement.includes("hip") || movement.includes("squat") || movement.includes("leg")) {
            bodyParts = ["quads", "hamstrings", "glutes", "hip flexors"];
        } else if (movement.includes("shoulder") || movement.includes("overhead") || movement.includes("arm")) {
            bodyParts = ["front delts", "lateral delts", "rear delts", "upper back"];
        } else if (movement.includes("spine") || movement.includes("back") || movement.includes("twist")) {
            bodyParts = ["upper back", "lower back", "core"];
        } else if (movement.includes("ankle") || movement.includes("foot") || movement.includes("calf")) {
            bodyParts = ["calves", "ankles"];
        } else {
            // Default: rotate through body parts
            bodyParts = rotateBodyParts(recentWorkouts);
        }
    } else {
        // General mobility: rotate through body parts
        bodyParts = rotateBodyParts(recentWorkouts);
    }

    return {
        bodyParts,
        intensity: "maintain", // Maintain intensity ensures focus on form, not strength
        compoundSets: 2, // Lower volume prevents fatigue that compromises form
        accessorySets: 2,
        repRanges: {
            compound: "12-15", // Higher reps for time under tension and ROM work
            accessory: "15-20", // Even higher reps for accessory mobility work
        },
        workoutType: "main", // Main mobility workout
        includeStretch: true, // Always include SEPARATE stretch workout
        stretchTemplate: "full body", // Full body stretching for mobility
        // Include target movement/exercise if specified
        targetExercise: activeGoal?.target?.movement || activeGoal?.target?.exercise,
    };
}
