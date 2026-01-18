/**
 * Split Day Templates for Workout Generation
 * 
 * Defines hardcoded templates for each split day type that specify:
 * - Exercise type (compound/accessory)
 * - Body part to target
 * - Priority (order in workout, lower = higher priority)
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

export type ExerciseTemplate = {
    type: "compound" | "accessory";
    bodyPart: string; // e.g., "chest", "triceps", "front delts"
    priority: number; // Lower = higher priority (1 = first exercise)
};

export type SplitDayTemplate = {
    name: string; // e.g., "Push", "Pull", "Legs"
    exercises: ExerciseTemplate[];
};

/**
 * Templates for each split day type
 * Maps split day names (lowercase) to their exercise templates
 */
export const SPLIT_DAY_TEMPLATES: Record<string, SplitDayTemplate> = {
    // PPL Split
    "push": {
        name: "Push",
        exercises: [
            { type: "compound", bodyPart: "chest", priority: 1 },
            { type: "compound", bodyPart: "chest", priority: 2 },
            { type: "accessory", bodyPart: "chest", priority: 3 },
            { type: "accessory", bodyPart: "triceps", priority: 4 },
            { type: "accessory", bodyPart: "triceps", priority: 5 },
            { type: "accessory", bodyPart: "front delts", priority: 6 },
        ],
    },
    "pull": {
        name: "Pull",
        exercises: [
            { type: "compound", bodyPart: "upper back", priority: 1 },
            { type: "compound", bodyPart: "lats", priority: 2 },
            { type: "accessory", bodyPart: "lats", priority: 3 },
            { type: "accessory", bodyPart: "biceps", priority: 4 },
            { type: "accessory", bodyPart: "biceps", priority: 5 },
            { type: "accessory", bodyPart: "rear delts", priority: 6 },
        ],
    },
    "legs": {
        name: "Legs",
        exercises: [
            { type: "compound", bodyPart: "quads", priority: 1 },
            { type: "compound", bodyPart: "hamstrings", priority: 2 },
            { type: "accessory", bodyPart: "quads", priority: 3 },
            { type: "accessory", bodyPart: "hamstrings", priority: 4 },
            { type: "accessory", bodyPart: "glutes", priority: 5 },
            { type: "accessory", bodyPart: "calves", priority: 6 },
        ],
    },

    // Upper/Lower Split
    "upper": {
        name: "Upper",
        exercises: [
            { type: "compound", bodyPart: "chest", priority: 1 },
            { type: "compound", bodyPart: "upper back", priority: 2 },
            { type: "compound", bodyPart: "front delts", priority: 3 },
            { type: "accessory", bodyPart: "chest", priority: 4 },
            { type: "accessory", bodyPart: "lats", priority: 5 },
            { type: "accessory", bodyPart: "biceps", priority: 6 },
            { type: "accessory", bodyPart: "triceps", priority: 7 },
        ],
    },
    "lower": {
        name: "Lower",
        exercises: [
            { type: "compound", bodyPart: "quads", priority: 1 },
            { type: "compound", bodyPart: "hamstrings", priority: 2 },
            { type: "accessory", bodyPart: "quads", priority: 3 },
            { type: "accessory", bodyPart: "hamstrings", priority: 4 },
            { type: "accessory", bodyPart: "glutes", priority: 5 },
            { type: "accessory", bodyPart: "calves", priority: 6 },
        ],
    },

    // Full Body Split
    "full body": {
        name: "Full Body",
        exercises: [
            { type: "compound", bodyPart: "chest", priority: 1 },
            { type: "compound", bodyPart: "upper back", priority: 2 },
            { type: "compound", bodyPart: "quads", priority: 3 },
            { type: "accessory", bodyPart: "lateral delts", priority: 4 },
            { type: "accessory", bodyPart: "biceps", priority: 5 },
            { type: "accessory", bodyPart: "triceps", priority: 6 },
        ],
    },

    // Bro Split
    "chest": {
        name: "Chest",
        exercises: [
            { type: "compound", bodyPart: "chest", priority: 1 },
            { type: "compound", bodyPart: "chest", priority: 2 },
            { type: "accessory", bodyPart: "chest", priority: 3 },
            { type: "accessory", bodyPart: "chest", priority: 4 },
            { type: "accessory", bodyPart: "triceps", priority: 5 },
        ],
    },
    "back": {
        name: "Back",
        exercises: [
            { type: "compound", bodyPart: "upper back", priority: 1 },
            { type: "compound", bodyPart: "lats", priority: 2 },
            { type: "accessory", bodyPart: "lats", priority: 3 },
            { type: "accessory", bodyPart: "lower back", priority: 4 },
            { type: "accessory", bodyPart: "biceps", priority: 5 },
        ],
    },
    "shoulders": {
        name: "Shoulders",
        exercises: [
            { type: "compound", bodyPart: "front delts", priority: 1 },
            { type: "compound", bodyPart: "lateral delts", priority: 2 },
            { type: "accessory", bodyPart: "lateral delts", priority: 3 },
            { type: "accessory", bodyPart: "rear delts", priority: 4 },
            { type: "accessory", bodyPart: "traps", priority: 5 },
        ],
    },
    "arms": {
        name: "Arms",
        exercises: [
            { type: "compound", bodyPart: "biceps", priority: 1 },
            { type: "compound", bodyPart: "triceps", priority: 2 },
            { type: "accessory", bodyPart: "biceps", priority: 3 },
            { type: "accessory", bodyPart: "triceps", priority: 4 },
            { type: "accessory", bodyPart: "forearms", priority: 5 },
        ],
    },

    // Push/Pull/Legs/Arms Split
    // "push" and "pull" and "legs" already defined above
    // "arms" already defined above

    // Chest & Back / Shoulders & Arms / Legs Split
    "chest & back": {
        name: "Chest & Back",
        exercises: [
            { type: "compound", bodyPart: "chest", priority: 1 },
            { type: "compound", bodyPart: "upper back", priority: 2 },
            { type: "compound", bodyPart: "lats", priority: 3 },
            { type: "accessory", bodyPart: "chest", priority: 4 },
            { type: "accessory", bodyPart: "upper back", priority: 5 },
            { type: "accessory", bodyPart: "lats", priority: 6 },
        ],
    },
    "shoulders & arms": {
        name: "Shoulders & Arms",
        exercises: [
            { type: "compound", bodyPart: "front delts", priority: 1 },
            { type: "compound", bodyPart: "lateral delts", priority: 2 },
            { type: "accessory", bodyPart: "rear delts", priority: 3 },
            { type: "accessory", bodyPart: "biceps", priority: 4 },
            { type: "accessory", bodyPart: "triceps", priority: 5 },
            { type: "accessory", bodyPart: "biceps", priority: 6 },
            { type: "accessory", bodyPart: "triceps", priority: 7 },
        ],
    },
    // "legs" already defined above
};

