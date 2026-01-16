# Workout Assistant - Architecture Documentation

## Overview

This is a constraint-driven, goal-aware fitness app that uses code to compute all rules, math, and progression, while AI only selects exercises/meals and formats output. The system is designed to be deterministic, explainable, and safe.

## Core Principles

1. **Code decides rules, math, progression** - All constraints are computed by pure code functions
2. **AI only selects and formats** - AI selects exercises/meals from allowed lists and formats JSON
3. **All outputs validated** - Every AI output is validated against constraints before storage
4. **Goal-driven** - The system is driven by user goals, not pre-defined plans

## Current Architecture: Plan-Based System

**Note:** The system currently uses a **plan-based** architecture where workouts are tied to plans. The goal is to migrate to a **goal-only** system where workouts are generated directly from goals.

### Current Data Flow

```
User Onboarding
  ↓
Create Goal + User Profile
  ↓
Generate Plan (with trainingStrategy)
  ↓
Generate Workouts from Strategy (month-long)
  ↓
Daily Workout Generation (constraint-driven)
  ↓
Workout Sessions + Exercise Sets
```

### Target Architecture: Goal-Only System

```
User Onboarding
  ↓
Create Goal + User Profile
  ↓
Daily Workout Generation (constraint-driven, goal-driven)
  ↓
Workout Sessions + Exercise Sets
```

---

## File Structure & Responsibilities

### Backend Files (`convex/`)

#### Core System Files

**`schema.ts`**
- **Purpose:** Defines all database tables and their schemas
- **Key Tables:**
  - `users` - User profiles (height, weight, experience, injuries, preferences)
  - `goals` - User fitness goals (category, target, direction, value, unit, isActive)
  - `plans` - Training plans (workoutPlan, dietPlan, trainingStrategy, executionConfig) - **TO BE REMOVED**
  - `exercises` - Exercise database (name, bodyPart, isCompound, equipment)
  - `meals` - Meal database (name, foods, calories, instructions, mealType)
  - `workout_sessions` - Daily workout sessions (userId, planId, date, intensity) - **planId TO BE REMOVED**
  - `exercise_sets` - Individual exercise sets (sessionId, exerciseId, plannedWeight, plannedReps, actualWeight, actualReps)
  - `daily_meals` - Daily meal assignments (sessionId, mealId, mealType)
  - `blocked_items` - User-blocked exercises/meals
  - `meal_logs` - User meal logging
  - `daily_tracking` - Water intake and steps
  - `challenges` - Pushup/pullup challenges

**`constraints.ts`** ⭐ **CORE FILE**
- **Purpose:** Pure code functions that compute workout and nutrition constraints (NO AI)
- **Key Functions:**
  - `computeWorkoutIntent()` - Determines body parts, intensity, sets, rep ranges based on goal + recent workouts
  - `computeProgressionTargets()` - Calculates exact weights/reps from workout history
  - `computeNutritionIntent()` - Computes calorie targets, protein minimums, carb bias
- **Dependencies:** None (pure functions)
- **Used By:** `constrainedGeneration.ts`, `plans.ts`

**`constrainedGeneration.ts`** ⭐ **CORE FILE**
- **Purpose:** AI functions that generate workouts/meals, strictly constrained by computed values
- **Key Functions:**
  - `generateDailyWorkout()` - AI selects exercises, uses EXACT weights from progression targets
  - `generateDailyMeals()` - AI selects meals, matches EXACT calorie targets
- **Dependencies:** `constraints.ts`, `llm.ts`, retrieval functions
- **Used By:** `plans.ts` (via `generateDailyWorkoutAndMeals`)

**`validation.ts`**
- **Purpose:** Validates AI outputs against constraints
- **Key Functions:**
  - `validateWorkoutBlueprint()` - Ensures weights/sets match constraints
  - `validateMealPlan()` - Ensures calories/protein match targets
  - `checkBlockedItems()` - Checks for blocked exercises/meals
- **Dependencies:** `constrainedGeneration.ts`, `constraints.ts`
- **Used By:** `plans.ts`

