import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { z } from "zod";
import { generateText } from "./llm";

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
   Intent Schema (Zod)
======================= */

const IntentSchema = z.object({
    intent: z.enum([
        "CLARIFY",
        "EDIT_TODAY_WORKOUT",
        "REGENERATE_TODAY_WORKOUT",
        "SWAP_EXERCISE",
        "GENERATE_PLAN",
        "UPDATE_GOAL",
        "SWAP_MEAL",
        "LOG_MEAL",
        "REQUEST_EXPLANATION",
        "VIEW_PROGRESS",
        "SMALL_TALK",
        "UNKNOWN",
    ]),
    confidence: z.number().min(0).max(1),
    params: z.record(z.string(), z.any()),
});

type LLMIntent = z.infer<typeof IntentSchema>;

/* =======================
   Intent Parser (LLM-based)
======================= */

async function parseIntent(
    message: string,
    context: { date: string; activePlanId?: Id<"plans"> }
): Promise<Intent> {
    const systemPrompt = `You are an intent classifier for a fitness assistant app.

Return JSON only. Do NOT include explanations, markdown, or extra text.

Choose EXACTLY ONE intent from the list below:

- CLARIFY: User's request is ambiguous or unclear
- EDIT_TODAY_WORKOUT: User wants to modify today's workout (make easier, shorter, etc.)
- REGENERATE_TODAY_WORKOUT: User wants to completely regenerate today's workout
- SWAP_EXERCISE: User wants to swap/replace an exercise in a workout
- GENERATE_PLAN: User wants to generate a new fitness plan
- UPDATE_GOAL: User wants to update their fitness goals
- SWAP_MEAL: User wants to swap/replace a meal
- LOG_MEAL: User wants to log a meal they ate
- REQUEST_EXPLANATION: User is asking for an explanation about something
- VIEW_PROGRESS: User wants to see their progress/stats
- SMALL_TALK: Casual conversation, greetings, etc.
- UNKNOWN: Intent doesn't match any of the above

Return a JSON object with:
- intent: one of the intent strings above
- confidence: number between 0 and 1 (how confident you are in this classification)
- params: an object with any relevant parameters extracted from the message

Example: {"intent": "SWAP_EXERCISE", "confidence": 0.9, "params": {"exerciseName": "squats", "bodyPart": "legs"}}`;

    try {
        const llmResponse = await generateText({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message },
            ],
            modelRole: "intent",
        });

        // [TEST LOG] Raw LLM response
        console.log("🔍 [INTENT PARSING] User input:", message);
        console.log("🔍 [INTENT PARSING] Raw LLM response:", llmResponse);

        // Parse JSON from response
        // Note: responseMimeType is set to "application/json" so markdown stripping is likely unnecessary,
        // but kept defensively for robustness
        let jsonText = llmResponse.trim();
        // Remove markdown code blocks if present (defensive)
        jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

        const parsed = JSON.parse(jsonText);
        const validated = IntentSchema.parse(parsed);

        // [TEST LOG] Validated LLM intent
        console.log("🔍 [INTENT PARSING] Parsed & validated LLM intent:", JSON.stringify(validated, null, 2));

        // Map LLM intent to internal intent type
        const internalIntent = mapLLMIntentToInternal(validated, context);
        console.log("🔍 [INTENT PARSING] Mapped to internal intent:", JSON.stringify(internalIntent, null, 2));

        return internalIntent;
    } catch (error) {
        // [TEST LOG] Parsing/validation failure
        console.error("❌ [INTENT PARSING] Error parsing intent:", error);
        // If parsing or validation fails, return UNKNOWN with 0 confidence
        return {
            type: "UNKNOWN",
            params: {},
            confidence: 0,
        };
    }
}

/* =======================
   Intent Mapping
======================= */

