import { QueryCtx } from "../../../convex/_generated/server";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Minimal exercise data for RAG context
 */
export interface ExerciseContext {
    _id: Id<"exercises">;
    name: string;
    bodyPart: string;
    equipment?: string;
    isCompound: boolean;
}

/**
 * Fetch relevant exercises from Convex with minimal fields only.
 * 
 * @param ctx - Convex query context
 * @param filters - Optional filters for exercise name or body part
 * @returns Array of exercises with minimal fields (name, bodyPart, equipment, isCompound)
 */
export async function getExerciseContext(
    ctx: QueryCtx,
    filters?: {
        exerciseName?: string;
        bodyPart?: string;
    }
): Promise<ExerciseContext[]> {
    let exercises = await ctx.db.query("exercises").collect();

    // Apply filters if provided
    if (filters?.exerciseName) {
        const nameLower = filters.exerciseName.toLowerCase();
        exercises = exercises.filter((e) =>
            e.name.toLowerCase().includes(nameLower)
        );
    }

    if (filters?.bodyPart) {
        const bodyPartLower = filters.bodyPart.toLowerCase();
        exercises = exercises.filter(
            (e) => e.bodyPart.toLowerCase() === bodyPartLower
        );
    }

    // Return only minimal fields
    return exercises.map((exercise) => ({
        _id: exercise._id,
        name: exercise.name,
        bodyPart: exercise.bodyPart,
        equipment: exercise.equipment,
        isCompound: exercise.isCompound,
    }));
}
