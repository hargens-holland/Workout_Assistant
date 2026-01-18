/**
 * Skill Workout Generator
 * 
 * Generates workout intent for skill goals:
 * - Maintain intensity (focus on technique, not strength)
 * - 2 compound sets, 2 accessory sets
 * - 12-15 rep range for compounds, 15-20 for accessories
 * - Includes supporting body part workouts and cardio for weight loss if needed
 * 
 * Goal-Specific Parameters:
 * - target.exercise: Specific skill exercise to master (e.g., "handstand", "muscle-up", "pistol squat")
 * - target.movement: Movement pattern if exercise not specified (e.g., "pull-up", "dip")
 * - target.metric: "reps" | "time" | "weight" (e.g., "achieve 10 pull-ups", "hold handstand for 30 seconds")
 * - direction: "increase" | "achieve" (e.g., "increase pull-up reps", "achieve first muscle-up")
 * - value: Target value (e.g., 10 for "10 pull-ups, 30 for "30 second handstand")
 * 
 * Skill-Specific Logic:
 * - For each skill, determines body parts needed and factors needed (e.g., lose weight)
 * - Pistol squat: Needs strong legs → leg workouts + runs to lose weight
 * - Pull-ups: Needs strong back → back workouts + daily pull-ups + runs/walks to lose weight
 * - Handstand: Needs strong shoulders/core → push workouts + core work
 * 
 * Progression Logic:
 * - Focus on technique refinement over weight progression
 * - Progress through improved technique, increased difficulty variations, or slight weight increases
 * - Only advance when consistent, correct technique is demonstrated across all sets
 * - High rep ranges (12-20) allow repeated practice without fatigue compromising form
 * - Lower set volume (2 sets) prevents fatigue that degrades technique
 */

import type { ActiveGoal, RecentWorkout, WorkoutIntent } from "../constraints";
import { rotateBodyParts } from "./workoutUtils";

interface SkillRequirements {
    bodyParts: string[];
    needsWeightLoss: boolean;
    dailyPractice: boolean; // Whether to practice the skill daily
}

function getSkillRequirements(skillName: string): SkillRequirements {
    const skill = skillName.toLowerCase();

    // Pistol squat: Strong legs + weight loss
    if (skill.includes("pistol") || skill.includes("single leg squat")) {
        return {
            bodyParts: ["quads", "hamstrings", "glutes", "calves", "core"],
            needsWeightLoss: true,
            dailyPractice: false,
        };
    }

    // Pull-ups: Strong back + weight loss + daily practice
    if (skill.includes("pull-up") || skill.includes("chin-up")) {
        return {
            bodyParts: ["lats", "biceps", "upper back", "rear delts"],
            needsWeightLoss: true,
            dailyPractice: true,
        };
    }

    // Muscle-up: Strong back + upper body + weight loss
    if (skill.includes("muscle-up")) {
        return {
            bodyParts: ["lats", "biceps", "upper back", "rear delts", "chest", "triceps"],
            needsWeightLoss: true,
            dailyPractice: false,
        };
    }

    // Handstand: Strong shoulders + core
    if (skill.includes("handstand")) {
        return {
            bodyParts: ["front delts", "lateral delts", "rear delts", "core", "upper back"],
            needsWeightLoss: false,
            dailyPractice: true,
        };
    }

    // Push-ups: Chest + triceps + core
    if (skill.includes("push-up")) {
        return {
            bodyParts: ["chest", "triceps", "front delts", "core"],
            needsWeightLoss: false,
            dailyPractice: false,
        };
    }

    // Dips: Chest + triceps
    if (skill.includes("dip")) {
        return {
            bodyParts: ["chest", "triceps", "front delts"],
            needsWeightLoss: false,
            dailyPractice: false,
        };
    }

    // Default: map to body parts based on exercise name
    if (skill.includes("squat") || skill.includes("lunge")) {
        return {
            bodyParts: ["quads", "hamstrings", "glutes", "calves"],
            needsWeightLoss: false,
            dailyPractice: false,
        };
    }

    if (skill.includes("deadlift") || skill.includes("hinge")) {
        return {
            bodyParts: ["hamstrings", "glutes", "lower back", "traps"],
            needsWeightLoss: false,
            dailyPractice: false,
        };
    }

    // Default fallback
    return {
        bodyParts: rotateBodyParts([]),
        needsWeightLoss: false,
        dailyPractice: false,
    };
}

export function generateSkillWorkout(
    activeGoal: ActiveGoal | null,
    recentWorkouts: RecentWorkout[]
): WorkoutIntent {
    let bodyParts: string[];
    let targetExercise: string | undefined;
    let needsWeightLoss = false;
    let dailyPractice = false;

    if (activeGoal?.target?.exercise || activeGoal?.target?.movement) {
        targetExercise = activeGoal.target.exercise || activeGoal.target.movement;
        if (targetExercise) {
            const requirements = getSkillRequirements(targetExercise);
            bodyParts = requirements.bodyParts;
            needsWeightLoss = requirements.needsWeightLoss;
            dailyPractice = requirements.dailyPractice;
        } else {
            // General skill: rotate through body parts
            bodyParts = rotateBodyParts(recentWorkouts);
        }
    } else {
        // General skill: rotate through body parts
        bodyParts = rotateBodyParts(recentWorkouts);
    }

    return {
        bodyParts,
        intensity: "maintain", // Maintain intensity ensures focus on technique, not strength
        compoundSets: 2, // Lower volume prevents fatigue that degrades technique
        accessorySets: 2,
        repRanges: {
            compound: "12-15", // Higher reps for repeated practice
            accessory: "15-20", // Even higher reps for skill refinement
        },
        workoutType: "main", // Main skill workout
        includeStretch: true, // Always include SEPARATE stretch workout
        stretchTemplate: "full body", // Full body stretching for skills
        targetExercise, // Include target exercise/movement if specified
        // Include cardio for weight loss if skill requires it (SEPARATE workout)
        includeCardio: needsWeightLoss,
        cardioType: needsWeightLoss ? "run" : undefined, // Runs or walks to lose weight
    };
}
