import { QueryCtx } from "../../../convex/_generated/server";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Minimal meal data for RAG context
 */
export interface MealContext {
    _id: Id<"meals">;
    name: string;
    calories: number;
    mealType?: string[];
}

/**
 * Fetch relevant meals from Convex with minimal fields only.
 * 
 * @param ctx - Convex query context
 * @param filters - Optional filters for mealType or calorie range
 * @returns Array of meals with minimal fields (name, calories, mealType)
 */
export async function getMealContext(
    ctx: QueryCtx,
    filters?: {
        mealType?: string;
        minCalories?: number;
        maxCalories?: number;
    }
): Promise<MealContext[]> {
    let meals = await ctx.db.query("meals").collect();

    // Apply filters if provided
    if (filters?.mealType) {
        const mealTypeLower = filters.mealType.toLowerCase();
        meals = meals.filter((meal) => {
            if (!meal.mealType || meal.mealType.length === 0) {
                return false;
            }
            return meal.mealType.some((type) =>
                type.toLowerCase() === mealTypeLower
            );
        });
    }

    if (filters?.minCalories !== undefined) {
        meals = meals.filter((meal) => meal.calories >= filters.minCalories!);
    }

    if (filters?.maxCalories !== undefined) {
        meals = meals.filter((meal) => meal.calories <= filters.maxCalories!);
    }

    // Return only minimal fields
    return meals.map((meal) => ({
        _id: meal._id,
        name: meal.name,
        calories: meal.calories,
        mealType: meal.mealType,
    }));
}