function mapLLMIntentToInternal(
    llmIntent: LLMIntent,
    context: { date: string; activePlanId?: Id<"plans"> }
): Intent {
    // [TEST LOG] Mapping decision
    console.log("🔄 [INTENT MAPPING] Mapping LLM intent:", llmIntent.intent, "→ internal intent");

    switch (llmIntent.intent) {
        case "SWAP_EXERCISE":
            return {
                type: "WORKOUT_SWAP_EXERCISE",
                params: {
                    ...llmIntent.params,
                    date: context.date,
                },
                confidence: llmIntent.confidence,
            };

        case "LOG_MEAL":
            return {
                type: "MEAL_LOG_QUICK",
                params: {
                    ...llmIntent.params,
                    date: context.date,
                },
                confidence: llmIntent.confidence,
            };

        case "EDIT_TODAY_WORKOUT":
            // Map to WORKOUT_MAKE_EASIER for now (existing behavior)
            return {
                type: "WORKOUT_MAKE_EASIER",
                params: {
                    date: context.date,
                    mode: llmIntent.params.mode || "remove_set",
                },
                confidence: llmIntent.confidence,
            };

        case "REGENERATE_TODAY_WORKOUT":
            // Map to UNKNOWN for now (no existing handler, will return message)
            return {
                type: "UNKNOWN",
                params: {
                    originalIntent: "REGENERATE_TODAY_WORKOUT",
                    ...llmIntent.params,
                },
                confidence: llmIntent.confidence,
            };

        case "CLARIFY":
        case "SMALL_TALK":
        case "REQUEST_EXPLANATION":
        case "VIEW_PROGRESS":
        case "GENERATE_PLAN":
        case "UPDATE_GOAL":
        case "SWAP_MEAL":
            // Map to UNKNOWN with original intent preserved
            return {
                type: "UNKNOWN",
                params: {
                    originalIntent: llmIntent.intent,
                    ...llmIntent.params,
                },
                confidence: llmIntent.confidence,
            };

        case "UNKNOWN":
        default:
            return {
                type: "UNKNOWN",
                params: llmIntent.params,
                confidence: llmIntent.confidence,
            };
    }
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

    // [TEST LOG] Execution start
    console.log("⚙️ [EXECUTION] Executing intent:", intent.type, "with confidence:", intent.confidence);
    console.log("⚙️ [EXECUTION] Intent params:", JSON.stringify(intent.params, null, 2));

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
                // Handle new intents that don't have execution handlers yet
                const originalIntent = intent.params.originalIntent;
                if (originalIntent === "REGENERATE_TODAY_WORKOUT") {
                    return {
                        success: false,
                        message: "Regenerating today's workout is not yet available. You can modify your workout instead.",
                        dataChanges: [],
                    };
                }
                if (originalIntent === "GENERATE_PLAN") {
                    return {
                        success: false,
                        message: "You can generate a new plan from the Generate Program page.",
                        dataChanges: [],
                    };
                }
                if (originalIntent === "UPDATE_GOAL") {
                    return {
                        success: false,
                        message: "You can update your goals from your profile page.",
                        dataChanges: [],
                    };
                }
                if (originalIntent === "SWAP_MEAL") {
                    return {
                        success: false,
                        message: "You can swap meals from the Meals page.",
                        dataChanges: [],
                    };
                }
                if (originalIntent === "VIEW_PROGRESS") {
                    return {
                        success: false,
                        message: "You can view your progress on the Progress page.",
                        dataChanges: [],
                    };
                }
                if (originalIntent === "REQUEST_EXPLANATION") {
                    return {
                        success: false,
                        message: "I'm here to help! What would you like to know more about?",
                        dataChanges: [],
                    };
                }
                if (originalIntent === "SMALL_TALK") {
                    return {
                        success: true,
                        message: "Hi! I'm your fitness coach. How can I help you today?",
                        dataChanges: [],
                    };
                }
                if (originalIntent === "CLARIFY") {
                    return {
                        success: false,
                        message: "Can you clarify what you'd like to do?",
                        dataChanges: [],
                    };
                }
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

        // Parse intent using LLM
        const intent = await parseIntent(args.message, {
            date: args.date,
            activePlanId: activePlan?._id,
        });

        // [TEST LOG] Confidence check
        console.log("🛡️ [CONFIDENCE GATING] Intent confidence:", intent.confidence, "Threshold: 0.7");

        // Confidence gating: if confidence is too low, return clarifying question
        if (intent.confidence < 0.7) {
            console.log("🛡️ [CONFIDENCE GATING] ❌ BLOCKED - Confidence too low, returning clarifying question");
            return {
                success: false,
                message: "Can you clarify what you'd like to change?",
                dataChanges: [],
            };
        }

        console.log("🛡️ [CONFIDENCE GATING] ✅ PASSED - Proceeding with execution");

        // Execute intent
        const response = await executeIntent(ctx, intent, context);

        // [TEST LOG] Execution result
        console.log("✅ [EXECUTION RESULT] Success:", response.success, "Message:", response.message);
        console.log("✅ [EXECUTION RESULT] Data changes:", JSON.stringify(response.dataChanges, null, 2));

        return response;
    },
});
