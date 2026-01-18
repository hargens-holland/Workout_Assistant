/**
 * Constraint Computation Functions
 * 
 * Pure code functions that compute workout and nutrition constraints.
 * NO AI usage - all logic is deterministic and rule-based.
 */

import { Id } from "./_generated/dataModel";

// Body parts and endurance options moved to workoutGenerators.ts

/**
 * Workout Intent - determines what body parts to target, intensity, and set/rep structure
 */
export interface WorkoutIntent {
    bodyParts: string[];
    intensity: "strengthen" | "maintain" | "recover";
    compoundSets: number;
    accessorySets: number;
    repRanges: {
        compound: string;
        accessory: string;
    };
    targetExercise?: string; // For endurance goals: the specific exercise to focus on (e.g., "running")
    includeStretch?: boolean; // Whether to include a SEPARATE stretch workout (for all goals)
    stretchTemplate?: string; // Stretch template name (e.g., "full body", "pre run", "pre lift")
    includeCardio?: boolean; // Whether to include SEPARATE cardio workout (for body composition/skill goals)
    cardioType?: "run" | "incline_walk" | "walk"; // Type of cardio to include
    workoutType?: "main" | "endurance" | "cardio" | "stretch"; // Type of this workout (for separation)
    separateEndurance?: boolean; // Whether endurance exercise should be separate from lifting
}

/**
 * Recent workout data structure
 */
export interface RecentWorkout {
    date: string;
    bodyParts: string[];
    intensity: string;
    exercises: Array<{
        name: string;
        sets: Array<{
            weight: number;
            reps: number;
            completed: boolean;
        }>;
    }>;
}

/**
 * Active goal structure
 */
export interface ActiveGoal {
    category: "body_composition" | "strength" | "endurance" | "mobility" | "skill";
    target?: {
        exercise?: string;
        movement?: string;
        metric?: "weight" | "reps" | "time" | "distance" | "rom";
    };
    direction?: "increase" | "decrease" | "achieve";
    value?: number;
    unit?: string;
    priority: "low" | "medium" | "high";
}

import {
    generateStrengthWorkout,
    generateEnduranceWorkout,
    generateBodyCompositionWorkout,
    generateMobilityWorkout,
    generateSkillWorkout,
    checkFatigue,
    rotateBodyParts,
    hasInjuryForBodyParts,
} from "./workouts";
import { isPrimaryLift } from "./primaryLifts";

/**
 * Compute workout intent based on active goal and recent workouts
 * 
 * Acts as the overall manager, delegating to specific workout type generators.
 */
export function computeWorkoutIntent({
    activeGoal,
    recentWorkouts,
    splitType,
    yesterdayDate,
    injuryConstraints,
    weightLossPerWeek,
}: {
    activeGoal: ActiveGoal | null;
    recentWorkouts: RecentWorkout[];
    splitType?: string | undefined;
    yesterdayDate?: string | undefined;
    injuryConstraints?: string[] | undefined;
    weightLossPerWeek?: number; // Optional: amount to lose per week (lbs/kg) for body composition goals
}): WorkoutIntent {
    // If no goal, use default maintain workout
    if (!activeGoal) {
        const intensity = checkFatigue("maintain", recentWorkouts);
        const bodyParts = rotateBodyParts(recentWorkouts);

        // Check for injuries on body parts
        let finalIntensity = intensity;
        if (injuryConstraints && injuryConstraints.length > 0) {
            const hasInjury = hasInjuryForBodyParts(bodyParts, injuryConstraints);
            if (hasInjury) {
                finalIntensity = "recover";
            }
        }

        return {
            bodyParts,
            intensity: finalIntensity,
            compoundSets: 3,
            accessorySets: 2,
            repRanges: {
                compound: "8-10",
                accessory: "10-12",
            },
        };
    }

    // Delegate to specific workout type generator
    let workoutIntent: WorkoutIntent;

    switch (activeGoal.category) {
        case "strength":
            workoutIntent = generateStrengthWorkout(activeGoal, recentWorkouts, splitType as any, yesterdayDate);
            break;
        case "endurance":
            workoutIntent = generateEnduranceWorkout(activeGoal, recentWorkouts);
            break;
        case "body_composition":
            workoutIntent = generateBodyCompositionWorkout(activeGoal, recentWorkouts, weightLossPerWeek);
            break;
        case "mobility":
            workoutIntent = generateMobilityWorkout(activeGoal, recentWorkouts);
            break;
        case "skill":
            workoutIntent = generateSkillWorkout(activeGoal, recentWorkouts);
            break;
        default:
            // Fallback to default
            const intensity = checkFatigue("maintain", recentWorkouts);
            const bodyParts = rotateBodyParts(recentWorkouts);

            // Check for injuries on body parts
            let finalIntensity = intensity;
            if (injuryConstraints && injuryConstraints.length > 0) {
                const hasInjury = hasInjuryForBodyParts(bodyParts, injuryConstraints);
                if (hasInjury) {
                    finalIntensity = "recover";
                }
            }

            workoutIntent = {
                bodyParts,
                intensity: finalIntensity,
                compoundSets: 3,
                accessorySets: 2,
                repRanges: {
                    compound: "8-10",
                    accessory: "10-12",
                },
            };
    }

    // Check if any body parts have injuries - if so, use recover intensity
    // (This applies to all goal types)
    if (injuryConstraints && injuryConstraints.length > 0) {
        const hasInjury = hasInjuryForBodyParts(workoutIntent.bodyParts, injuryConstraints);
        if (hasInjury) {
            // Override intensity to recover for injured body parts
            workoutIntent.intensity = "recover";
        }
    }

    return workoutIntent;
}

