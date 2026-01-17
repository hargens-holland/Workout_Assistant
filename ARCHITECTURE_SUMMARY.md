# Workout Assistant - Architecture Summary

## Product Overview

Constraint-driven fitness app that generates personalized daily workouts and meal plans using:
- **Pure code** for all rules, math, and progression calculations
- **AI (Google Gemini)** only for exercise/meal selection and JSON formatting
- **Goal-driven** architecture (no pre-defined plans)
- **Validation layer** that enforces constraints before persistence

## Core Data Model

### Main Tables (`convex/schema.ts`)

**User Management:**
- `users` - Profiles (height, weight, experience, injuries, preferences, clerkId)
- `goals` - Fitness goals (category, target, direction, value, unit, isActive) - **one active per user**

**Workout System:**
- `workout_sessions` - Daily sessions (userId, date, intensity, workoutExplanation, mealExplanation) - **no planId**
- `exercise_sets` - Sets within sessions (sessionId, exerciseId, plannedWeight, plannedReps, actualWeight, actualReps, completed, setNumber)
- `exercises` - Exercise database (name, bodyPart, isCompound, equipment)

**Nutrition System:**
- `meals` - Meal database (name, foods, calories, instructions, mealType)
- `daily_meals` - Daily meal assignments (sessionId, mealId, mealType, order)
- `meal_logs` - User meal logging (userId, date, name, calories, protein)

**User Preferences:**
- `blocked_items` - User-blocked exercises/meals (userId, itemType, itemId, itemName)

**Tracking:**
- `daily_tracking` - Water, steps, weight, distance (userId, date)
- `challenges` - Pushup/pullup challenges (userId, challengeType, targetReps, currentReps)

**Legacy (unused):**
- `plans` - Deprecated plan-based system (kept for backward compatibility)

## Generation Pipeline

### Flow: Inputs → Computation → AI → Validation → Storage

```
1. INPUTS (plans.ts::generateDailyWorkoutAndMeals)
   ├─ Active goal (required, from goals table)
   ├─ User profile (height, weight, experience from users table)
   └─ Recent workouts (last 14 days, only past dates)

2. CONSTRAINT COMPUTATION (constraints.ts - pure code, no AI)
   ├─ computeWorkoutIntent() → bodyParts, intensity, sets, repRanges
   ├─ computeProgressionTargets() → exact weights/reps from history
   └─ computeNutritionIntent() → calorieTarget, proteinMin, carbBias

3. AI GENERATION (constrainedGeneration.ts)
   ├─ generateDailyWorkout() → selects exercises, uses EXACT weights from progression
   └─ generateDailyMeals() → selects meals, matches EXACT calorie targets

4. VALIDATION (validation.ts)
   ├─ validateWorkoutBlueprint() → checks weights, sets, reps, exercise count
   └─ validateMealPlan() → checks calories (±50 kcal), protein minimum, meal count

5. PERSISTENCE (plans.ts)
   ├─ createWorkoutSession() → creates session (no planId)
   ├─ createExerciseSet() → creates sets for each exercise
   └─ createDailyMeal() → creates meal assignments
```

## File Responsibilities

### Constraint Computation
- **`convex/constraints.ts`** - Pure code functions (no AI, no side effects)
  - `computeWorkoutIntent()` - Body parts, intensity, sets, rep ranges
  - `computeProgressionTargets()` - Weight/rep progression from history
  - `computeNutritionIntent()` - Calorie targets, protein minimums, carb bias

### AI Generation
- **`convex/constrainedGeneration.ts`** - AI functions constrained by computed values
  - `generateDailyWorkout()` - Selects exercises, uses exact weights from progression
  - `generateDailyMeals()` - Selects meals, matches exact calorie targets
  - `generateWorkoutExplanation()` - Generates workout rationale
  - `generateMealExplanation()` - Generates meal rationale
- **`convex/llm.ts`** - Google Gemini wrapper (`generateText()`)

### Validation
- **`convex/validation.ts`** - Validates AI outputs against constraints
  - `validateWorkoutBlueprint()` - Validates weights, sets, reps, exercise count
  - `validateMealPlan()` - Validates calories (±50 kcal), protein minimum
  - `checkBlockedItems()` - Checks for blocked exercises/meals

### Persistence
- **`convex/plans.ts::generateDailyWorkoutAndMeals()`** - Main orchestration
  - Creates `workout_sessions` (no planId)
  - Creates `exercise_sets` from blueprint
  - Creates `daily_meals` from meal plan
- **`convex/goals.ts`** - Goal CRUD (createGoal, getActiveGoal, setActiveGoal, updateGoal, deleteGoal)
- **`convex/users.ts`** - User CRUD (syncUser, updateProfile)

### Chat / User Edits
- **`convex/chat.ts`** - Intent-based chat system
  - `parseIntent()` - LLM-based intent classification
  - `executeIntent()` - Executes workout/meal modifications
  - Supported intents: WORKOUT_SWAP_EXERCISE, WORKOUT_MAKE_EASIER, MEAL_LOG_QUICK, BLOCK_ITEM
- **`convex/workoutEditing.ts`** - Workout modification functions
  - `reduceWorkoutVolume()` - Removes sets or exercises
  - `addAccessoryExercise()` - Adds exercise to today's workout
  - `moveWorkoutSession()` - Moves session to different date

## Entity Relationships

### Goals → Workouts → Meals → Users

**Goals:**
- One active goal per user (enforced by `goals.ts::createGoal()` - deactivates others)
- Goals drive workout intent (category → intensity, sets, rep ranges)
- Goals drive nutrition intent (category + direction → calorie target, protein minimum)

