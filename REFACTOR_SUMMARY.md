# Workout Assistant Refactor Summary

## Overview
Refactored the app to match new product navigation: Home | Workouts | Meals | Calendar | Chat | Profile

## Files Changed/Added

### Frontend Pages
1. **src/app/home/page.tsx** (NEW)
   - Daily execution page showing today's workout and nutrition
   - Quick complete set functionality
   - Meal logging
   - Weekly stats and insights

2. **src/app/workouts/page.tsx** (NEW)
   - Workout overview with current focus
   - Upcoming workouts (next 7 days)
   - Workout history (last 14 days)
   - Session detail view with edit capabilities

3. **src/app/meals/page.tsx** (NEW)
   - Nutrition overview with daily targets
   - Today's meals (planned + logged)
   - Suggested meals with assign functionality
   - Weekly calorie trend chart

4. **src/app/chat/page.tsx** (NEW)
   - Chat interface with intent router
   - Supports all MVP intents
   - Shows data changes made

5. **src/app/calendar/page.tsx** (UPDATED)
   - Added reschedule support (move workout to different date)
   - Added Move button with date picker

6. **src/app/profile/page.tsx** (UPDATED)
   - Refactored to "rules page"
   - Shows user stats, goal, injuries, equipment, diet prefs
   - Active plan selection
   - Split change functionality

7. **src/app/page.tsx** (UPDATED)
   - Redirects signed-in users to /home
   - Marketing page for non-signed-in users

### Components
8. **src/components/Navbar.tsx** (UPDATED)
   - New navigation: Home | Workouts | Meals | Calendar | Chat | Profile
   - Active route highlighting

### Backend (Convex)
9. **convex/schema.ts** (UPDATED)
   - Added `meal_logs` table with indexes:
     - by_user_id
     - by_date
     - by_user_and_date

10. **convex/mealLogs.ts** (NEW)
    - `getMealLogsByDate` - query
    - `getMealLogsByDateRange` - query
    - `createMealLog` - mutation
    - `updateMealLog` - mutation
    - `deleteMealLog` - mutation

11. **convex/workoutEditing.ts** (NEW)
    - `getTodayWorkout` - query
    - `reduceWorkoutVolume` - mutation (remove set or exercise)
    - `addAccessoryExercise` - action
    - `moveWorkoutSession` - mutation
    - `getWorkoutSessionById` - query
    - `getUpcomingWorkouts` - query
    - `getWorkoutHistory` - query

12. **convex/chat.ts** (NEW)
    - Intent types and parser (deterministic)
    - `chatCommand` action with all MVP intents:
      - WORKOUT_SWAP_EXERCISE
      - WORKOUT_MAKE_EASIER
      - WORKOUT_ADD_FOCUS
      - MEAL_SUGGEST
      - MEAL_LOG_QUICK
      - SCHEDULE_MOVE_WORKOUT
      - BLOCK_ITEM

### Configuration
13. **src/middleware.ts** (UPDATED)
    - Added protected routes: /home, /workouts, /meals, /calendar, /chat

## Schema Changes

### New Table: meal_logs
```typescript
meal_logs: {
  userId: Id<"users">
  date: string (YYYY-MM-DD)
  name: string
  calories: number
  protein?: number (grams)
  mealType?: string ("breakfast" | "lunch" | "dinner" | "snack")
}
```

**Indexes:**
- `by_user_id` - for user queries
- `by_date` - for date queries
- `by_user_and_date` - for user+date queries

## Chat Intent System

### Supported Intents
1. **WORKOUT_SWAP_EXERCISE**
   - Example: "Swap squats for something knee-friendly"
   - Replaces exercise in today's workout

2. **WORKOUT_MAKE_EASIER**
   - Example: "Make today easier" / "Make it shorter"
   - Reduces volume (remove set or exercise)

3. **WORKOUT_ADD_FOCUS**
   - Example: "Add more arms this week"
   - Adds accessory exercise to upcoming sessions

4. **MEAL_SUGGEST**
   - Example: "What should I eat tonight?" / "high protein snacks"
   - Returns meal suggestions

5. **MEAL_LOG_QUICK**
   - Example: "Log chicken salad 450 calories 40 protein"
   - Creates meal log entry

6. **SCHEDULE_MOVE_WORKOUT**
   - Example: "Move Friday workout to Saturday"
   - Moves workout session to new date

7. **BLOCK_ITEM**
   - Example: "Never show burpees again"
   - Blocks exercise or meal

## Key Features

### Home Page (/home)
- Today's workout with quick complete
- Today's nutrition (target vs actual)
- Quick meal logging
- Weekly stats (workouts completed, protein warning)

### Workouts Page (/workouts)
- Current focus from training strategy
- Upcoming workouts (next 7 days)
- History with completion stats
- Session detail with edit capabilities

### Meals Page (/meals)
- Daily calorie and protein targets
- Today's planned and logged meals
- Suggested meals with assign buttons
- Weekly calorie trend

### Chat Page (/chat)
- Natural language command interface
- Intent router with deterministic parsing
- Executes mutations/actions
- Shows data changes made

### Calendar Page (/calendar)
- Existing month view
- Reschedule support (move workout to date)
- Combined workout + meals view

### Profile Page (/profile)
- Rules and preferences display
- Active plan selection
- Split change functionality
- Plan management

## Migration Notes

1. **meal_logs table**: New table, no migration needed (empty on first deploy)

2. **Existing functions**: All existing Convex functions preserved, new functions added

3. **Routes**: 
   - Old `/` now redirects signed-in users to `/home`
   - `/generate-program` and `/admin/*` routes preserved
   - New routes: `/home`, `/workouts`, `/meals`, `/chat`

## Testing Checklist

- [ ] Navigation works for all routes
- [ ] Home page shows today's workout and nutrition
- [ ] Workouts page displays upcoming and history
- [ ] Meals page shows targets and logs
- [ ] Chat intents execute correctly
- [ ] Calendar reschedule works
- [ ] Profile shows rules and plan selection
- [ ] Meal logs CRUD operations work
- [ ] Workout editing (reduce volume, add exercises) works
- [ ] All protected routes require auth

## Next Steps (Future Enhancements)

1. Add user profile fields for injuries, equipment, diet prefs (currently using plan data)
2. Enhance chat with Gemini fallback for complex queries
3. Add drag-and-drop for calendar reschedule
4. Add more detailed nutrition tracking (macros breakdown)
5. Add workout completion analytics
6. Add meal photo logging
7. Add social features (share workouts, meals)
