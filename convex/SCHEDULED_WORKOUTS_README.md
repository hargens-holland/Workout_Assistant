# Scheduled Workout Generation

This module automatically generates daily workouts for all users with active goals at a specified time each day.

## Overview

The `scheduledWorkouts.ts` file contains:
1. **`packageAIExplanationContext`**: Packages all relevant user data for AI explanations
2. **`generateDailyWorkoutsForAllUsers`**: Scheduled action that runs daily to generate workouts

## Setup

### 1. Configure the Scheduled Function

In Convex, scheduled functions are configured via the Convex dashboard or CLI. To set up the daily workout generation:

**Option A: Using Convex Dashboard**
1. Go to your Convex dashboard
2. Navigate to "Scheduled Functions" or "Cron Jobs"
3. Add a new scheduled function:
   - **Function**: `scheduledWorkouts:generateDailyWorkoutsForAllUsers`
   - **Schedule**: `0 5 * * *` (runs daily at 5:00 AM UTC = 12:00 AM Eastern)
   - **Description**: "Generates daily workouts for all users with active goals"

**Option B: Using Convex CLI**
```bash
npx convex schedule add "0 5 * * *" scheduledWorkouts:generateDailyWorkoutsForAllUsers
```

### 2. Cron Schedule Format

The cron format is: `minute hour day-of-month month day-of-week`

Examples:
- `0 5 * * *` - Every day at 5:00 AM UTC (12:00 AM EST / 1:00 AM EDT)
- `0 6 * * *` - Every day at 6:00 AM UTC
- `0 0 * * *` - Every day at midnight UTC
- `0 8 * * 1-5` - Weekdays (Monday-Friday) at 8:00 AM UTC
- `0 12 * * 0` - Every Sunday at noon UTC

### 3. How It Works

The scheduled function:
1. Gets all users from the database
2. For each user:
   - Checks if they have an active goal
   - Checks if a workout already exists for today
   - Checks if today is a workout day (based on their schedule)
   - Generates workout and meals if conditions are met
3. Logs results (success, skipped, errors)

## AI Explanation Context

The `packageAIExplanationContext` function collects comprehensive data for AI explanations:

- **User Info**: Name, goal type, goal description
- **Split Info**: Split type, current split day name, workout schedule
- **Injuries**: User's injury constraints
- **Progress**: Recent exercise performance (weights, reps, dates)
- **Equipment**: Available equipment
- **Workout Intent**: Intensity, body parts, sets, reps
- **Nutrition Intent**: Calorie targets, protein minimums

This context is automatically passed to the explanation generation functions to create detailed, personalized workout and meal explanations.

## Integration

The scheduled function calls `generateDailyWorkoutAndMeals` from `plans.ts`, which:
- Uses template-based workout generation (or AI fallback)
- Generates meals based on nutrition intent
- Creates workout sessions and exercise sets
- Generates AI explanations with the packaged context

## Monitoring

The function logs:
- Start time and date
- Per-user status (generated, skipped, error)
- Final summary with counts

Check Convex logs to monitor the scheduled function execution.

## Testing

To test the scheduled function manually:

```typescript
// In Convex dashboard or via CLI
await ctx.runAction(api.scheduledWorkouts.generateDailyWorkoutsForAllUsers, {});
```

Or trigger it via the Convex dashboard's "Run Now" feature for scheduled functions.
