/**
 * TypeScript types for long-term plans
 * 
 * Defines the structure of AI-generated long-term training plans
 */

// TODO: Define LongTermPlan interface
//   - goalId: Id<"goals">
//   - durationWeeks: number
//   - workoutsPerWeek: number
//   - splitType: "PPL" | "UPPER_LOWER" | "FULL_BODY" | ...
//   - progressionStrategy: "linear" | "double_progression" | "wave" | ...
//   - weeklyStructure: Array of weekly plan objects
//     - weekNumber: number
//     - workouts: Array of workout objects
//       - dayOfWeek: number (0-6)
//       - focus: string ("Push", "Pull", "Legs", etc.)
//       - bodyParts: string[]
//       - intensity: "heavy" | "moderate" | "light"
//     - deloadWeek?: boolean
