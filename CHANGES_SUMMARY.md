# Code Changes Summary - Regeneration Guardrails and Logging

## Context
Modified two functions in `convex/plans.ts` to add safety guardrails and debugging logs for exercise and meal regeneration.

## Functions Modified

### 1. `regenerateExercise` (lines 2273-2423)
**Location**: `convex/plans.ts:2273`

**Changes Made**:
- Added optional `reason` parameter to args (line 2279)
- Added guardrail check: Prevents regeneration if any sets being replaced are completed (lines 2319-2323)
- Added logging: Records regeneration reason and timestamp (lines 2325-2332)

**Key Code Added**:
```typescript
// Line 2279: Added to args
reason: v.optional(v.string()),

// Lines 2319-2323: Guardrail check
// Check if any sets being replaced are completed
const hasCompletedSets = setsToReplace.some(s => s.completed);
if (hasCompletedSets) {
    throw new Error("Cannot regenerate exercise with completed sets");
}

// Lines 2325-2332: Logging
// Log regeneration reason and timestamp
console.log("[regenerateExercise] Regeneration triggered", {
    exerciseSetId: args.exerciseSetId,
    oldExerciseId,
    sessionId: args.sessionId,
    reason: args.reason || "user_requested",
    timestamp: new Date().toISOString(),
});
```

**Removed**: Previous check for completed session (was checking all sets in session, now checks only sets being replaced)

---

### 2. `regenerateMeal` (lines 2429-2516)
**Location**: `convex/plans.ts:2429`

**Changes Made**:
- Added optional `reason` parameter to args (line 2434)
- Added guardrail check: Prevents regeneration if the daily meal is completed (lines 2445-2448)
- Added logging: Records regeneration reason and timestamp (lines 2464-2471)
- Removed: Previous check for completed session (was checking exercise sets, now checks meal directly)

**Key Code Added**:
```typescript
// Line 2434: Added to args
reason: v.optional(v.string()),

// Lines 2445-2448: Guardrail check
// Check if meal is completed
if (dailyMeal.completed) {
    throw new Error("Cannot regenerate completed meal");
}

// Lines 2464-2471: Logging
// Log regeneration reason and timestamp
console.log("[regenerateMeal] Regeneration triggered", {
    dailyMealId: args.dailyMealId,
    mealId: dailyMeal.mealId,
    sessionId: dailyMeal.sessionId,
    reason: args.reason || "user_requested",
    timestamp: new Date().toISOString(),
});
```

**Removed**: Previous check that validated session completion via exercise sets (lines 2447-2454 in old version)

---

## Schema Context
- `exercise_sets` table has `completed: v.boolean()` field (schema.ts:111)
- `daily_meals` table has `completed: v.boolean()` field (schema.ts:121)

## Expected Behavior
1. **Guardrails**: Both functions now throw clear errors when attempting to regenerate completed items
2. **Logging**: All regenerations are logged with reason (defaults to "user_requested" if not provided) and ISO timestamp
3. **No breaking changes**: Optional `reason` parameter maintains backward compatibility

## Frontend Usage
Functions are called from `src/app/calendar/page.tsx`:
- `regenerateExercise` called at line 471
- `regenerateMeal` called at line 662

Frontend calls do not currently pass `reason` parameter, so default "user_requested" will be logged.
