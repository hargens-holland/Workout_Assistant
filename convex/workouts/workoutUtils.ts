/**
 * Shared utility functions for workout generators
 */

import type { RecentWorkout } from "../constraints";
import type { SplitType, SplitTemplate } from "../splits";
import { SPLIT_TEMPLATES } from "../splits";

/**
 * Body part categories for workout rotation
 */
const BODY_PARTS = [
    // Chest
    "chest",

    // Back
    "upper back",
    "lats",
    "lower back",
    "traps",

    // Shoulders
    "front delts",
    "lateral delts",
    "rear delts",
    "shoulders", // General shoulders (for exercises that target all delts)

    // Arms
    "biceps",
    "triceps",
    "forearms",

    // Core
    "abs",
    "obliques",
    "core", // General core (for exercises targeting multiple core muscles)

    // Legs
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "hip flexors", // Important for mobility and lower body function
    "inner thighs", // Adductors
    "outer thighs", // Abductors
    "outer hips", // Hip external rotators

    // Ankles & Wrists
    "ankles", // For ankle mobility and calf work
    "wrists", // For wrist mobility and forearm work

    // Neck
    "neck", // For neck mobility and strengthening

    // Conditioning
    "cardio",
] as const;

/**
 * Calculate optimal workout schedule based on workouts per week
 * Returns an array of day indices (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * that should be workout days, evenly spaced throughout the week
 */
export function calculateWorkoutSchedule(workoutsPerWeek: number): number[] {
    if (workoutsPerWeek <= 0 || workoutsPerWeek > 7) {
        // Default to 3 days per week if invalid
        return [1, 3, 5]; // Monday, Wednesday, Friday
    }

    // Predefined optimal schedules for common frequencies
    const optimalSchedules: Record<number, number[]> = {
        1: [3], // Wednesday
        2: [1, 4], // Monday, Thursday
        3: [1, 3, 5], // Monday, Wednesday, Friday
        4: [1, 2, 4, 5], // Monday, Tuesday, Thursday, Friday
        5: [1, 2, 3, 4, 5], // Monday through Friday
        6: [1, 2, 3, 4, 5, 6], // Monday through Saturday
        7: [0, 1, 2, 3, 4, 5, 6], // Every day
    };

    if (optimalSchedules[workoutsPerWeek]) {
        return optimalSchedules[workoutsPerWeek];
    }

    // Fallback: calculate evenly spaced schedule
    const daysInWeek = 7;
    const restDays = daysInWeek - workoutsPerWeek;
    const spacing = workoutsPerWeek > 1 ? Math.floor(restDays / (workoutsPerWeek - 1)) + 1 : 1;

    // Start with Monday (1) as the first workout day
    const schedule: number[] = [];
    let currentDay = 1; // Monday

    for (let i = 0; i < workoutsPerWeek; i++) {
        schedule.push(currentDay);
        currentDay += spacing;

        // If we've gone past Saturday, wrap around
        if (currentDay >= 7) {
            currentDay = currentDay % 7;
        }
    }

    // Sort to ensure proper order
    schedule.sort((a, b) => a - b);

    return schedule;
}

/**
 * Check if a given date should be a workout day based on workouts per week
 * and recent workout history
 * 
 * @param date - Date to check (ISO string YYYY-MM-DD)
 * @param workoutsPerWeek - Preferred number of workouts per week
 * @param recentWorkouts - Recent workouts to check spacing
 * @param customWorkoutDays - Optional array of custom workout days (0-6, where 0=Sunday, 6=Saturday)
 * @returns true if date should be a workout day, false if rest day
 */
