import { defineSchema, defineTable } from 'convex/server';

import { v } from 'convex/values';

export default defineSchema({
    users: defineTable({
        name: v.string(),
        email: v.string(),
        avatar: v.optional(v.string()),
        clerkID: v.string(),
    }).index("byClerkID", ["clerkID"]),

    plans: defineTable({
        userID: v.id("users"),
        name: v.string(),
        workoutPlan: v.object({
            schedule: v.array(v.string()),
            exercises: v.array(
                v.object({
                    day: v.string(),
                    routine: v.array(
                        v.object({
                            name: v.string(),
                            sets: v.number(),
                            reps: v.number(),
                            duration: v.optional(v.number()),
                            description: v.optional(v.string()),
                            exercise: v.optional(v.array(v.string()))
                        })
                    )
                })
            )
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
        isActive: v.boolean(),
    }).index("byUserID", ["userID"]).index("by_active", ["isActive"]),
});