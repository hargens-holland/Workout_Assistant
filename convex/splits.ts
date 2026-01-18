/**
 * Workout Split Templates
 * 
 * Defines common workout split structures that users can select.
 * Each split specifies which body parts are trained on which days.
 */

export type SplitType = "PPL" | "UPPER_LOWER" | "FULL_BODY" | "BRO_SPLIT" | "PUSH_PULL_LEGS_ARMS" | "CHEST_BACK_SHOULDERS_ARMS_LEGS";

export type SplitDay = {
    day: number; // Day number in the split cycle (1-indexed)
    name: string; // Display name (e.g., "Push", "Upper")
    bodyParts: string[]; // Body parts to train on this day
};

export type SplitTemplate = {
    type: SplitType;
    name: string;
    days: SplitDay[];
    daysPerWeek: number; // How many days per week this split uses
};

export const SPLIT_TEMPLATES: Record<SplitType, SplitTemplate> = {
    PPL: {
        type: "PPL",
        name: "Push/Pull/Legs",
        daysPerWeek: 6, // Typically 6 days (2 cycles per week)
        days: [
            {
                day: 1,
                name: "Push",
                bodyParts: ["chest", "shoulders", "triceps"],
            },
            {
                day: 2,
                name: "Pull",
                bodyParts: ["back", "biceps"],
            },
            {
                day: 3,
                name: "Legs",
                bodyParts: ["legs", "glutes"],
            },
        ],
    },
    UPPER_LOWER: {
        type: "UPPER_LOWER",
        name: "Upper/Lower",
        daysPerWeek: 4, // Typically 4 days (2 cycles per week)
        days: [
            {
                day: 1,
                name: "Upper",
                bodyParts: ["chest", "back", "shoulders", "biceps", "triceps"],
            },
            {
                day: 2,
                name: "Lower",
                bodyParts: ["legs", "glutes"],
            },
        ],
    },
    FULL_BODY: {
        type: "FULL_BODY",
        name: "Full Body",
        daysPerWeek: 3, // Typically 3 days per week
        days: [
            {
                day: 1,
                name: "Full Body",
                bodyParts: ["chest", "back", "legs", "shoulders"],
            },
        ],
    },
    BRO_SPLIT: {
        type: "BRO_SPLIT",
        name: "Bro Split",
        daysPerWeek: 5, // 5 days per week
        days: [
            {
                day: 1,
                name: "Chest",
                bodyParts: ["chest", "triceps"],
            },
            {
                day: 2,
                name: "Back",
                bodyParts: ["back", "biceps"],
            },
            {
                day: 3,
                name: "Shoulders",
                bodyParts: ["shoulders", "traps"],
            },
            {
                day: 4,
                name: "Arms",
                bodyParts: ["biceps", "triceps"],
            },
            {
                day: 5,
                name: "Legs",
                bodyParts: ["legs", "glutes"],
            },
        ],
    },
    PUSH_PULL_LEGS_ARMS: {
        type: "PUSH_PULL_LEGS_ARMS",
        name: "Push/Pull/Legs/Arms",
        daysPerWeek: 4, // 4 days per week
        days: [
            {
                day: 1,
                name: "Push",
                bodyParts: ["chest", "shoulders", "triceps"],
            },
            {
                day: 2,
                name: "Pull",
                bodyParts: ["back", "biceps"],
            },
            {
                day: 3,
                name: "Legs",
                bodyParts: ["legs", "glutes"],
            },
            {
                day: 4,
                name: "Arms",
                bodyParts: ["biceps", "triceps"],
            },
        ],
    },
    CHEST_BACK_SHOULDERS_ARMS_LEGS: {
        type: "CHEST_BACK_SHOULDERS_ARMS_LEGS",
        name: "Chest & Back / Shoulders & Arms / Legs",
        daysPerWeek: 3, // 3 days per week
        days: [
            {
                day: 1,
                name: "Chest & Back",
                bodyParts: ["chest", "upper back", "lats"],
            },
            {
                day: 2,
                name: "Shoulders & Arms",
                bodyParts: ["front delts", "lateral delts", "rear delts", "biceps", "triceps"],
            },
            {
                day: 3,
                name: "Legs",
                bodyParts: ["quads", "hamstrings", "glutes"],
            },
        ],
    },
};

/**
 * Get a split template by type
 */
export function getSplitTemplate(splitType: SplitType): SplitTemplate {
    return SPLIT_TEMPLATES[splitType];
}

/**
 * Get all available split types
 */
export function getAllSplitTypes(): SplitType[] {
    return Object.keys(SPLIT_TEMPLATES) as SplitType[];
}