**`goals.ts`**
- **Purpose:** CRUD operations for goals
- **Key Functions:**
  - `getUserGoals()` - Get all goals for a user
  - `getActiveGoal()` - Get active goal for a user
  - `createGoal()` - Create new goal (sets as active, deactivates others)
  - `updateGoal()` - Update goal fields
  - `deleteGoal()` - Delete a goal
  - `setActiveGoal()` - Set a goal as active
- **Dependencies:** None
- **Used By:** Frontend, `plans.ts`, `constraints.ts`

#### Plan Management (TO BE REFACTORED)

**`plans.ts`** ⚠️ **LARGE FILE - NEEDS REFACTORING**
- **Purpose:** Plan management, workout generation, and daily workout/meal generation
- **Current Structure:**
  1. **Plan CRUD** (lines ~36-500)
     - `getUserPlans()`, `getActivePlan()`, `createPlan()`, `deletePlan()`, etc.
     - **Status:** These will be removed in goal-only system
  2. **Plan Generation** (lines ~537-777)
     - `generatePlan()` - Creates plan with trainingStrategy and dietPlan
     - **Status:** Will be replaced with goal-based generation
  3. **Workout Generation from Strategy** (lines ~1085-1438)
     - `generateWorkoutsFromStrategy()` - Generates month-long workouts from plan strategy
     - `generateNextWorkout()` - Generates next workout after completion
     - **Status:** Will be replaced with goal-based daily generation
  4. **Constraint-Driven Generation** (lines ~3802-4047) ⭐ **KEEP THIS**
     - `generateDailyWorkoutAndMeals()` - Main entry point for daily generation
     - Uses `constraints.ts`, `constrainedGeneration.ts`, `validation.ts`
     - **Status:** This is the future - goal-driven, no plan dependency
- **Dependencies:** `constraints.ts`, `constrainedGeneration.ts`, `validation.ts`, `goals.ts`, `users.ts`
- **Used By:** Frontend, other backend files

**`splits.ts`**
- **Purpose:** Workout split templates (PPL, Upper/Lower, Full Body, etc.)
- **Key Functions:**
  - `getSplitTemplate()` - Returns split template for a given split type
- **Dependencies:** None
- **Used By:** `plans.ts` (for plan-based generation)
- **Status:** May still be useful for goal-based generation (user preferences)

#### User Management

**`users.ts`**
- **Purpose:** User CRUD and profile management
- **Key Functions:**
  - `syncUser()` - Syncs Clerk user to Convex
  - `getUserByClerkId()` - Get user by Clerk ID
  - `getUserById()` - Get user by Convex ID
  - `updateProfile()` - Update user profile (height, weight, experience, injuries, preferences)
- **Dependencies:** None
- **Used By:** Frontend, `plans.ts`, `constraints.ts`

#### AI & LLM

**`llm.ts`**
- **Purpose:** LLM wrapper for Google Gemini
- **Key Functions:**
  - `generateText()` - Generates text using Gemini with messages and optional model role
- **Dependencies:** Google Generative AI SDK
- **Used By:** `constrainedGeneration.ts`, `plans.ts` (for plan generation)

**`src/ai/retrieval/getExerciseContext.ts`**
- **Purpose:** Retrieves exercise context for AI generation
- **Key Functions:**
  - `getExerciseContext()` - Gets exercises with optional filters (name, bodyPart)
- **Dependencies:** Convex QueryCtx
- **Used By:** `constrainedGeneration.ts`, `plans.ts`

**`src/ai/retrieval/getMealContext.ts`**
- **Purpose:** Retrieves meal context for AI generation
- **Key Functions:**
  - `getMealContext()` - Gets meals with optional filters (mealType, calories)
- **Dependencies:** Convex QueryCtx
- **Used By:** `constrainedGeneration.ts`, `plans.ts`

**`src/ai/retrieval/getTrainingStrategyContext.ts`**
- **Purpose:** Retrieves training strategy from active plan
- **Key Functions:**
  - `getTrainingStrategyContext()` - Gets training strategy from active plan
- **Dependencies:** Convex QueryCtx
- **Used By:** Chat system, other AI features
- **Status:** Will need to be refactored for goal-only system

#### Other Features