/**
 * Stretch Workout Templates
 * Used for daily stretching routines, especially for endurance goals
 */
export const STRETCH_WORKOUT_TEMPLATES: Record<string, SplitDayTemplate> = {
    "full body": {
        name: "Full Body Stretch",
        exercises: [
            { type: "accessory", bodyPart: "quads", priority: 1 },
            { type: "accessory", bodyPart: "hamstrings", priority: 2 },
            { type: "accessory", bodyPart: "glutes", priority: 3 },
            { type: "accessory", bodyPart: "hip flexors", priority: 4 },
            { type: "accessory", bodyPart: "upper back", priority: 5 },
            { type: "accessory", bodyPart: "front delts", priority: 6 },
            { type: "accessory", bodyPart: "lateral delts", priority: 7 },
            { type: "accessory", bodyPart: "rear delts", priority: 8 },
            { type: "accessory", bodyPart: "chest", priority: 9 },
            { type: "accessory", bodyPart: "calves", priority: 10 },
        ],
    },
    "lower body": {
        name: "Lower Body Stretch",
        exercises: [
            { type: "accessory", bodyPart: "quads", priority: 1 },
            { type: "accessory", bodyPart: "hamstrings", priority: 2 },
            { type: "accessory", bodyPart: "glutes", priority: 3 },
            { type: "accessory", bodyPart: "hip flexors", priority: 4 },
            { type: "accessory", bodyPart: "calves", priority: 5 },
            { type: "accessory", bodyPart: "lower back", priority: 6 },
        ],
    },
    "upper body": {
        name: "Upper Body Stretch",
        exercises: [
            { type: "accessory", bodyPart: "upper back", priority: 1 },
            { type: "accessory", bodyPart: "front delts", priority: 2 },
            { type: "accessory", bodyPart: "lateral delts", priority: 3 },
            { type: "accessory", bodyPart: "rear delts", priority: 4 },
            { type: "accessory", bodyPart: "chest", priority: 5 },
            { type: "accessory", bodyPart: "biceps", priority: 6 },
            { type: "accessory", bodyPart: "triceps", priority: 7 },
            { type: "accessory", bodyPart: "traps", priority: 8 },
        ],
    },
    "pre run": {
        name: "Pre-Run Stretch",
        exercises: [
            { type: "accessory", bodyPart: "quads", priority: 1 },
            { type: "accessory", bodyPart: "hamstrings", priority: 2 },
            { type: "accessory", bodyPart: "calves", priority: 3 },
            { type: "accessory", bodyPart: "hip flexors", priority: 4 },
            { type: "accessory", bodyPart: "glutes", priority: 5 },
        ],
    },
    "pre lift": {
        name: "Pre-Lift Stretch",
        exercises: [
            { type: "accessory", bodyPart: "upper back", priority: 1 },
            { type: "accessory", bodyPart: "front delts", priority: 2 },
            { type: "accessory", bodyPart: "hip flexors", priority: 3 },
            { type: "accessory", bodyPart: "quads", priority: 4 },
            { type: "accessory", bodyPart: "hamstrings", priority: 5 },
            { type: "accessory", bodyPart: "glutes", priority: 6 },
        ],
    },
};

