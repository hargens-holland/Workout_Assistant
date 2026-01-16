/**
 * Constraint Computation Functions
 * 
 * Pure code functions that compute workout and nutrition constraints.
 * NO AI usage - all logic is deterministic and rule-based.
 */

import { Id } from "./_generated/dataModel";

/**
 * Body part categories for workout rotation
 */
const BODY_PARTS = [
    "chest",
    "back",
    "shoulders",
    "legs",
    "arms",
    "core",
    "cardio",
] as const;

type BodyPart = typeof BODY_PARTS[number];

/**
 * Workout Intent - determines what body parts to target, intensity, and set/rep structure
 */
export interface WorkoutIntent {
    bodyParts: string[];
    intensity: "light" | "moderate" | "heavy";
    compoundSets: number;
    accessorySets: number;
    repRanges: {
        compound: string;
        accessory: string;
    };
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

/**
 * Compute workout intent based on active goal and recent workouts
 * 
 * Rules:
 * - Body parts rotate based on recent workouts (avoid same body part on consecutive days)
 * - Intensity derived from goal + fatigue indicators
 * - Set counts based on intensity and goal type
 * - Rep ranges based on goal category
 */
export function computeWorkoutIntent({
    activeGoal,
    recentWorkouts,
}: {
    activeGoal: ActiveGoal | null;
    recentWorkouts: RecentWorkout[];
}): WorkoutIntent {
    // Default values
    let bodyParts: string[] = ["chest", "back", "shoulders"];
    let intensity: "light" | "moderate" | "heavy" = "moderate";
    let compoundSets = 3;
    let accessorySets = 2;

    // Determine intensity based on goal
    if (activeGoal) {
        switch (activeGoal.category) {
            case "strength":
                intensity = "heavy";
                compoundSets = 4;
                accessorySets = 2;
                break;
            case "endurance":
                intensity = "light";
                compoundSets = 3;
                accessorySets = 3;
                break;
            case "body_composition":
                intensity = "moderate";
                compoundSets = 3;
                accessorySets = 3;
                break;
            case "mobility":
            case "skill":
                intensity = "light";
                compoundSets = 2;
                accessorySets = 2;
                break;
        }
    }

    // Check for fatigue indicators (3+ consecutive heavy days)
    const recentHeavyDays = recentWorkouts
        .slice(-3)
        .filter(w => w.intensity === "heavy").length;
    
    if (recentHeavyDays >= 3) {
        intensity = "light"; // Force deload
    }

    // Rotate body parts based on recent workouts
    const recentBodyParts = new Set<string>();
    recentWorkouts.slice(-3).forEach(workout => {
        workout.bodyParts.forEach(part => recentBodyParts.add(part.toLowerCase()));
    });

    // Select body parts that haven't been worked recently
    const availableParts = BODY_PARTS.filter(
        part => !recentBodyParts.has(part.toLowerCase())
    );

    if (availableParts.length >= 3) {
        bodyParts = availableParts.slice(0, 3).map(p => p);
    } else if (availableParts.length > 0) {
        // Mix of new and recent parts
        bodyParts = [
            ...availableParts,
            ...BODY_PARTS.filter(p => !availableParts.includes(p)).slice(0, 3 - availableParts.length)
        ].slice(0, 3).map(p => p);
    } else {
        // All parts were recent, use default rotation
        const lastWorkout = recentWorkouts[recentWorkouts.length - 1];
        if (lastWorkout) {
            const lastIndex = BODY_PARTS.findIndex(p => 
                lastWorkout.bodyParts.some(bp => bp.toLowerCase() === p.toLowerCase())
            );
            const nextIndex = (lastIndex + 1) % BODY_PARTS.length;
            bodyParts = [BODY_PARTS[nextIndex], BODY_PARTS[(nextIndex + 1) % BODY_PARTS.length], BODY_PARTS[(nextIndex + 2) % BODY_PARTS.length]];
        }
    }

    // Determine rep ranges based on intensity and goal
    let compoundRepRange = "8-10";
    let accessoryRepRange = "10-12";

    if (intensity === "heavy") {
        compoundRepRange = "4-6";
        accessoryRepRange = "8-10";
    } else if (intensity === "moderate") {
        compoundRepRange = "8-10";
        accessoryRepRange = "10-12";
    } else {
        compoundRepRange = "12-15";
        accessoryRepRange = "15-20";
    }

    // Adjust for endurance goals
    if (activeGoal?.category === "endurance") {
        compoundRepRange = "15-20";
        accessoryRepRange = "20-25";
    }

    return {
        bodyParts,
        intensity,
        compoundSets,
        accessorySets,
        repRanges: {
            compound: compoundRepRange,
            accessory: accessoryRepRange,
        },
    };
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
 * - Respect deload conditions (reduce weight by 10% if needed)
 * - For new exercises, use conservative starting weight
 */
export function computeProgressionTargets(
    recentWorkouts: RecentWorkout[]
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

        // Conservative progression rules
        let nextWeight = avgWeight;
        let nextTargetReps = targetReps;

        if (allSetsHitTarget && avgReps >= targetReps) {
            // Can progress: increase weight by 2.5-5% or add reps
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
            nextWeight = avgWeight * 0.9;
            nextWeight = Math.round(nextWeight / 2.5) * 2.5;
            nextTargetReps = targetReps + 2; // Easier reps to rebuild confidence
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
 * - Weight loss → calorie deficit (500-750 kcal/day)
 * - Strength/skill → maintenance or small surplus (0-300 kcal/day)
 * - Protein scaled to bodyweight (1.6-2.2g/kg)
 * - Carb bias based on goal type
 */
export function computeNutritionIntent({
    activeGoal,
    userProfile,
}: {
    activeGoal: ActiveGoal | null;
    userProfile: UserProfile;
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
                    // Weight loss: 500-750 kcal deficit
                    calorieTarget = tdee - 625; // Average of 500-750
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
