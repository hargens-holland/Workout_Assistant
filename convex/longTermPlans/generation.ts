import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { generateText } from "../llm";

/**
 * Long-term plan generation using AI
 * 
 * AI generates high-level plan structure based on:
 * - Raw goal message (from chat)
 * - Weight/height (from profile)
 * - Experience level
 * - Equipment access (equipment vs no equipment)
 * 
 * Output: LongTermPlan structure (duration, split, frequency, weekly structure, 
 *         body parts per day, progression strategy, deload weeks)
 * Also extracts goal structure from the message
 */
export const generateLongTermPlan = action({
    args: {
        userId: v.id("users"),
        goalMessage: v.string(),
        userProfile: v.object({
            weight_kg: v.optional(v.number()),
            height_cm: v.optional(v.number()),
            experience_level: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
            equipment_access: v.optional(v.any()),
        }),
    },
    handler: async (ctx, args) => {
        // Determine equipment status
        const hasEquipment = args.userProfile.equipment_access !== null &&
            args.userProfile.equipment_access !== undefined &&
            (typeof args.userProfile.equipment_access === 'object' ?
                Object.keys(args.userProfile.equipment_access).length > 0 :
                Boolean(args.userProfile.equipment_access));
        const equipmentStatus = hasEquipment ? "Has equipment (gym/home gym)" : "No equipment (bodyweight only)";

        // Build the prompt with raw message + profile
        const prompt = `You are an experienced strength and conditioning coach.

Your task is to create a LONG-TERM, PHASE-BASED training plan
and explain the coaching logic behind it in clear, professional language.

This plan will be shown directly to the user inside their dashboard.

User goal:
"${args.goalMessage}"

User profile:
- Weight: ${args.userProfile.weight_kg || "unknown"} kg
- Height: ${args.userProfile.height_cm || "unknown"} cm
- Experience level: ${args.userProfile.experience_level || "unknown"}
- Equipment availability: ${equipmentStatus}

IMPORTANT RULES:
- Do NOT list exercises
- Do NOT list sets, reps, weights, percentages, or RPE
- Do NOT describe individual workouts
- Think like a real coach planning adaptations over months
- Use clear, structured natural language
- Write explanations that help the user understand *why* the plan works

Return JSON ONLY with the following structure:

{
  "goal": {
    "name": string,
    "category": "fat_loss" | "strength" | "hypertrophy" | "endurance" | "mobility",
    "summary": string,
    "reasoning": string
  },
  "programOverview": {
    "durationWeeks": number,
    "highLevelStrategy": string
  },
  "phases": [
    {
      "name": string,
      "weeks": string,
      "goal": string,
      "description": string
    }
  ],
  "trainingPrinciples": {
    "volumeVsIntensity": string,
    "recoveryAndFatigue": string,
    "stallAdaptation": string
  }
}

Tone:
- Professional
- Coach-like
- Educational but concise
`;

        try {
            const llmResponse = await generateText({
                messages: [
                    { role: "system", content: prompt },
                ],
                modelRole: "intent",
            });

            // Parse JSON from response
            let jsonText = llmResponse.trim();
            jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

            const parsed = JSON.parse(jsonText);

            // Validate structure
            if (!parsed.goal || !parsed.programOverview || !parsed.phases || !parsed.trainingPrinciples) {
                throw new Error("Invalid response structure from AI");
            }

            // Return the plan and goal structure
            // The plan will be stored after the goal is created (in createGoalFromChat)
            return {
                goal: parsed.goal,
                programOverview: parsed.programOverview,
                phases: parsed.phases,
                trainingPrinciples: parsed.trainingPrinciples,
            };
        } catch (error) {
            console.error("[generateLongTermPlan] Error:", error);
            throw new Error(`Failed to generate long-term plan: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    },
});
