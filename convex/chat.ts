import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/* =======================
   Intent Types
======================= */

export type IntentType =
    | "WORKOUT_SWAP_EXERCISE"
    | "WORKOUT_MAKE_EASIER"
    | "WORKOUT_ADD_FOCUS"
    | "MEAL_SUGGEST"
    | "MEAL_LOG_QUICK"
    | "SCHEDULE_MOVE_WORKOUT"
    | "BLOCK_ITEM"
    | "UNKNOWN";

export type Intent = {
    type: IntentType;
    params: Record<string, any>;
    confidence: number;
};

export type ChatResponse = {
    success: boolean;
    message: string;
    dataChanges: Array<{
        type: string;
        description: string;
        id?: string;
    }>;
    refetchIds?: string[];
};

/* =======================
   Intent Parser (Deterministic)
======================= */

function parseIntent(message: string, context: { date: string; activePlanId?: Id<"plans"> }): Intent {
    const lower = message.toLowerCase().trim();

    // WORKOUT_SWAP_EXERCISE: "Swap squats for something knee-friendly"
    if (
        lower.includes("swap") ||
        lower.includes("replace") ||
        lower.includes("change") ||
        lower.includes("switch")
    ) {
        const exerciseMatch = lower.match(/(?:swap|replace|change|switch)\s+(\w+)/);
        const exercise = exerciseMatch ? exerciseMatch[1] : null;
        const kneeFriendly = lower.includes("knee") || lower.includes("knee-friendly");
        const bodyPart = extractBodyPart(lower);

        return {
            type: "WORKOUT_SWAP_EXERCISE",
            params: {
                exerciseName: exercise,
                bodyPart,
                kneeFriendly,
                date: context.date,
            },
            confidence: 0.8,
        };
    }

    // WORKOUT_MAKE_EASIER: "Make today easier" / "Make it shorter"
    if (lower.includes("easier") || lower.includes("shorter") || lower.includes("reduce")) {
        const removeExercise = lower.includes("shorter") || lower.includes("remove exercise");
        return {
            type: "WORKOUT_MAKE_EASIER",
            params: {
                date: context.date,
                mode: removeExercise ? "remove_exercise" : "remove_set",
            },
            confidence: 0.9,
        };
    }

    // WORKOUT_ADD_FOCUS: "Add more arms this week" / "more chest"
    if (lower.includes("add") && (lower.includes("more") || lower.includes("focus"))) {
        const bodyPart = extractBodyPart(lower);
        if (bodyPart) {
            return {
                type: "WORKOUT_ADD_FOCUS",
                params: {
                    bodyPart,
                    count: lower.includes("week") ? 2 : 1,
                },
                confidence: 0.8,
            };
        }
    }

    // MEAL_SUGGEST: "What should I eat tonight?" "high protein snacks"
    if (
        lower.includes("what should i eat") ||
        lower.includes("suggest") ||
        lower.includes("recommend")
    ) {
        const mealType = extractMealType(lower);
        const highProtein = lower.includes("protein") || lower.includes("high protein");
        return {
            type: "MEAL_SUGGEST",
            params: {
                mealType: mealType || "dinner",
                highProtein,
                date: context.date,
            },
            confidence: 0.8,
        };
    }

    // MEAL_LOG_QUICK: "Log chicken salad 450 calories 40 protein"
    if (lower.startsWith("log ") || lower.includes("logged")) {
        const logMatch = lower.match(/log\s+(.+?)(?:\s+(\d+)\s+calories?)?(?:\s+(\d+)\s+protein)?/);
        if (logMatch) {
            const name = logMatch[1].trim();
            const calories = logMatch[2] ? parseInt(logMatch[2]) : null;
            const protein = logMatch[3] ? parseInt(logMatch[3]) : null;

            return {
                type: "MEAL_LOG_QUICK",
                params: {
                    name,
                    calories: calories || 0,
                    protein: protein || undefined,
                    date: context.date,
                },
                confidence: 0.9,
            };
        }
    }

    // SCHEDULE_MOVE_WORKOUT: "Move Friday workout to Saturday"
    if (lower.includes("move") && (lower.includes("workout") || lower.includes("session"))) {
        const dayMatch = lower.match(/move\s+(?:.*?)\s+(?:to|on)\s+(\w+)/);
        const fromDayMatch = lower.match(/move\s+(\w+)/);
        const toDayMatch = lower.match(/to\s+(\w+)/);

        if (toDayMatch) {
            const targetDay = toDayMatch[1];
            return {
                type: "SCHEDULE_MOVE_WORKOUT",
                params: {
                    fromDate: fromDayMatch ? getDateForDayName(fromDayMatch[1], context.date) : context.date,
                    toDate: getDateForDayName(targetDay, context.date),
                },
                confidence: 0.7,
            };
        }
    }

    // BLOCK_ITEM: "Never show burpees again" or "block this meal"
    if (lower.includes("block") || lower.includes("never show") || lower.includes("don't show")) {
        const itemMatch = lower.match(/(?:block|never show|don't show)\s+(.+?)(?:\s+again)?/);
        const itemName = itemMatch ? itemMatch[1].trim() : null;
        const isMeal = lower.includes("meal") || lower.includes("food");

        return {
            type: "BLOCK_ITEM",
            params: {
                itemName,
                itemType: isMeal ? "meal" : "exercise",
            },
            confidence: 0.8,
        };
    }

    return {
        type: "UNKNOWN",
        params: {},
        confidence: 0.1,
    };
}

function extractBodyPart(text: string): string | null {
    const bodyParts = [
        "chest",
        "back",
        "legs",
        "shoulders",
        "arms",
        "biceps",
        "triceps",
        "core",
        "abs",
    ];
    for (const part of bodyParts) {
        if (text.includes(part)) {
            return part;
        }
    }
    return null;
}

function extractMealType(text: string): string | null {
    if (text.includes("breakfast")) return "breakfast";
    if (text.includes("lunch")) return "lunch";
    if (text.includes("dinner") || text.includes("tonight")) return "dinner";
    if (text.includes("snack")) return "snack";
    return null;
}

function getDateForDayName(dayName: string, referenceDate: string): string {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayIndex = days.findIndex((d) => d.startsWith(dayName.toLowerCase()));
    if (dayIndex === -1) return referenceDate;

    const refDate = new Date(referenceDate);
    const currentDay = refDate.getDay();
    let daysToAdd = dayIndex - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence

    const targetDate = new Date(refDate);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    return targetDate.toISOString().split("T")[0];
}

/* =======================
   Intent Execution
======================= */

async function executeIntent(
    ctx: any,
    intent: Intent,
    context: { userId: Id<"users">; planId?: Id<"plans">; date: string }
): Promise<ChatResponse> {
    const dataChanges: ChatResponse["dataChanges"] = [];

    try {
        switch (intent.type) {
            case "WORKOUT_SWAP_EXERCISE": {
                // Get today's workout
                const todayWorkout = await ctx.runQuery(api.workoutEditing.getTodayWorkout, {
                    userId: context.userId,
                    date: context.date,
                });

                if (!todayWorkout) {
                    return {
                        success: false,
                        message: "No workout found for today. Generate a workout first.",
                        dataChanges: [],
                    };
                }

                // Find exercise to replace
                const exerciseToReplace = todayWorkout.exercises.find(
                    (e: any) =>
                        e.exercise?.name.toLowerCase().includes(intent.params.exerciseName?.toLowerCase() || "") ||
                        (intent.params.bodyPart &&
                            e.exercise?.bodyPart?.toLowerCase() === intent.params.bodyPart.toLowerCase())
                );

                if (!exerciseToReplace || !context.planId) {
                    return {
                        success: false,
                        message: `Could not find exercise "${intent.params.exerciseName}" in today's workout.`,
                        dataChanges: [],
                    };
                }

                // Regenerate exercise
                await ctx.runAction(api.plans.regenerateExercise, {
                    exerciseSetId: exerciseToReplace._id,
                    userId: context.userId,
                    planId: context.planId,
                    sessionId: todayWorkout._id,
                });

                dataChanges.push({
                    type: "exercise_swapped",
                    description: `Replaced exercise in today's workout`,
                    id: exerciseToReplace._id,
                });

                return {
                    success: true,
                    message: `Swapped the exercise in your workout. Check your workout for the new exercise.`,
                    dataChanges,
                    refetchIds: [todayWorkout._id],
                };
            }

            case "WORKOUT_MAKE_EASIER": {
                const todayWorkout = await ctx.runQuery(api.workoutEditing.getTodayWorkout, {
                    userId: context.userId,
                    date: context.date,
                });

                if (!todayWorkout) {
                    return {
                        success: false,
                        message: "No workout found for today.",
                        dataChanges: [],
                    };
                }

                await ctx.runMutation(api.workoutEditing.reduceWorkoutVolume, {
                    sessionId: todayWorkout._id,
                    mode: intent.params.mode,
                });

                dataChanges.push({
                    type: "workout_reduced",
                    description: `Made workout ${intent.params.mode === "remove_exercise" ? "shorter" : "easier"}`,
                    id: todayWorkout._id,
                });

                return {
                    success: true,
                    message: `Made your workout ${intent.params.mode === "remove_exercise" ? "shorter" : "easier"}.`,
                    dataChanges,
                    refetchIds: [todayWorkout._id],
                };
            }

            case "WORKOUT_ADD_FOCUS": {
                if (!context.planId) {
                    return {
                        success: false,
                        message: "No active plan found.",
                        dataChanges: [],
                    };
                }

                await ctx.runAction(api.workoutEditing.addAccessoryExercise, {
                    userId: context.userId,
                    planId: context.planId,
                    bodyPart: intent.params.bodyPart,
                    count: intent.params.count || 1,
                });

                dataChanges.push({
                    type: "accessory_added",
                    description: `Added ${intent.params.bodyPart} focus to upcoming workouts`,
                });

                return {
                    success: true,
                    message: `Added more ${intent.params.bodyPart} exercises to your upcoming workouts.`,
                    dataChanges,
                };
            }

            case "MEAL_SUGGEST": {
                // Get suggested meals
                const allMeals = await ctx.runQuery(api.plans.getAllMeals, {});
                let suggestions = allMeals || [];

                // Filter by mealType if specified
                if (intent.params.mealType) {
                    suggestions = suggestions.filter((m: any) =>
                        m.mealType?.includes(intent.params.mealType)
                    );
                }

                // Filter by high protein (heuristic: meals with "protein" in name or >400 calories)
                if (intent.params.highProtein) {
                    suggestions = suggestions.filter(
                        (m: any) =>
                            m.name.toLowerCase().includes("protein") ||
                            m.name.toLowerCase().includes("chicken") ||
                            m.name.toLowerCase().includes("meat") ||
                            m.calories > 400
                    );
                }

                suggestions = suggestions.slice(0, 3);

                if (suggestions.length === 0) {
                    return {
                        success: false,
                        message: "No meals found matching your criteria.",
                        dataChanges: [],
                    };
                }

                const mealNames = suggestions.map((m: any) => m.name).join(", ");

                return {
                    success: true,
                    message: `Here are some suggestions: ${mealNames}. You can assign them from the Meals page.`,
                    dataChanges: [],
                };
            }

            case "MEAL_LOG_QUICK": {
                await ctx.runMutation(api.mealLogs.createMealLog, {
                    userId: context.userId,
                    date: intent.params.date,
                    name: intent.params.name,
                    calories: intent.params.calories,
                    protein: intent.params.protein,
                });

                dataChanges.push({
                    type: "meal_logged",
                    description: `Logged ${intent.params.name}`,
                });

                return {
                    success: true,
                    message: `Logged ${intent.params.name} (${intent.params.calories} calories${intent.params.protein ? `, ${intent.params.protein}g protein` : ""}).`,
                    dataChanges,
                };
            }

            case "SCHEDULE_MOVE_WORKOUT": {
                // Find workout session for fromDate
                const workouts = await ctx.runQuery(api.plans.getWorkoutsByDateRange, {
                    userId: context.userId,
                    startDate: intent.params.fromDate,
                    endDate: intent.params.fromDate,
                });

                if (!workouts || workouts.length === 0) {
                    return {
                        success: false,
                        message: `No workout found for ${intent.params.fromDate}.`,
                        dataChanges: [],
                    };
                }

                const session = workouts[0];
                await ctx.runMutation(api.workoutEditing.moveWorkoutSession, {
                    sessionId: session._id,
                    newDate: intent.params.toDate,
                });

                dataChanges.push({
                    type: "workout_moved",
                    description: `Moved workout from ${intent.params.fromDate} to ${intent.params.toDate}`,
                    id: session._id,
                });

                return {
                    success: true,
                    message: `Moved your workout to ${new Date(intent.params.toDate).toLocaleDateString()}.`,
                    dataChanges,
                    refetchIds: [session._id],
                };
            }

            case "BLOCK_ITEM": {
                // Find item by name
                if (intent.params.itemType === "exercise") {
                    const exercises = await ctx.runQuery(api.plans.getAllExercises, {});
                    const exercise = exercises?.find((e: any) =>
                        e.name.toLowerCase().includes(intent.params.itemName?.toLowerCase() || "")
                    );

                    if (!exercise) {
                        return {
                            success: false,
                            message: `Could not find exercise "${intent.params.itemName}".`,
                            dataChanges: [],
                        };
                    }

                    await ctx.runMutation(api.plans.blockItem, {
                        userId: context.userId,
                        itemType: "exercise",
                        itemId: exercise._id,
                        itemName: exercise.name,
                    });

                    dataChanges.push({
                        type: "item_blocked",
                        description: `Blocked exercise: ${exercise.name}`,
                    });

                    return {
                        success: true,
                        message: `Blocked "${exercise.name}". You won't see it in future workouts.`,
                        dataChanges,
                    };
                } else {
                    const meals = await ctx.runQuery(api.plans.getAllMeals, {});
                    const meal = meals?.find((m: any) =>
                        m.name.toLowerCase().includes(intent.params.itemName?.toLowerCase() || "")
                    );

                    if (!meal) {
                        return {
                            success: false,
                            message: `Could not find meal "${intent.params.itemName}".`,
                            dataChanges: [],
                        };
                    }

                    await ctx.runMutation(api.plans.blockItem, {
                        userId: context.userId,
                        itemType: "meal",
                        itemId: meal._id,
                        itemName: meal.name,
                    });

                    dataChanges.push({
                        type: "item_blocked",
                        description: `Blocked meal: ${meal.name}`,
                    });

                    return {
                        success: true,
                        message: `Blocked "${meal.name}". You won't see it in future suggestions.`,
                        dataChanges,
                    };
                }
            }

            case "UNKNOWN":
            default:
                return {
                    success: false,
                    message: "I didn't understand that. Try: 'swap squats', 'make today easier', 'log chicken salad 450 calories', or 'move Friday workout to Saturday'.",
                    dataChanges: [],
                };
        }
    } catch (error) {
        return {
            success: false,
            message: `Error: ${error instanceof Error ? error.message : String(error)}`,
            dataChanges: [],
        };
    }
}

/* =======================
   Chat Command Action
======================= */

export const chatCommand = action({
    args: {
        userId: v.id("users"),
        message: v.string(),
        date: v.string(),
    },
    handler: async (ctx, args): Promise<ChatResponse> => {
        // Get active plan
        const activePlan = await ctx.runQuery(api.plans.getActivePlan, {
            userId: args.userId,
        });

        const context = {
            userId: args.userId,
            planId: activePlan?._id,
            date: args.date,
        };

        // Parse intent
        const intent = parseIntent(args.message, {
            date: args.date,
            activePlanId: activePlan?._id,
        });

        // Execute intent
        const response = await executeIntent(ctx, intent, context);

        return response;
    },
});