**`workoutEditing.ts`**
- **Purpose:** Workout session editing and regeneration
- **Key Functions:**
  - `reduceWorkoutVolume()` - Makes workout easier/shorter
  - `regenerateExercise()` - Regenerates a single exercise
  - `getTodayWorkout()` - Gets today's workout
  - `getWorkoutHistory()` - Gets workout history
- **Dependencies:** `plans.ts`
- **Used By:** Frontend

**`dailyTracking.ts`**
- **Purpose:** Daily tracking (water, steps)
- **Key Functions:**
  - `getDailyTracking()`, `updateDailyTracking()`, `addWaterIntake()`, `updateSteps()`
- **Dependencies:** None
- **Used By:** Frontend

**`mealLogs.ts`**
- **Purpose:** Meal logging
- **Key Functions:**
  - `getMealLogs()`, `addMealLog()`, `deleteMealLog()`
- **Dependencies:** None
- **Used By:** Frontend

**`challenges.ts`**
- **Purpose:** Pushup/pullup challenges
- **Key Functions:**
  - `createChallenge()`, `updateChallenge()`, `logChallengeReps()`
- **Dependencies:** None
- **Used By:** Frontend

**`chat.ts`**
- **Purpose:** AI chat interface for workout assistance
- **Key Functions:**
  - Chat intent routing and command handling
- **Dependencies:** `llm.ts`, `plans.ts`, retrieval functions
- **Used By:** Frontend

**`http.ts`**
- **Purpose:** HTTP endpoints (webhooks, etc.)
- **Dependencies:** Various
- **Used By:** External services

**`auth.config.ts`**
- **Purpose:** Clerk authentication configuration
- **Dependencies:** Clerk
- **Used By:** Convex auth system

### Frontend Files (`src/app/`)

**`page.tsx`** (Landing Page)
- **Purpose:** Public landing page
- **Features:** Hero section, call-to-action

**`home/page.tsx`** ⭐ **MAIN DASHBOARD**
- **Purpose:** Daily workout execution dashboard
- **Features:**
  - Shows today's workout if exists
  - Shows "Get Started" button if no active plan
  - Displays workout sessions, exercise sets, meals
- **Dependencies:** `plans.ts`, `workoutEditing.ts`
- **Status:** Needs update for goal-only system

**`generate-program/page.tsx`** ⭐ **ONBOARDING**
- **Purpose:** Onboarding flow that collects user info and creates goal + plan
- **Features:**
  - Conversation-style UI
  - Collects: age, height, weight, fitness goal, experience, workout days, injuries, dietary preferences
  - Calls `generatePlan()` which creates goal + plan + generates workouts
- **Dependencies:** `plans.ts` (generatePlan action)
- **Status:** Needs update to create goal only, not plan

**`profile/page.tsx`**
- **Purpose:** User profile and settings
- **Features:**
  - Goal management (create, edit, delete goals)
  - Plan management (view, activate, delete plans)
  - User profile editing
- **Dependencies:** `goals.ts`, `plans.ts`, `users.ts`
- **Status:** Needs update to remove plan management

**`workouts/page.tsx`**
- **Purpose:** Workout overview/history
- **Dependencies:** `plans.ts`, `workoutEditing.ts`

**`meals/page.tsx`**
- **Purpose:** Meal planning and logging
- **Dependencies:** `plans.ts`, `mealLogs.ts`

**`progress/page.tsx`**
- **Purpose:** Progress tracking and analytics
- **Dependencies:** `plans.ts` (for exercise progress)

**`calendar/page.tsx`**
- **Purpose:** Calendar view of workouts
- **Dependencies:** `plans.ts`

**`chat/page.tsx`**
- **Purpose:** AI chat interface
- **Dependencies:** `chat.ts`

**`admin/exercises/page.tsx`** & **`admin/meals/page.tsx`**
- **Purpose:** Admin pages for managing exercise and meal databases
- **Dependencies:** Direct database access

---

## Current Workflow: Plan-Based System

### 1. Onboarding Flow