/**
 * Progression target for a specific exercise
 */
export interface ProgressionTarget {
    nextWeight: number;
    targetReps: number;
}

/**
 * Exercise set data from recent workouts
 */
export interface ExerciseSetData {
    exerciseName: string;
    sets: Array<{
        weight: number;
        reps: number;
        completed: boolean;
    }>;
}

/**
 * Compute progression targets for exercises based on recent workout history
 * 
 * Rules:
 * - Use last completed sets to determine baseline
 * - Apply conservative progression (2.5-5% weight increase or +1-2 reps)
 * - For endurance exercises: progress distance/time (reps), maintain weight
 * - Respect deload conditions (reduce weight by 10% if needed)
 * - For new exercises, use conservative starting weight
 */
export function computeProgressionTargets(
    recentWorkouts: RecentWorkout[],
    activeGoal?: ActiveGoal | null
): Record<string, ProgressionTarget> {
    const targets: Record<string, ProgressionTarget> = {};

    // Extract all exercises from recent workouts
    const exerciseMap = new Map<string, ExerciseSetData>();

    recentWorkouts.forEach(workout => {
        workout.exercises.forEach(exercise => {
            if (!exerciseMap.has(exercise.name)) {
                exerciseMap.set(exercise.name, {
                    exerciseName: exercise.name,
                    sets: [],
                });
            }
            const exerciseData = exerciseMap.get(exercise.name)!;
            exercise.sets.forEach(set => {
                if (set.completed) {
                    exerciseData.sets.push(set);
                }
            });
        });
    });

    // Compute progression for each exercise
    exerciseMap.forEach((exerciseData, exerciseName) => {
        const completedSets = exerciseData.sets.filter(s => s.completed);

        if (completedSets.length === 0) {
            // New exercise - use conservative default
            targets[exerciseName] = {
                nextWeight: 0, // Will be determined by AI or exercise database
                targetReps: 10,
            };
            return;
        }

        // Get most recent completed sets (last workout)
        const recentSets = completedSets.slice(-3); // Last 3 sets
        if (recentSets.length === 0) return;

        // Calculate average weight and reps from recent sets
        const avgWeight = recentSets.reduce((sum, s) => sum + s.weight, 0) / recentSets.length;
        const avgReps = recentSets.reduce((sum, s) => sum + s.reps, 0) / recentSets.length;

        // Check if all sets hit target reps (progression indicator)
        const targetReps = Math.round(avgReps);
        const allSetsHitTarget = recentSets.every(s => s.reps >= targetReps);

        // Check if this is an endurance exercise (cardio-based)
        const isEnduranceExercise = activeGoal?.category === "endurance" &&
            (activeGoal.target?.movement || activeGoal.target?.exercise) &&
            (exerciseName.toLowerCase().includes("run") ||
                exerciseName.toLowerCase().includes("jog") ||
                exerciseName.toLowerCase().includes("cycle") ||
                exerciseName.toLowerCase().includes("cardio") ||
                exerciseName.toLowerCase().includes("distance") ||
                exerciseName.toLowerCase().includes("swim") ||
                exerciseName.toLowerCase().includes("row"));

        // Check if this is a primary lift (for strength goals)
        const isPrimaryLiftExercise = activeGoal?.category === "strength" &&
            activeGoal.target?.exercise &&
            isPrimaryLift(exerciseName);

        // Check if this is a skill exercise (for skill goals)
        const isSkillExercise = activeGoal?.category === "skill" &&
            (activeGoal.target?.exercise || activeGoal.target?.movement) &&
            (exerciseName.toLowerCase().includes((activeGoal.target.exercise || activeGoal.target.movement || "").toLowerCase()));

        // Check if this is a mobility exercise (for mobility goals)
        const isMobilityExercise = activeGoal?.category === "mobility" &&
            (activeGoal.target?.movement || activeGoal.target?.exercise) &&
            (exerciseName.toLowerCase().includes((activeGoal.target.movement || activeGoal.target.exercise || "").toLowerCase()));

        // Check if this is a body composition exercise
        const isBodyCompositionExercise = activeGoal?.category === "body_composition";

        // Progression rules
        let nextWeight = avgWeight;
        let nextTargetReps = targetReps;

        if (isEnduranceExercise) {
            // Endurance progression: progressively harder (longer distance and/or faster pace)
            // If goal has target value, progress more aggressively toward it
            const goalValue = activeGoal?.value || null;
            const goalMetric = activeGoal?.target?.metric;

            if (allSetsHitTarget && avgReps >= targetReps) {
                // If goal has target value, calculate progress toward it
                if (goalValue && goalMetric) {
                    // Progress by 5-10% toward goal value
                    // For distance/time goals, reps represent distance/time
                    const progressRate = goalValue > avgReps ? 1.10 : 1.05; // More aggressive if far from goal
                    nextTargetReps = Math.round(Math.min(targetReps * progressRate, goalValue * 1.05)); // Cap at 5% over goal
                } else {
                    // General endurance: 5-10% increase (progressively harder)
                    // Cycle through exercises, increasing difficulty each time
                    nextTargetReps = Math.round(targetReps * 1.05); // 5% increase for distance/time
                }
                nextWeight = avgWeight; // Maintain weight (usually 0 or bodyweight)
            } else {
                // Maintain current distance/time, try to hit target
                nextWeight = avgWeight;
                nextTargetReps = targetReps;
            }

            // For pace-based goals (faster time for same distance), we can also track pace
            // This would be handled by decreasing time (reps) for the same distance
            // or increasing distance (reps) for the same time
        } else if (isMobilityExercise) {
            // Mobility progression: Very conservative, form-focused
            // Only progress when all sets hit target reps with perfect form
            if (allSetsHitTarget && avgReps >= targetReps) {
                // Very conservative: 1-2.5kg increase or 1-2 rep increase
                if (avgWeight > 0) {
                    // If using weight, increase by 1-2.5kg max
                    nextWeight = Math.min(avgWeight + 2.5, avgWeight * 1.025); // Max 2.5% increase
                    nextWeight = Math.round(nextWeight / 1.25) * 1.25; // Round to nearest 1.25kg
                } else {
                    // Bodyweight: increase reps by 1-2
                    nextTargetReps = targetReps + 1;
                }
            } else {
                // Maintain current weight/reps, focus on form
                nextWeight = avgWeight;
                nextTargetReps = targetReps;
            }
        } else if (isSkillExercise) {
            // Skill progression: Technique-focused, very gradual
            // Progress through improved technique or slight weight/difficulty increases
            if (allSetsHitTarget && avgReps >= targetReps) {
                // Very conservative: 1-2.5kg increase or 1 rep increase
                // For skill exercises, progression may be through variations rather than weight
                if (avgWeight > 0) {
                    nextWeight = Math.min(avgWeight + 2.5, avgWeight * 1.025); // Max 2.5% increase
                    nextWeight = Math.round(nextWeight / 1.25) * 1.25; // Round to nearest 1.25kg
                } else {
                    // Bodyweight skill: increase reps by 1
                    nextTargetReps = targetReps + 1;
                }
            } else {
                // Maintain current weight/reps, focus on technique
                nextWeight = avgWeight;
                nextTargetReps = targetReps;
            }
        } else if (isBodyCompositionExercise && allSetsHitTarget && avgReps >= targetReps) {
            // Body composition progression: Adjust based on goal direction
            const goalDirection = activeGoal?.direction;

            if (goalDirection === "decrease") {
                // Weight loss: More conservative progression (2.5-3% increase)
                // Focus on maintaining muscle while in calorie deficit
                if (avgWeight < 50) {
                    nextWeight = Math.max(avgWeight + 2.5, avgWeight * 1.025);
                } else {
                    nextWeight = avgWeight * 1.025; // 2.5% increase
                }
                nextWeight = Math.round(nextWeight / 2.5) * 2.5;
            } else if (goalDirection === "increase") {
                // Weight gain: More aggressive progression (5-7.5% increase)
                // Focus on muscle building with calorie surplus
                if (avgWeight < 50) {
                    nextWeight = Math.max(avgWeight + 2.5, avgWeight * 1.075);
                } else {
                    nextWeight = avgWeight * 1.05; // 5% increase
                }
                nextWeight = Math.round(nextWeight / 2.5) * 2.5;
            } else {
                // Maintain/achieve: Standard progression (2.5-5% increase)
                if (avgWeight < 50) {
                    nextWeight = Math.max(avgWeight + 2.5, avgWeight * 1.05);
                } else {
                    nextWeight = avgWeight * 1.05;
                }
                nextWeight = Math.round(nextWeight / 2.5) * 2.5;
            }
        } else if (isPrimaryLiftExercise && allSetsHitTarget && avgReps >= targetReps) {
            // HEAVY LIFTING PROGRESSION for primary lifts: more aggressive (5-10% weight increase)
            if (avgWeight < 50) {
                // Light weight primary lift: increase by 2.5kg or 7.5% (more aggressive than accessories)
                nextWeight = Math.max(avgWeight + 2.5, avgWeight * 1.075);
            } else if (avgWeight < 100) {
                // Medium weight primary lift: increase by 7.5%
                nextWeight = avgWeight * 1.075;
            } else {
                // Heavy weight primary lift: increase by 5-7.5% (conservative for very heavy weights)
                nextWeight = avgWeight * 1.05;
            }
            // Round to nearest 2.5kg
            nextWeight = Math.round(nextWeight / 2.5) * 2.5;
        } else if (allSetsHitTarget && avgReps >= targetReps) {
            // Conservative progression for accessories/non-primary lifts: 2.5-5% weight increase
            if (avgWeight < 50) {
                // Light weight: increase by 2.5kg or 5%
                nextWeight = Math.max(avgWeight + 2.5, avgWeight * 1.05);
            } else {
                // Heavier weight: increase by 5%
                nextWeight = avgWeight * 1.05;
            }
            // Round to nearest 2.5kg
            nextWeight = Math.round(nextWeight / 2.5) * 2.5;
        } else {
            // Maintain current weight, try to hit target reps
            nextWeight = avgWeight;
            nextTargetReps = targetReps;
        }

        // Check for deload conditions (3+ consecutive sessions with same weight and missed reps)
        const lastThreeWorkouts = recentWorkouts.slice(-3);
        const consecutiveMissed = lastThreeWorkouts.every(workout => {
            const exerciseInWorkout = workout.exercises.find(e => e.name === exerciseName);
            if (!exerciseInWorkout) return false;
            return exerciseInWorkout.sets.some(s =>
                s.completed && s.weight === avgWeight && s.reps < targetReps
            );
        });

        if (consecutiveMissed && lastThreeWorkouts.length >= 3) {
            // Deload: reduce weight by 10%
            // For primary lifts, this is more critical - ensure proper deload
            if (isPrimaryLiftExercise) {
                // Primary lift deload: reduce by 10%, add 2 reps to rebuild
                nextWeight = avgWeight * 0.9;
                nextWeight = Math.round(nextWeight / 2.5) * 2.5;
                nextTargetReps = targetReps + 2; // Easier reps to rebuild confidence
            } else if (isMobilityExercise || isSkillExercise) {
                // Mobility/skill deload: reduce by 5-10%, focus on form
                nextWeight = avgWeight * 0.95; // Less aggressive deload
                if (nextWeight > 0) {
                    nextWeight = Math.round(nextWeight / 1.25) * 1.25;
                }
                nextTargetReps = targetReps + 1; // Slight rep increase for easier work
            } else if (isBodyCompositionExercise && activeGoal?.direction === "decrease") {
                // Weight loss deload: reduce by 5% (less aggressive to preserve muscle)
                nextWeight = avgWeight * 0.95;
                nextWeight = Math.round(nextWeight / 2.5) * 2.5;
                nextTargetReps = targetReps + 1;
            } else {
                // Accessory deload: reduce by 10%, add 2 reps to rebuild
                nextWeight = avgWeight * 0.9;
                nextWeight = Math.round(nextWeight / 2.5) * 2.5;
                nextTargetReps = targetReps + 2;
            }
        }

        targets[exerciseName] = {
            nextWeight: Math.max(0, nextWeight), // Ensure non-negative
            targetReps: Math.max(1, nextTargetReps), // Ensure at least 1 rep
        };
    });

    return targets;
}

