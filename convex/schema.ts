import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        name: v.string(),
        email: v.string(),
        avatar: v.optional(v.string()),
        clerkId: v.string(),
        height_cm: v.optional(v.number()),
        weight_kg: v.optional(v.number()),
        experience_level: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
        equipment_access: v.optional(v.any()),
        injury_constraints: v.optional(v.array(v.string())),
        preferences: v.optional(v.any()),
    }).index("by_clerk_id", ["clerkId"]),

    plans: defineTable({
        userId: v.id("users"),
        name: v.string(),
        workoutPlan: v.object({
            schedule: v.array(v.string()),
            exercises: v.array(
                v.object({
                    day: v.string(),
                    routines: v.array(
                        v.object({
                            name: v.string(),
                            sets: v.optional(v.number()),
                            reps: v.optional(v.number()),
                            duration: v.optional(v.string()),
                            description: v.optional(v.string()),
                            exercises: v.optional(v.array(v.string())),
                        })
                    ),
                })
            ),
        }),
        dietPlan: v.object({
            dailyCalories: v.number(),
            meals: v.array(
                v.object({
                    name: v.string(),
                    foods: v.array(v.string()),
                    calories: v.number(),
                    instructions: v.array(v.string()),
                })
            ),
        }),
        trainingStrategy: v.optional(v.object({
            goal_type: v.string(),
            primary_focus: v.string(),
            time_horizon_weeks: v.number(),
            training_priorities: v.array(v.string()),
            secondary_support: v.array(v.string()),
            recommended_frequency: v.any(),
            intensity_distribution: v.object({
                heavy: v.number(),
                moderate: v.number(),
                light: v.number(),
            }),
            recovery_notes: v.string(),
            split_type: v.optional(v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS"), v.literal("CHEST_BACK_SHOULDERS_ARMS_LEGS"))),
        })),
        executionConfig: v.optional(v.object({
            split_type: v.optional(v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS"), v.literal("CHEST_BACK_SHOULDERS_ARMS_LEGS"))),
            intensity_distribution: v.object({
                heavy: v.number(),
                moderate: v.number(),
                light: v.number(),
            }),
        })),
        goals: v.optional(v.array(v.object({
            category: v.union(
                v.literal("body_composition"),
                v.literal("strength"),
                v.literal("endurance"),
                v.literal("mobility"),
                v.literal("skill")
            ),
            target: v.optional(v.object({
                exercise: v.optional(v.string()),
                movement: v.optional(v.string()),
                metric: v.optional(v.union(
                    v.literal("weight"),
                    v.literal("reps"),
                    v.literal("time"),
                    v.literal("distance"),
                    v.literal("rom")
                )),
            })),
            direction: v.optional(v.union(
                v.literal("increase"),
                v.literal("decrease"),
                v.literal("achieve")
            )),
            value: v.optional(v.number()),
            unit: v.optional(v.string()),
            priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        }))),
        isActive: v.boolean(),
    })
        .index("by_user_id", ["userId"])
        .index("by_active", ["isActive"]),

    exercises: defineTable({
        name: v.string(),
        bodyPart: v.optional(v.string()), // Kept for backward compatibility, use bodyParts instead
        bodyParts: v.array(v.string()), // Array of body parts this exercise targets
        isCompound: v.boolean(),
        equipment: v.optional(v.string()),
        instructions: v.optional(v.array(v.string())),
        tutorialImage: v.optional(v.string()), // URL or path to tutorial image/video
    })
        .index("by_body_part", ["bodyPart"])
        .index("by_compound", ["isCompound"]),

    meals: defineTable({
        name: v.string(),
        foods: v.array(v.string()),
        calories: v.number(),
        instructions: v.array(v.string()),
        mealType: v.optional(v.array(v.string())), // ["breakfast"], ["lunch"], ["dinner"], ["snack"], or combinations like ["breakfast", "lunch"]
    })
        .index("by_name", ["name"]),

    workout_sessions: defineTable({
        userId: v.id("users"),
        goalId: v.optional(v.id("goals")), // Link workout to specific goal (optional for backward compatibility)
        date: v.string(),
        weekNumber: v.optional(v.number()),
        dayOfWeek: v.optional(v.string()),
        intensity: v.string(),
        workoutType: v.optional(v.union(
            v.literal("main"),
            v.literal("stretch"),
            v.literal("cardio"),
            v.literal("endurance")
        )), // Type of workout: main (lifting), stretch, cardio, or endurance (running/swimming)
        workoutExplanation: v.optional(v.string()), // AI-generated explanation of why this workout was chosen
        mealExplanation: v.optional(v.string()), // AI-generated explanation of why these meals were chosen
    })
        .index("by_user_id", ["userId"])
        .index("by_date", ["date"])
        .index("by_user_and_date", ["userId", "date"])
        .index("by_goal_id", ["goalId"])
        .index("by_user_date_goal", ["userId", "date", "goalId"]),

    exercise_sets: defineTable({
        sessionId: v.id("workout_sessions"),
        exerciseId: v.id("exercises"),
        plannedWeight: v.number(),
        plannedReps: v.number(),
        actualWeight: v.optional(v.number()),
        actualReps: v.optional(v.number()),
        actualRPE: v.optional(v.number()),
        completed: v.boolean(),
        setNumber: v.number(),
    })
        .index("by_session_id", ["sessionId"])
        .index("by_exercise_id", ["exerciseId"]),

    daily_meals: defineTable({
        sessionId: v.id("workout_sessions"),
        mealId: v.id("meals"),
        mealType: v.string(), // "breakfast", "lunch", "dinner", "snack"
        completed: v.boolean(),
        order: v.number(), // Order of meal in the day
    })
        .index("by_session_id", ["sessionId"])
        .index("by_meal_id", ["mealId"]),

    blocked_items: defineTable({
        userId: v.id("users"),
        itemType: v.union(v.literal("exercise"), v.literal("meal")),
        itemId: v.string(), // Store as string to support both exercise and meal IDs
        itemName: v.string(), // Store name for easy reference
    })
        .index("by_user_id", ["userId"])
        .index("by_item", ["itemType", "itemId"]),

    meal_logs: defineTable({
        userId: v.id("users"),
        date: v.string(), // ISO date string (YYYY-MM-DD)
        name: v.string(),
        calories: v.number(),
        protein: v.optional(v.number()), // grams
        mealType: v.optional(v.string()), // "breakfast", "lunch", "dinner", "snack"
    })
        .index("by_user_id", ["userId"])
        .index("by_date", ["date"])
        .index("by_user_and_date", ["userId", "date"]),

    daily_tracking: defineTable({
        userId: v.id("users"),
        date: v.string(), // ISO date string (YYYY-MM-DD)
        waterIntake: v.number(), // liters
        steps: v.number(), // step count
        weight_kg: v.optional(v.number()), // weight in kilograms
        distance_km: v.optional(v.number()), // distance in kilometers (for running/endurance goals)
    })
        .index("by_user_id", ["userId"])
        .index("by_date", ["date"])
        .index("by_user_and_date", ["userId", "date"]),

    challenges: defineTable({
        userId: v.id("users"),
        challengeType: v.union(v.literal("pushup"), v.literal("pullup")),
        startDate: v.string(), // ISO date string (YYYY-MM-DD)
        endDate: v.string(), // ISO date string (YYYY-MM-DD)
        targetReps: v.number(), // Target reps to achieve
        currentReps: v.number(), // Current best reps
        dailyLogs: v.array(v.object({
            date: v.string(),
            reps: v.number(),
        })),
        completed: v.boolean(),
    })
        .index("by_user_id", ["userId"])
        .index("by_type", ["challengeType"])
        .index("by_user_and_type", ["userId", "challengeType"]),

    goals: defineTable({
        userId: v.id("users"),
        category: v.union(
            v.literal("body_composition"),
            v.literal("strength"),
            v.literal("endurance"),
            v.literal("mobility"),
            v.literal("skill")
        ),
        target: v.optional(v.object({
            exercise: v.optional(v.string()),
            movement: v.optional(v.string()),
            metric: v.optional(v.union(
                v.literal("weight"),
                v.literal("reps"),
                v.literal("time"),
                v.literal("distance"),
                v.literal("rom")
            )),
        })),
        direction: v.optional(v.union(
            v.literal("increase"),
            v.literal("decrease"),
            v.literal("achieve")
        )),
        value: v.optional(v.number()),
        unit: v.optional(v.string()),
        isActive: v.boolean(),
        completed: v.optional(v.boolean()),
    })
        .index("by_user_id", ["userId"])
        .index("by_active", ["isActive"])
        .index("by_user_and_active", ["userId", "isActive"]),
});
