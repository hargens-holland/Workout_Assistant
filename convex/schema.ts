import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        name: v.string(),
        email: v.string(),
        avatar: v.optional(v.string()),
        clerkId: v.string(),
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
            split_type: v.optional(v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS"))),
        })),
        executionConfig: v.optional(v.object({
            split_type: v.optional(v.union(v.literal("PPL"), v.literal("UPPER_LOWER"), v.literal("FULL_BODY"), v.literal("BRO_SPLIT"), v.literal("PUSH_PULL_LEGS_ARMS"))),
            intensity_distribution: v.object({
                heavy: v.number(),
                moderate: v.number(),
                light: v.number(),
            }),
        })),
        isActive: v.boolean(),
    })
        .index("by_user_id", ["userId"])
        .index("by_active", ["isActive"]),

    exercises: defineTable({
        name: v.string(),
        bodyPart: v.string(),
        isCompound: v.boolean(),
        equipment: v.optional(v.string()),
        instructions: v.optional(v.array(v.string())),
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
        planId: v.id("plans"),
        date: v.string(),
        weekNumber: v.number(),
        dayOfWeek: v.string(),
        intensity: v.string(),
    })
        .index("by_user_id", ["userId"])
        .index("by_plan_id", ["planId"])
        .index("by_date", ["date"]),

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
});
