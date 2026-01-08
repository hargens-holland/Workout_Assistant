import { UserProfile } from "./page";

/**
 * Formats user profile data into a workout plan prompt for LLM
 */
export function formatWorkoutPrompt(profile: UserProfile): string {
    const {
        age = "Not specified",
        height = "Not specified",
        weight = "Not specified",
        goal = "Not specified",
        experience = "Not specified",
        daysPerWeek = "Not specified",
        minutesPerSession = "Not specified",
        equipment = "Not specified",
    } = profile;

    return `You are an experienced fitness coach creating a personalized workout plan based on:
Age: ${age}
Height: ${height} cm
Weight: ${weight} kg
Available days for workout: ${daysPerWeek} days per week
Minutes per workout: ${minutesPerSession} minutes
Fitness goal: ${goal}
Fitness level: ${experience}
Available equipment: ${equipment}

As a professional coach:
- Consider muscle group splits to avoid overtraining the same muscles on consecutive days
- Design exercises that match the fitness level and account for available equipment
- Structure the workouts to specifically target the user's fitness goal
- Ensure workouts fit within the specified time per session

CRITICAL SCHEMA INSTRUCTIONS:
- Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
- "sets" and "reps" MUST ALWAYS be NUMBERS, never strings
- For example: "sets": 3, "reps": 10
- Do NOT use text like "reps": "As many as possible" or "reps": "To failure"
- Instead use specific numbers like "reps": 12 or "reps": 15
- For cardio, use "sets": 1, "reps": 1 or another appropriate number
- NEVER include strings for numerical fields
- NEVER add extra fields not shown in the example below

Return a JSON object with this EXACT structure:
{
  "schedule": ["Monday", "Wednesday", "Friday"],
  "exercises": [
    {
      "day": "Monday",
      "routines": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 10
        }
      ]
    }
  ]
}

DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;
}

/**
 * Formats user profile data into a meal plan prompt for LLM
 */
export function formatMealPlanPrompt(profile: UserProfile): string {
    const {
        age = "Not specified",
        height = "Not specified",
        weight = "Not specified",
        goal = "Not specified",
        diet = "None",
    } = profile;

    return `You are an experienced nutrition coach creating a personalized diet plan based on:
Age: ${age}
Height: ${height} cm
Weight: ${weight} kg
Fitness goal: ${goal}
Dietary restrictions: ${diet}

As a professional nutrition coach:
- Calculate appropriate daily calorie intake based on the person's stats and goals
- Create a balanced meal plan with proper macronutrient distribution
- Include a variety of nutrient-dense foods while respecting dietary restrictions
- Consider meal timing around workouts for optimal performance and recovery

CRITICAL SCHEMA INSTRUCTIONS:
- Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
- "dailyCalories" MUST be a NUMBER, not a string
- DO NOT add fields like "supplements", "macros", "notes", or ANYTHING else
- ONLY include the EXACT fields shown in the example below
- Each meal should include ONLY a "name" and "foods" array

Return a JSON object with this EXACT structure and no other fields:
{
  "dailyCalories": 2000,
  "meals": [
    {
      "name": "Breakfast",
      "foods": ["Oatmeal with berries", "Greek yogurt", "Black coffee"]
    },
    {
      "name": "Lunch",
      "foods": ["Grilled chicken salad", "Whole grain bread", "Water"]
    }
  ]
}

DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;
}

/**
 * Formats both prompts and returns them in an object
 */
export function formatAllPrompts(profile: UserProfile) {
    return {
        workoutPrompt: formatWorkoutPrompt(profile),
        mealPlanPrompt: formatMealPlanPrompt(profile),
    };
}