export function shouldWorkoutToday(
    date: string,
    workoutsPerWeek: number | undefined,
    recentWorkouts: RecentWorkout[],
    customWorkoutDays?: number[] | null
): boolean {
    const checkDate = new Date(date);
    const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // If custom workout days are set, use those instead of calculated schedule
    let idealSchedule: number[];
    if (customWorkoutDays && customWorkoutDays.length > 0) {
        // Validate custom days (must be 0-6)
        const validDays = customWorkoutDays.filter(day => day >= 0 && day <= 6);
        if (validDays.length > 0) {
            idealSchedule = validDays;
        } else {
            // Invalid custom days, fall back to calculated schedule
            if (!workoutsPerWeek || workoutsPerWeek <= 0) {
                return true; // No valid schedule, allow workout (backward compatibility)
            }
            idealSchedule = calculateWorkoutSchedule(workoutsPerWeek);
        }
    } else {
        // No custom days set, use calculated schedule
        // If no preference set, default to allowing workouts (backward compatibility)
        if (!workoutsPerWeek || workoutsPerWeek <= 0) {
            return true;
        }
        idealSchedule = calculateWorkoutSchedule(workoutsPerWeek);
    }

    // Check if today is in the ideal schedule
    if (idealSchedule.includes(dayOfWeek)) {
        // Check if we've already worked out too many times this week
        const weekStart = new Date(checkDate);
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStartStr = weekStart.toISOString().split("T")[0];
        const weekEndStr = weekEnd.toISOString().split("T")[0];

        // Count workouts this week (excluding today)
        const workoutsThisWeek = recentWorkouts.filter(w => {
            return w.date >= weekStartStr && w.date <= weekEndStr && w.date !== date;
        });

        // If we've already hit the weekly limit, it's a rest day
        // For custom days, check against the number of custom days
        const maxWorkouts = customWorkoutDays && customWorkoutDays.length > 0
            ? customWorkoutDays.length
            : workoutsPerWeek;

        if (maxWorkouts && workoutsThisWeek.length >= maxWorkouts) {
            return false;
        }

        // Check minimum rest between workouts
        const yesterday = new Date(checkDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const workedOutYesterday = recentWorkouts.some(w => w.date === yesterdayStr);

        // High frequency splits (5-6 days/week) allow consecutive days
        // Lower frequency (1-4 days/week) prefer at least 1 rest day between
        if (workedOutYesterday) {
            // If using custom days, allow consecutive days (user has control)
            if (customWorkoutDays && customWorkoutDays.length > 0) {
                return true;
            }
            // Otherwise check based on workouts per week
            if (workoutsPerWeek && workoutsPerWeek >= 5) {
                // High frequency: consecutive days are expected (e.g., PPL 6 days/week)
                return true;
            } else {
                // Lower frequency: prefer rest day between workouts
                return false;
            }
        }

        return true;
    }

    // Not in ideal schedule, but check if we need to make up for missed days
    // Only do this if we're using calculated schedule (not custom days)
    if (!customWorkoutDays || customWorkoutDays.length === 0) {
        const weekStart = new Date(checkDate);
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStartStr = weekStart.toISOString().split("T")[0];
        const weekEndStr = weekEnd.toISOString().split("T")[0];

        // Count workouts this week (excluding today)
        const workoutsThisWeek = recentWorkouts.filter(w => {
            return w.date >= weekStartStr && w.date <= weekEndStr && w.date !== date;
        });

        // If we're behind on workouts this week and it's been at least 1 day since last workout
        if (workoutsPerWeek && workoutsThisWeek.length < workoutsPerWeek) {
            const lastWorkoutDate = recentWorkouts.length > 0
                ? new Date(recentWorkouts[recentWorkouts.length - 1].date)
                : null;

            if (lastWorkoutDate) {
                const daysSinceLastWorkout = Math.floor(
                    (checkDate.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                // Allow workout if it's been at least 1 day since last workout
                if (daysSinceLastWorkout >= 1) {
                    return true;
                }
            } else {
                // No recent workouts, allow it
                return true;
            }
        }
    }

    // Default to rest day (not in schedule and not making up missed days)
    return false;
}

/**
 * Get the current workout schedule (custom days or calculated from workouts per week)
 * Returns an array of day names for display purposes
 * 
 * @param workoutsPerWeek - Preferred number of workouts per week
 * @param customWorkoutDays - Optional array of custom workout days (0-6)
 * @returns Array of day names (e.g., ["Monday", "Wednesday", "Friday"])
 */
export function getWorkoutSchedule(
    workoutsPerWeek: number | undefined,
    customWorkoutDays?: number[] | null
): string[] {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    let schedule: number[];
    if (customWorkoutDays && customWorkoutDays.length > 0) {
        // Use custom days
        schedule = customWorkoutDays.filter(day => day >= 0 && day <= 6);
    } else if (workoutsPerWeek && workoutsPerWeek > 0) {
        // Use calculated schedule
        schedule = calculateWorkoutSchedule(workoutsPerWeek);
    } else {
        // No schedule set
        return [];
    }

    return schedule.map(day => dayNames[day]);
}

/**
 * Map injury descriptions to affected body parts
 * Returns array of body parts that are affected by the injury
 */
export function mapInjuryToBodyParts(injuryDescription: string): string[] {
    const injuryLower = injuryDescription.toLowerCase();
    const affectedBodyParts: string[] = [];

    // Map common injury descriptions to body parts
    // Knee injuries
    if (injuryLower.includes("knee") || injuryLower.includes("patella") || injuryLower.includes("acl") ||
        injuryLower.includes("meniscus") || injuryLower.includes("mcl") || injuryLower.includes("pcl")) {
        affectedBodyParts.push("quads", "hamstrings", "calves");
    }

    // Shoulder injuries
    if (injuryLower.includes("shoulder") || injuryLower.includes("rotator") || injuryLower.includes("deltoid") ||
        injuryLower.includes("ac joint") || injuryLower.includes("impingement") || injuryLower.includes("labrum")) {
        affectedBodyParts.push("front delts", "lateral delts", "rear delts", "upper back");
    }

    // Back injuries
    if (injuryLower.includes("back") || injuryLower.includes("spine") || injuryLower.includes("disc") ||
        injuryLower.includes("lumbar") || injuryLower.includes("thoracic") || injuryLower.includes("herniated")) {
        affectedBodyParts.push("upper back", "lower back", "lats");
    }

    // Elbow injuries
    if (injuryLower.includes("elbow") || injuryLower.includes("tennis elbow") || injuryLower.includes("golfer") ||
        injuryLower.includes("lateral epicondylitis") || injuryLower.includes("medial epicondylitis")) {
        affectedBodyParts.push("biceps", "triceps", "forearms");
    }

    // Wrist/hand injuries
    if (injuryLower.includes("wrist") || injuryLower.includes("hand") || injuryLower.includes("carpal") ||
        injuryLower.includes("thumb") || injuryLower.includes("finger")) {
        affectedBodyParts.push("forearms");
    }

    // Ankle/foot injuries
    if (injuryLower.includes("ankle") || injuryLower.includes("foot") || injuryLower.includes("achilles") ||
        injuryLower.includes("plantar") || injuryLower.includes("heel")) {
        affectedBodyParts.push("calves");
    }

    // Hip injuries
    if (injuryLower.includes("hip") || injuryLower.includes("groin") || injuryLower.includes("hip flexor") ||
        injuryLower.includes("it band") || injuryLower.includes("iliotibial")) {
        affectedBodyParts.push("glutes", "quads", "hamstrings");
    }

    // Neck injuries
    if (injuryLower.includes("neck") || injuryLower.includes("cervical") || injuryLower.includes("whiplash")) {
        affectedBodyParts.push("traps", "upper back");
    }

    // Chest injuries
    if (injuryLower.includes("chest") || injuryLower.includes("pectoral") || injuryLower.includes("rib") ||
        injuryLower.includes("sternum")) {
        affectedBodyParts.push("chest");
    }

    // Lower leg injuries (shin splints, etc.)
    if (injuryLower.includes("shin") || injuryLower.includes("tibia") || injuryLower.includes("fibula")) {
        affectedBodyParts.push("calves", "quads");
    }

    return affectedBodyParts;
}

/**
 * Check if any body parts have injuries
 * Returns true if any of the body parts match injury constraints
 */
export function hasInjuryForBodyParts(
    bodyParts: string[],
    injuryConstraints: string[] | undefined
): boolean {
    if (!injuryConstraints || injuryConstraints.length === 0) {
        return false;
    }

    // Get all affected body parts from injuries
    const injuredBodyParts = new Set<string>();
    for (const injury of injuryConstraints) {
        const affected = mapInjuryToBodyParts(injury);
        affected.forEach(bp => injuredBodyParts.add(bp.toLowerCase()));
    }

    // Check if any workout body parts match injured body parts
    for (const bodyPart of bodyParts) {
        const bodyPartLower = bodyPart.toLowerCase();

        // Direct match
        if (injuredBodyParts.has(bodyPartLower)) {
            return true;
        }

        // Fuzzy match (e.g., "chest" matches "upper chest")
        for (const injuredPart of injuredBodyParts) {
            if (bodyPartLower.includes(injuredPart) || injuredPart.includes(bodyPartLower)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check for fatigue and force recovery if needed
 */
export function checkFatigue(
    intensity: "strengthen" | "maintain" | "recover",
    recentWorkouts: RecentWorkout[]
): "strengthen" | "maintain" | "recover" {
    // Check for consecutive strengthen days (old "heavy" intensity)
    const recentStrengthenDays = recentWorkouts
        .slice(-3)
        .filter(w => w.intensity === "strengthen" || w.intensity === "heavy").length;

    // Also check for old intensity values for backward compatibility
    const recentHeavyDays = recentWorkouts
        .slice(-3)
        .filter(w => w.intensity === "heavy").length;

    if (recentStrengthenDays >= 3 || recentHeavyDays >= 3) {
        return "recover"; // Force recovery day
    }

    return intensity;
}

/**
 * Rotate body parts based on recent workouts
 */
export function rotateBodyParts(recentWorkouts: RecentWorkout[]): string[] {
    const recentBodyParts = new Set<string>();
    recentWorkouts.slice(-3).forEach(workout => {
        workout.bodyParts.forEach(part => recentBodyParts.add(part.toLowerCase()));
    });

    const availableParts = BODY_PARTS.filter(
        part => !recentBodyParts.has(part.toLowerCase())
    );

    if (availableParts.length >= 3) {
        return availableParts.slice(0, 3).map(p => p);
    } else if (availableParts.length > 0) {
        return [
            ...availableParts,
            ...BODY_PARTS.filter(p => !availableParts.includes(p)).slice(0, 3 - availableParts.length)
        ].slice(0, 3).map(p => p);
    } else {
        const lastWorkout = recentWorkouts[recentWorkouts.length - 1];
        if (lastWorkout) {
            const lastIndex = BODY_PARTS.findIndex(p =>
                lastWorkout.bodyParts.some(bp => bp.toLowerCase() === p.toLowerCase())
            );
            const nextIndex = (lastIndex + 1) % BODY_PARTS.length;
            return [BODY_PARTS[nextIndex], BODY_PARTS[(nextIndex + 1) % BODY_PARTS.length], BODY_PARTS[(nextIndex + 2) % BODY_PARTS.length]];
        }
    }

    return ["chest", "back", "shoulders"]; // Default
}

/**
 * Determine which day of the split cycle we're on based on recent workouts
 * 
 * @param splitType - The user's preferred split type
 * @param recentWorkouts - Recent workouts to analyze
 * @param yesterdayDate - Yesterday's date string (YYYY-MM-DD) to check if workout was missed
 * @returns The split day number (1-indexed) or null if can't determine
 */
export function determineSplitDay(
    splitType: SplitType | undefined,
    recentWorkouts: RecentWorkout[],
    yesterdayDate?: string
): number | null {
    if (!splitType) {
        return null; // No split preference, use rotation
    }

    const template = SPLIT_TEMPLATES[splitType];
    if (!template) {
        return null;
    }

    // If no recent workouts, start with day 1
    if (recentWorkouts.length === 0) {
        return 1;
    }

    // Check if yesterday had a workout (to detect missed days)
    const yesterdayHadWorkout = yesterdayDate && recentWorkouts.some(
        workout => workout.date === yesterdayDate
    );

    // Analyze recent workouts to determine which split day was last
    // Look at the most recent workout's body parts
    const lastWorkout = recentWorkouts[recentWorkouts.length - 1];
    if (!lastWorkout) {
        return 1;
    }

    // Find which split day matches the last workout's body parts
    const lastBodyParts = new Set(
        lastWorkout.bodyParts.map(bp => bp.toLowerCase())
    );

    // Find the split day that best matches the last workout
    let bestMatch: { day: number; score: number } | null = null;

    for (const splitDay of template.days) {
        const splitBodyParts = new Set(
            splitDay.bodyParts.map(bp => bp.toLowerCase())
        );

        // Calculate match score (how many body parts overlap)
        let matchScore = 0;
        for (const bodyPart of lastBodyParts) {
            // Check if this body part matches any split day body part
            for (const splitPart of splitBodyParts) {
                if (bodyPart.includes(splitPart) || splitPart.includes(bodyPart)) {
                    matchScore++;
                    break;
                }
            }
        }

        if (!bestMatch || matchScore > bestMatch.score) {
            bestMatch = { day: splitDay.day, score: matchScore };
        }
    }

    if (!bestMatch || bestMatch.score === 0) {
        // No good match, start fresh with day 1
        return 1;
    }

    // If yesterday was missed (no workout logged), repeat the same split day
    // This ensures continuity - don't skip ahead if user missed a day
    if (!yesterdayHadWorkout && yesterdayDate) {
        return bestMatch.day; // Repeat the same day
    }

    // Next day in the cycle (normal progression)
    const nextDay = (bestMatch.day % template.days.length) + 1;
    return nextDay;
}

/**
 * Get body parts for today based on split and primary lift goal
 * 
 * @param splitType - User's preferred split type
 * @param splitDay - Current day in split cycle (1-indexed)
 * @param primaryLiftBodyParts - Body parts for primary lift (if strength goal with specific lift)
 * @param recentWorkouts - Recent workouts for fallback
 * @returns Body parts to train today
 */
export function getBodyPartsForSplitDay(
    splitType: SplitType | undefined,
    splitDay: number | null,
    primaryLiftBodyParts: string[] | null,
    recentWorkouts: RecentWorkout[]
): string[] {
    // If no split preference, use rotation
    if (!splitType || !splitDay) {
        return rotateBodyParts(recentWorkouts);
    }

    const template = SPLIT_TEMPLATES[splitType];
    if (!template) {
        return rotateBodyParts(recentWorkouts);
    }

    // Get the split day (wrap around if needed)
    const dayIndex = ((splitDay - 1) % template.days.length);
    const todaySplitDay = template.days[dayIndex];

    // Start with split day body parts
    let bodyParts = [...todaySplitDay.bodyParts];

    // If we have a primary lift goal and it matches today's split day, emphasize it
    if (primaryLiftBodyParts && primaryLiftBodyParts.length > 0) {
        // Check if primary lift's body parts overlap with today's split day
        const primaryPartsLower = primaryLiftBodyParts.map(bp => bp.toLowerCase());
        const todayPartsLower = bodyParts.map(bp => bp.toLowerCase());

        const hasOverlap = primaryPartsLower.some(primaryPart =>
            todayPartsLower.some(todayPart =>
                primaryPart.includes(todayPart) || todayPart.includes(primaryPart)
            )
        );

        if (hasOverlap) {
            // Primary lift day! Emphasize primary lift body parts but keep split day structure
            // Merge: prioritize primary lift parts, add other split day parts
            const merged = new Set<string>();

            // Add primary lift body parts first (these are the supporting muscles)
            primaryLiftBodyParts.forEach(bp => merged.add(bp.toLowerCase()));

            // Add split day body parts (ensures we hit all muscles for that day)
            bodyParts.forEach(bp => merged.add(bp.toLowerCase()));

            bodyParts = Array.from(merged);
        }
        // If no overlap, primary lift is on a different day - just use split day body parts
    }

    return bodyParts;
}

/**
 * Check if today is the primary lift's day based on split
 * 
 * @param splitType - User's preferred split type
 * @param splitDay - Current day in split cycle
 * @param primaryLiftBodyParts - Body parts for primary lift
 * @returns true if today matches the primary lift's muscle groups
 */
export function isPrimaryLiftDay(
    splitType: SplitType | undefined,
    splitDay: number | null,
    primaryLiftBodyParts: string[] | null
): boolean {
    if (!splitType || !splitDay || !primaryLiftBodyParts || primaryLiftBodyParts.length === 0) {
        return false;
    }

    const template = SPLIT_TEMPLATES[splitType];
    if (!template) {
        return false;
    }

    const dayIndex = ((splitDay - 1) % template.days.length);
    const todaySplitDay = template.days[dayIndex];

    const primaryPartsLower = primaryLiftBodyParts.map(bp => bp.toLowerCase());
    const todayPartsLower = todaySplitDay.bodyParts.map(bp => bp.toLowerCase());

    // Check if primary lift body parts overlap with today's split day
    return primaryPartsLower.some(primaryPart =>
        todayPartsLower.some(todayPart =>
            primaryPart.includes(todayPart) || todayPart.includes(primaryPart)
        )
    );
}

/**
 * Check if it's time to test/prioritize the primary lift
 * 
 * Only tests the primary lift periodically - checks if it hasn't been done in 3 workouts
 * of the SAME TYPE (e.g., 3 Push days), not 3 workouts in general
 * 
 * @param primaryLiftName - Name of the primary lift
 * @param recentWorkouts - Recent workouts to check frequency
 * @param isPrimaryLiftDay - Whether today is the primary lift's split day
 * @param splitType - User's split type
 * @param splitDay - Current split day number
 * @returns true if it's time to test/prioritize the primary lift
 */
export function shouldTestPrimaryLift(
    primaryLiftName: string,
    recentWorkouts: RecentWorkout[],
    isPrimaryLiftDay: boolean,
    splitType: SplitType | undefined,
    splitDay: number | null
): boolean {
    if (!isPrimaryLiftDay || !splitType || !splitDay) {
        return false; // Only test on the primary lift's split day
    }

    const template = SPLIT_TEMPLATES[splitType];
    if (!template) {
        return false;
    }

    // Get today's split day info
    const dayIndex = ((splitDay - 1) % template.days.length);
    const todaySplitDay = template.days[dayIndex];
    const todayBodyParts = new Set(todaySplitDay.bodyParts.map(bp => bp.toLowerCase()));

    // Find workouts of the SAME TYPE (same split day) in recent workouts
    const sameTypeWorkouts: RecentWorkout[] = [];

    for (const workout of recentWorkouts) {
        const workoutBodyParts = new Set(workout.bodyParts.map(bp => bp.toLowerCase()));

        // Check if this workout matches today's split day type
        let matches = false;
        for (const bodyPart of todayBodyParts) {
            if (workoutBodyParts.has(bodyPart) ||
                Array.from(workoutBodyParts).some(wbp => bodyPart.includes(wbp) || wbp.includes(bodyPart))) {
                matches = true;
                break;
            }
        }

        if (matches) {
            sameTypeWorkouts.push(workout);
        }
    }

    // Check if primary lift was done in the last 6-8 workouts of the SAME TYPE
    // This ensures testing happens approximately once every 2 weeks
    // (assuming 3-4 workouts per week of that type, so 6-8 workouts = ~2 weeks)
    const primaryLiftLower = primaryLiftName.toLowerCase();
    let foundInSameType = false;

    // Check last 8 workouts of the same type (covers ~2 weeks)
    // If user trains that muscle group 3-4x per week, 8 workouts = ~2 weeks
    const checkCount = Math.min(8, sameTypeWorkouts.length);

    for (const workout of sameTypeWorkouts.slice(-checkCount)) {
        const hasPrimaryLift = workout.exercises.some(exercise => {
            const exerciseNameLower = exercise.name.toLowerCase();
            return exerciseNameLower.includes(primaryLiftLower) ||
                primaryLiftLower.includes(exerciseNameLower);
        });

        if (hasPrimaryLift) {
            foundInSameType = true;
            break;
        }
    }

    // Test if primary lift hasn't been done in last 8 workouts of the same type (~2 weeks)
    return !foundInSameType;
}