/**
 * Nutrition Intent - determines calorie target, protein minimum, and carb bias
 */
export interface NutritionIntent {
    calorieTarget: number;
    proteinMin: number;
    carbBias: "low" | "moderate" | "high";
}

/**
 * User profile structure
 */
export interface UserProfile {
    weight_kg?: number;
    height_cm?: number;
    experience_level?: "beginner" | "intermediate" | "advanced";
}

/**
 * Compute nutrition intent based on active goal and user profile
 * 
 * Rules:
 * - Weight loss → calorie deficit calculated based on weight loss per week
 *   - 1 lb/week = ~500 kcal/day deficit
 *   - 2 lbs/week = ~1000 kcal/day deficit
 *   - Weight loss per week factor: (weightLossPerWeek * 500) kcal/day deficit
 * - Strength/skill → maintenance or small surplus (0-300 kcal/day)
 * - Protein scaled to bodyweight (1.6-2.2g/kg)
 * - Carb bias based on goal type
 */
export function computeNutritionIntent({
    activeGoal,
    userProfile,
    weightLossPerWeek,
}: {
    activeGoal: ActiveGoal | null;
    userProfile: UserProfile;
    weightLossPerWeek?: number; // Optional: amount to lose per week (lbs/kg) - factors into calorie calculation
}): NutritionIntent {
    const weightKg = userProfile.weight_kg || 70; // Default 70kg if not provided
    const heightCm = userProfile.height_cm || 175; // Default 175cm if not provided

    // Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor equation
    // Men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
    // Women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161
    // Using average (assuming 30-year-old male as default)
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * 30 + 5;

    // TDEE (Total Daily Energy Expenditure) = BMR × activity factor
    // Assuming moderate activity (1.55 multiplier)
    const tdee = bmr * 1.55;

    let calorieTarget = tdee;
    let carbBias: "low" | "moderate" | "high" = "moderate";

    // Adjust calories based on goal
    if (activeGoal) {
        switch (activeGoal.category) {
            case "body_composition":
                if (activeGoal.direction === "decrease") {
                    // Weight loss: Calculate deficit based on weight loss per week
                    // 1 lb/week = ~500 kcal/day deficit, 2 lbs/week = ~1000 kcal/day deficit
                    if (weightLossPerWeek && weightLossPerWeek > 0) {
                        // Calculate calorie deficit: weightLossPerWeek (lbs) * 500 kcal/day per lb
                        // Cap at reasonable maximum (1500 kcal/day deficit for safety)
                        const deficit = Math.min(weightLossPerWeek * 500, 1500);
                        calorieTarget = tdee - deficit;
                    } else {
                        // Default: 500-750 kcal deficit (1-1.5 lbs/week)
                        calorieTarget = tdee - 625; // Average of 500-750
                    }
                    carbBias = "low";
                } else if (activeGoal.direction === "increase") {
                    // Weight gain: 300-500 kcal surplus
                    calorieTarget = tdee + 400; // Average of 300-500
                    carbBias = "high";
                } else {
                    // Maintenance
                    calorieTarget = tdee;
                    carbBias = "moderate";
                }
                break;
            case "strength":
                // Small surplus for strength gains
                calorieTarget = tdee + 200;
                carbBias = "moderate";
                break;
            case "endurance":
                // Higher calories for endurance training
                calorieTarget = tdee + 300;
                carbBias = "high";
                break;
            case "mobility":
            case "skill":
                // Maintenance
                calorieTarget = tdee;
                carbBias = "moderate";
                break;
        }
    }

    // Protein minimum: 1.6-2.2g/kg based on goal
    let proteinPerKg = 1.6; // Default for general fitness
    if (activeGoal?.category === "strength") {
        proteinPerKg = 2.0; // Higher for strength
    } else if (activeGoal?.category === "body_composition" && activeGoal.direction === "decrease") {
        proteinPerKg = 2.2; // Higher for weight loss (preserve muscle)
    } else if (activeGoal?.category === "endurance") {
        proteinPerKg = 1.6; // Standard for endurance
    }

    const proteinMin = Math.round(weightKg * proteinPerKg);

    // Round calorie target to nearest 50
    calorieTarget = Math.round(calorieTarget / 50) * 50;

    return {
        calorieTarget: Math.max(1200, calorieTarget), // Minimum 1200 kcal for safety
        proteinMin,
        carbBias,
    };
}