**Workouts:**
- Generated from active goal (no plan dependency)
- `workout_sessions` linked to `users` via userId (no planId)
- `exercise_sets` linked to `workout_sessions` via sessionId
- `exercise_sets` linked to `exercises` via exerciseId
- Progression computed from completed sets (weights, reps)

**Meals:**
- Generated from active goal + user profile (weight, height, experience)
- `daily_meals` linked to `workout_sessions` via sessionId (same day)
- `daily_meals` linked to `meals` via mealId
- Calorie targets computed from goal category + user profile

**Users:**
- Profile data (height, weight, experience) used for nutrition calculations
- Preferences (split preference, equipment) stored in `users.preferences`
- Blocked items stored in `blocked_items` table (filtered during generation)

## Invariants Enforced by Code

### Generation Invariants
1. **Only today's workout can be generated** (`plans.ts:2955-2957`)
   - Date must equal today (throws error if not)
2. **One workout per day** (`plans.ts:2965-2967`)
   - Checks for existing session before generation (throws error if exists)
3. **Active goal required** (`plans.ts:2974-2976`)
   - Throws error if no active goal found
4. **Recent workouts only from past** (`plans.ts:2984-2991`)
   - Queries only workouts before today (excludes today)

### Validation Invariants
1. **Workout validation** (`validation.ts::validateWorkoutBlueprint()`)
   - Exercise count must match intent (2-3 compound + 2-3 accessory)
   - Weights must match progression targets exactly (±0.1kg tolerance)
   - Reps must match progression targets exactly
   - All exercises must be in allowed list
   - Reps must be within rep ranges (warnings if outside)
2. **Meal validation** (`validation.ts::validateMealPlan()`)
   - Total calories must be within ±50 kcal of target (error) or ±25 kcal (warning)
   - Total protein must meet minimum (error if below)
   - All meals must be in allowed list
   - Meal calories must match database values exactly
3. **Retry logic** (`plans.ts:3028-3060`, `3089-3120`)
   - Up to 3 attempts for workout generation
   - Up to 3 attempts for meal generation
   - Throws error if all attempts fail

### Goal Invariants
1. **One active goal per user** (`goals.ts:77-87`)
   - `createGoal()` deactivates all other goals
   - `setActiveGoal()` deactivates all other goals
2. **Goal ownership** (`goals.ts:118-120`, `181-183`, `214-216`)
   - All goal mutations verify userId matches goal.userId

### User Edit Invariants
1. **Today-only edits** (`chat.ts:661-672`)
   - Chat commands only work for today's date (returns error for past dates)
2. **Confidence gating** (`chat.ts:688-695`)
   - Intent confidence must be ≥ 0.7 to execute (returns clarifying question if lower)
3. **Workout existence** (`workoutEditing.ts:135-137`)
   - `addAccessoryExercise()` requires today's workout to exist

### Data Integrity
1. **Exercise set structure** (`constrainedGeneration.ts:162-191`)
   - Validates exercise structure, set count, weight/reps match progression
2. **Meal structure** (`constrainedGeneration.ts:312-344`)
   - Validates meal structure, calories match database, totals meet targets

## Behavior Explicitly Prevented

### Generation Restrictions
1. **Past date generation** - Cannot generate workouts for past dates (`plans.ts:2955-2957`)
2. **Future date generation** - Cannot generate workouts for future dates (`plans.ts:2955-2957`)
3. **Duplicate generation** - Cannot generate if workout already exists for today (`plans.ts:2965-2967`)
4. **Generation without goal** - Cannot generate without active goal (`plans.ts:2974-2976`)

### AI Constraints
1. **AI cannot invent weights** - Must use exact weights from progression targets (`constrainedGeneration.ts:132-134`)
2. **AI cannot invent calories** - Must use exact calories from meal database (`constrainedGeneration.ts:286`)
3. **AI cannot add exercises** - Must select only from allowed list (`constrainedGeneration.ts:136`)
4. **AI cannot change set counts** - Must use exact set counts from intent (`constrainedGeneration.ts:135`)

### Edit Restrictions
1. **Past workout immutability** - Chat commands only work for today (`chat.ts:661-672`)
2. **Low confidence blocking** - Intent execution blocked if confidence < 0.7 (`chat.ts:688-695`)
3. **Regeneration disabled** - REGENERATE_TODAY_WORKOUT intent returns error (`chat.ts:578-583`)

### Data Constraints
1. **Blocked items filtered** - Blocked exercises/meals excluded from generation (`plans.ts:3019-3021`, `3080-3082`)
2. **Exercise validation** - Exercises must exist in database (`constrainedGeneration.ts:173-180`)
3. **Meal validation** - Meals must exist in database (`constrainedGeneration.ts:331-333`)

### Legacy System Prevention
1. **Plan dependency removed** - Workout sessions created without planId (`plans.ts:3141`)
2. **Plan generation unused** - Plan CRUD functions exist but unused (deprecated)
3. **Goal-only system** - All generation uses goals, not plans

## Key Architectural Decisions

1. **Separation of concerns**: Constraints computed by pure code, AI only selects/formats
2. **Validation before persistence**: All AI outputs validated before database writes
3. **Retry with validation**: Up to 3 attempts with validation between each
4. **Today-only generation**: Prevents past/future date issues
5. **Goal-driven**: No pre-defined plans, workouts generated on-demand from goals
6. **Immutable past**: Past workouts cannot be edited (only today)
7. **Confidence gating**: Low-confidence intents blocked to prevent errors
8. **Blocked items**: User preferences enforced at generation time
