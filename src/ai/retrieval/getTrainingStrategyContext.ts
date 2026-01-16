import { QueryCtx } from "../../../convex/_generated/server";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Minimal training strategy data for RAG context
 */
export interface TrainingStrategyContext {
    goal: string;
    split?: string;
    intensityDistribution: {
        heavy: number;
        moderate: number;
        light: number;
    };
    focus: string;
}

/**
 * Fetch the user's active plan training strategy with minimal fields only.
 * 
 * @param ctx - Convex query context
 * @param userId - User ID to fetch active plan for
 * @returns Training strategy with minimal fields (goal, split, intensityDistribution, focus) or null if no active plan
 */
export async function getTrainingStrategyContext(
    ctx: QueryCtx,
    userId: Id<"users">
): Promise<TrainingStrategyContext | null> {
    // Get active plan for user
    const activePlan = await ctx.db
        .query("plans")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

    if (!activePlan) {
        return null;
    }

    // Prefer trainingStrategy, fall back to executionConfig
    const strategy = activePlan.trainingStrategy;
    const executionConfig = activePlan.executionConfig;

    // Get split from trainingStrategy or executionConfig
    const split =
        strategy?.split_type || executionConfig?.split_type || undefined;

    // Get intensity distribution from trainingStrategy or executionConfig
    const intensityDistribution =
        strategy?.intensity_distribution ||
        executionConfig?.intensity_distribution ||
        { heavy: 0, moderate: 0, light: 0 };

    // Get goal and focus from trainingStrategy
    const goal = strategy?.goal_type || "";
    const focus = strategy?.primary_focus || "";

    return {
        goal,
        split,
        intensityDistribution: {
            heavy: intensityDistribution.heavy,
            moderate: intensityDistribution.moderate,
            light: intensityDistribution.light,
        },
        focus,
    };
}