/**
 * Get stretch workout template by name (case-insensitive)
 */
export function getStretchWorkoutTemplate(templateName: string): SplitDayTemplate | null {
    const key = templateName.toLowerCase().replace(/\s+/g, " ");
    return STRETCH_WORKOUT_TEMPLATES[key] || null;
}

/**
 * Query to get stretch workout template
 */
export const getStretchWorkoutTemplateQuery = query({
    args: {
        templateName: v.string(),
    },
    handler: async (ctx, args) => {
        return getStretchWorkoutTemplate(args.templateName);
    },
});

/**
 * Get split day template by name (case-insensitive)
 */
export function getSplitDayTemplate(splitDayName: string): SplitDayTemplate | null {
    const key = splitDayName.toLowerCase();
    return SPLIT_DAY_TEMPLATES[key] || null;
}

/**
 * Get split day name from split type and day number
 * Maps the split day number to the actual split day name
 */
export function getSplitDayName(
    splitType: "PPL" | "UPPER_LOWER" | "FULL_BODY" | "BRO_SPLIT" | "PUSH_PULL_LEGS_ARMS" | "CHEST_BACK_SHOULDERS_ARMS_LEGS" | undefined,
    splitDay: number | null
): string | null {
    if (!splitType || !splitDay) {
        return null;
    }

    const dayMappings: Record<string, Record<number, string>> = {
        PPL: {
            1: "push",
            2: "pull",
            3: "legs",
        },
        UPPER_LOWER: {
            1: "upper",
            2: "lower",
        },
        FULL_BODY: {
            1: "full body",
        },
        BRO_SPLIT: {
            1: "chest",
            2: "back",
            3: "shoulders",
            4: "arms",
            5: "legs",
        },
        PUSH_PULL_LEGS_ARMS: {
            1: "push",
            2: "pull",
            3: "legs",
            4: "arms",
        },
        CHEST_BACK_SHOULDERS_ARMS_LEGS: {
            1: "chest & back",
            2: "shoulders & arms",
            3: "legs",
        },
    };

    const mapping = dayMappings[splitType];
    if (!mapping) {
        return null;
    }

    // Handle wrap-around for split cycles
    const maxDay = Math.max(...Object.keys(mapping).map(Number));
    const normalizedDay = ((splitDay - 1) % maxDay) + 1;

    return mapping[normalizedDay] || null;
}