```
User clicks "Get Started"
  ↓
generate-program/page.tsx
  ↓
Conversation collects:
  - Age, Height, Weight
  - Fitness Goal
  - Experience Level
  - Workout Frequency
  - Injuries
  - Dietary Preferences
  ↓
plans.ts::generatePlan()
  ├─ Saves user profile (height, weight, experience, injuries, preferences)
  ├─ Creates goal (from fitness goal)
  ├─ Generates trainingStrategy (AI)
  ├─ Generates dietPlan (AI)
  ├─ Creates plan with strategy + diet
  └─ Calls generateWorkoutsFromStrategy() to generate month of workouts
  ↓
User redirected to home page
```

### 2. Daily Workout Generation (Current: Plan-Based)

```
User requests daily workout
  ↓
plans.ts::generateDailyWorkoutAndMeals()
  ├─ Gets active plan (required)
  ├─ Gets active goal
  ├─ Gets user profile
  ├─ Gets recent workouts (14 days)
  ├─ Computes workout intent (constraints.ts)
  ├─ Computes progression targets (constraints.ts)
  ├─ Generates workout (constrainedGeneration.ts)
  ├─ Validates workout (validation.ts)
  ├─ Computes nutrition intent (constraints.ts)
  ├─ Generates meals (constrainedGeneration.ts)
  ├─ Validates meals (validation.ts)
  └─ Creates workout session + exercise sets + daily meals
```

### 3. Next Workout Generation (After Completion)

```
User completes workout
  ↓
plans.ts::generateNextWorkout()
  ├─ Gets plan and training strategy
  ├─ Finds next session in weekly split
  ├─ Selects exercises based on body parts
  ├─ Calculates progression
  └─ Creates workout session + exercise sets
```

---

## Target Workflow: Goal-Only System

### 1. Onboarding Flow (Simplified)

```
User clicks "Get Started"
  ↓
generate-program/page.tsx (rename to onboarding?)
  ↓
Conversation collects:
  - Age, Height, Weight
  - Fitness Goal
  - Experience Level
  - Workout Frequency (for split preference)
  - Injuries
  - Dietary Preferences
  ↓
NEW: goals.ts::createGoal() + users.ts::updateProfile()
  ├─ Saves user profile
  └─ Creates goal
  ↓
User redirected to home page
```

### 2. Daily Workout Generation (Goal-Based)

```
User requests daily workout
  ↓
plans.ts::generateDailyWorkoutAndMeals() (refactored)
  ├─ Gets active goal (required, no plan needed)
  ├─ Gets user profile
  ├─ Gets recent workouts (14 days)
  ├─ Computes workout intent from goal (constraints.ts)
  ├─ Computes progression targets (constraints.ts)
  ├─ Generates workout (constrainedGeneration.ts)
  ├─ Validates workout (validation.ts)
  ├─ Computes nutrition intent from goal (constraints.ts)
  ├─ Generates meals (constrainedGeneration.ts)
  ├─ Validates meals (validation.ts)
  └─ Creates workout session + exercise sets + daily meals
    (session no longer needs planId)
```

### 3. Next Workout Generation (After Completion)

```
User completes workout
  ↓
NEW: goals.ts::generateNextWorkout() or plans.ts::generateNextWorkout() (refactored)
  ├─ Gets active goal (no plan needed)
  ├─ Gets user profile + preferences (split preference)
  ├─ Computes workout intent from goal
  ├─ Selects exercises based on goal + body part rotation
  ├─ Calculates progression from history
  └─ Creates workout session + exercise sets
```

---

## Migration Plan: Plan → Goal-Only

### Phase 1: Schema Changes

1. **Remove `planId` from `workout_sessions`**
   - Add migration to set planId to null or remove field
   - Update all queries that filter by planId

2. **Keep `plans` table temporarily** (for data migration)
   - Mark as deprecated
   - Eventually remove after migration

3. **Enhance `goals` table if needed**
   - Add `preferred_split` field?
   - Add `workout_frequency` field?

### Phase 2: Backend Refactoring

1. **Refactor `generateDailyWorkoutAndMeals()`**
   - Remove `activePlan` requirement
   - Use `activeGoal` + `userProfile` instead
   - Remove planId from workout session creation

2. **Refactor `generateNextWorkout()`**
   - Remove plan dependency
   - Use goal + user preferences for split selection
   - Compute workout intent from goal directly

3. **Remove plan generation functions**
   - `generatePlan()` - Replace with goal creation
   - `generateWorkoutsFromStrategy()` - No longer needed
   - Plan CRUD functions - Remove or deprecate

4. **Update constraint computation**
   - `computeWorkoutIntent()` - Already uses goal, just remove plan fallback
   - `computeNutritionIntent()` - Already uses goal, no changes needed

### Phase 3: Frontend Updates

1. **Update onboarding**
   - Remove plan creation
   - Only create goal + update profile

2. **Update home page**
   - Remove "active plan" checks
   - Check for "active goal" instead

3. **Update profile page**
   - Remove plan management UI
   - Keep goal management

4. **Update other pages**
   - Remove plan references
   - Use goal-based logic

### Phase 4: Data Migration

1. **Migrate existing plans to goals**
   - Extract goal from plan's trainingStrategy
   - Create goal from plan data
   - Link workout sessions to goals (or remove planId)

2. **Clean up**
   - Remove plan data after migration
   - Remove plan-related code

---

## Key Dependencies

### Constraint System (Core)
```
constraints.ts (pure code)
  ↓
constrainedGeneration.ts (AI, constrained)
  ↓
validation.ts (validation)
  ↓
plans.ts::generateDailyWorkoutAndMeals() (orchestration)
```

### Goal System
```
goals.ts (CRUD)
  ↓
constraints.ts::computeWorkoutIntent() (uses goal)
  ↓
constrainedGeneration.ts (uses workout intent)
```

### User System
```
users.ts (CRUD)
  ↓
constraints.ts::computeNutritionIntent() (uses user profile)
  ↓
constrainedGeneration.ts (uses nutrition intent)
```

---

## Important Notes

1. **Constraint-driven system is goal-agnostic**
   - `constraints.ts` already uses goals, not plans
   - `constrainedGeneration.ts` is already goal-agnostic
   - Main work is removing plan dependencies from orchestration

2. **Workout sessions currently require planId**
   - This is the main blocker
   - Need to make planId optional or remove it

3. **Training strategy is currently in plans**
   - This can be derived from goal + user preferences
   - Or stored in goal/user preferences

4. **Split selection currently uses plan's executionConfig**
   - Can use user preferences instead
   - Or compute from goal + workout frequency

5. **Diet plan is currently in plans**
   - Can be generated on-demand from goal + user profile
   - Or stored in user preferences

---

## Files to Modify for Goal-Only System

### High Priority
- `convex/plans.ts` - Remove plan dependencies, refactor to goal-based
- `convex/schema.ts` - Remove planId from workout_sessions, deprecate plans table
- `src/app/home/page.tsx` - Check for goal instead of plan
- `src/app/generate-program/page.tsx` - Create goal only, not plan

### Medium Priority
- `src/app/profile/page.tsx` - Remove plan management UI
- `convex/workoutEditing.ts` - Remove plan dependencies
- `src/app/workouts/page.tsx` - Remove plan references
- `src/app/calendar/page.tsx` - Remove plan references
- `src/app/progress/page.tsx` - Remove plan references

### Low Priority
- `convex/chat.ts` - Update to use goals instead of plans
- `src/ai/retrieval/getTrainingStrategyContext.ts` - Refactor or remove
- `convex/splits.ts` - May still be useful for user preferences

---

## Testing Strategy

1. **Unit Tests**
   - Test constraint computation functions
   - Test validation functions
   - Test goal CRUD operations

2. **Integration Tests**
   - Test goal-based workout generation
   - Test goal-based meal generation
   - Test workout session creation without planId

3. **Migration Tests**
   - Test plan → goal migration
   - Test data integrity after migration

---

## Summary

The system is already mostly goal-driven at the constraint level. The main work is:
1. Removing plan dependencies from workout session creation
2. Refactoring orchestration functions to use goals instead of plans
3. Updating frontend to remove plan UI
4. Migrating existing plan data to goals

The constraint-driven AI generation system is already goal-agnostic and ready to work without plans.
