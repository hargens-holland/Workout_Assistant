# Chat Intent Routing - Test Cases

This document outlines test cases for the intent-routing system (Steps 3 + 4).

## Testing Strategy

### Layer 1: Intent Classification Tests
Test that user input → LLM → JSON → validated intent works correctly.

### Layer 2: Confidence Gating Tests
Verify that low-confidence inputs are blocked and return clarifying questions.

### Layer 3: Execution Path Tests
Verify that existing functionality still works after the refactor.

---

## Layer 1: Intent Classification Tests

### Test Cases

| User Input | Expected LLM Intent | Expected Confidence | Expected Internal Intent | Expected Params |
|------------|---------------------|---------------------|-------------------------|-----------------|
| `"swap squats"` | `SWAP_EXERCISE` | ≥ 0.8 | `WORKOUT_SWAP_EXERCISE` | `{exerciseName: "squats", date: ...}` |
| `"replace deadlifts with something easier"` | `SWAP_EXERCISE` | ≥ 0.8 | `WORKOUT_SWAP_EXERCISE` | `{exerciseName: "deadlifts", date: ...}` |
| `"make today easier"` | `EDIT_TODAY_WORKOUT` | ≥ 0.8 | `WORKOUT_MAKE_EASIER` | `{date: ..., mode: "remove_set"}` |
| `"make today shorter"` | `EDIT_TODAY_WORKOUT` | ≥ 0.8 | `WORKOUT_MAKE_EASIER` | `{date: ..., mode: "remove_exercise"}` |
| `"redo today's workout"` | `REGENERATE_TODAY_WORKOUT` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "REGENERATE_TODAY_WORKOUT"}` |
| `"regenerate my workout"` | `REGENERATE_TODAY_WORKOUT` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "REGENERATE_TODAY_WORKOUT"}` |
| `"log chicken salad 450 calories"` | `LOG_MEAL` | ≥ 0.8 | `MEAL_LOG_QUICK` | `{name: "chicken salad", calories: 450, date: ...}` |
| `"log chicken salad 450 calories 40 protein"` | `LOG_MEAL` | ≥ 0.9 | `MEAL_LOG_QUICK` | `{name: "chicken salad", calories: 450, protein: 40, date: ...}` |
| `"why is this my workout?"` | `REQUEST_EXPLANATION` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "REQUEST_EXPLANATION"}` |
| `"explain this exercise"` | `REQUEST_EXPLANATION` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "REQUEST_EXPLANATION"}` |
| `"hey"` | `SMALL_TALK` | ≥ 0.9 | `UNKNOWN` (with originalIntent) | `{originalIntent: "SMALL_TALK"}` |
| `"hello"` | `SMALL_TALK` | ≥ 0.9 | `UNKNOWN` (with originalIntent) | `{originalIntent: "SMALL_TALK"}` |
| `"how are you"` | `SMALL_TALK` | ≥ 0.8 | `UNKNOWN` (with originalIntent) | `{originalIntent: "SMALL_TALK"}` |
| `"do the thing"` | `CLARIFY` or `UNKNOWN` | < 0.7 | `UNKNOWN` | `{}` |
| `"show my progress"` | `VIEW_PROGRESS` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "VIEW_PROGRESS"}` |
| `"what's my progress"` | `VIEW_PROGRESS` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "VIEW_PROGRESS"}` |
| `"generate a new plan"` | `GENERATE_PLAN` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "GENERATE_PLAN"}` |
| `"update my goals"` | `UPDATE_GOAL` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "UPDATE_GOAL"}` |
| `"swap my meal"` | `SWAP_MEAL` | ≥ 0.7 | `UNKNOWN` (with originalIntent) | `{originalIntent: "SWAP_MEAL"}` |
| `"never show burpees again"` | `UNKNOWN` (should map to BLOCK_ITEM) | ≥ 0.7 | `BLOCK_ITEM` | `{itemName: "burpees", itemType: "exercise"}` |

### What to Check in Logs

1. **Raw LLM Response**: Should be valid JSON
2. **Parsed Intent**: Should match expected LLM intent
3. **Confidence**: Should be in expected range
4. **Internal Intent**: Should map correctly
5. **Params**: Should extract relevant parameters

### Success Criteria

- ✅ LLM returns valid JSON
- ✅ Zod validation passes
- ✅ Intent matches expected value
- ✅ Confidence is in expected range
- ✅ Params contain expected fields

---

## Layer 2: Confidence Gating Tests (Safety)

### Test Cases - Ambiguous Inputs (Should Be Blocked)

| User Input | Expected LLM Intent | Expected Confidence | Expected Behavior |
|------------|---------------------|---------------------|-------------------|
| `"change it"` | `CLARIFY` or `UNKNOWN` | < 0.7 | ❌ **BLOCKED** - Returns: "Can you clarify what you'd like to change?" |
| `"fix my workout"` | `CLARIFY` or `UNKNOWN` | < 0.7 | ❌ **BLOCKED** - Returns: "Can you clarify what you'd like to change?" |
| `"not feeling it"` | `CLARIFY` or `UNKNOWN` | < 0.7 | ❌ **BLOCKED** - Returns: "Can you clarify what you'd like to change?" |
| `"do something"` | `CLARIFY` or `UNKNOWN` | < 0.7 | ❌ **BLOCKED** - Returns: "Can you clarify what you'd like to change?" |
| `"help"` | `CLARIFY` or `SMALL_TALK` | < 0.7 | ❌ **BLOCKED** - Returns: "Can you clarify what you'd like to change?" |
| `"update"` | `CLARIFY` or `UNKNOWN` | < 0.7 | ❌ **BLOCKED** - Returns: "Can you clarify what you'd like to change?" |

### What to Check in Logs

1. **Confidence Value**: Should be < 0.7
2. **Gating Decision**: Should log "❌ BLOCKED"
3. **Response**: Should return clarifying question
4. **No Execution**: Should NOT call `executeIntent`

### Success Criteria

- ✅ Low confidence inputs are blocked
- ✅ No actions are performed
- ✅ User receives clarifying question
- ✅ Logs show blocking decision

### Critical: If Any Ambiguous Input Performs an Action → BUG

---

## Layer 3: Execution Path Tests (Regression)

### Test Cases - Existing Functionality

#### 1. WORKOUT_SWAP_EXERCISE

**Test Input**: `"swap squats"`

**Expected Flow**:
1. Intent: `SWAP_EXERCISE` → `WORKOUT_SWAP_EXERCISE`
2. Confidence: ≥ 0.7 (passes gating)
3. Execution: Calls `api.workoutEditing.getTodayWorkout`
4. Execution: Finds exercise matching "squats"
5. Execution: Calls `api.plans.regenerateExercise`
6. Response: Success message + data change logged

**Expected Response**:
```json
{
  "success": true,
  "message": "Swapped the exercise in your workout. Check your workout for the new exercise.",
  "dataChanges": [
    {
      "type": "exercise_swapped",
      "description": "Replaced exercise in today's workout",
      "id": "<exerciseSetId>"
    }
  ],
  "refetchIds": ["<workoutId>"]
}
```

**What to Verify**:
- ✅ Exercise is actually replaced in database
- ✅ Workout shows new exercise
- ✅ Data change is logged

---

#### 2. WORKOUT_MAKE_EASIER

**Test Input**: `"make today easier"`

**Expected Flow**:
1. Intent: `EDIT_TODAY_WORKOUT` → `WORKOUT_MAKE_EASIER`
2. Confidence: ≥ 0.7 (passes gating)
3. Execution: Calls `api.workoutEditing.getTodayWorkout`
4. Execution: Calls `api.workoutEditing.reduceWorkoutVolume` with mode "remove_set"
5. Response: Success message + data change logged

**Expected Response**:
```json
{
  "success": true,
  "message": "Made your workout easier.",
  "dataChanges": [
    {
      "type": "workout_reduced",
      "description": "Made workout easier",
      "id": "<workoutId>"
    }
  ],
  "refetchIds": ["<workoutId>"]
}
```

**What to Verify**:
- ✅ Workout volume is reduced (sets removed)
- ✅ Workout is updated in database
- ✅ Data change is logged

---

#### 3. MEAL_LOG_QUICK

**Test Input**: `"log chicken salad 450 calories 40 protein"`

**Expected Flow**:
1. Intent: `LOG_MEAL` → `MEAL_LOG_QUICK`
2. Confidence: ≥ 0.9 (passes gating)
3. Execution: Calls `api.mealLogs.createMealLog`
4. Response: Success message + data change logged

**Expected Response**:
```json
{
  "success": true,
  "message": "Logged chicken salad (450 calories, 40g protein).",
  "dataChanges": [
    {
      "type": "meal_logged",
      "description": "Logged chicken salad"
    }
  ]
}
```

**What to Verify**:
- ✅ Meal log appears in database
- ✅ Calories and protein are correct
- ✅ Date is set correctly
- ✅ Data change is logged

---

#### 4. BLOCK_ITEM

**Test Input**: `"never show burpees again"`

**Expected Flow**:
1. Intent: Should map to `BLOCK_ITEM` (may need prompt tuning)
2. Confidence: ≥ 0.7 (passes gating)
3. Execution: Calls `api.plans.getAllExercises`
4. Execution: Finds "burpees" exercise
5. Execution: Calls `api.plans.blockItem`
6. Response: Success message + data change logged

**Expected Response**:
```json
{
  "success": true,
  "message": "Blocked \"burpees\". You won't see it in future workouts.",
  "dataChanges": [
    {
      "type": "item_blocked",
      "description": "Blocked exercise: burpees"
    }
  ]
}
```

**What to Verify**:
- ✅ Exercise is blocked in database
- ✅ Exercise won't appear in future workouts
- ✅ Data change is logged

---

#### 5. SCHEDULE_MOVE_WORKOUT

**Test Input**: `"move Friday workout to Saturday"`

**Expected Flow**:
1. Intent: Should map to `SCHEDULE_MOVE_WORKOUT` (may need new LLM intent)
2. Confidence: ≥ 0.7 (passes gating)
3. Execution: Calls `api.plans.getWorkoutsByDateRange`
4. Execution: Finds workout for Friday
5. Execution: Calls `api.workoutEditing.moveWorkoutSession`
6. Response: Success message + data change logged

**Expected Response**:
```json
{
  "success": true,
  "message": "Moved your workout to <Saturday date>.",
  "dataChanges": [
    {
      "type": "workout_moved",
      "description": "Moved workout from <Friday> to <Saturday>",
      "id": "<sessionId>"
    }
  ],
  "refetchIds": ["<sessionId>"]
}
```

**What to Verify**:
- ✅ Workout date is updated in database
- ✅ Workout appears on new date
- ✅ Data change is logged

---

## Unsupported Intent Responses

### Test Cases - Intents Without Handlers

| User Input | Expected LLM Intent | Expected Response |
|------------|---------------------|-------------------|
| `"redo today's workout"` | `REGENERATE_TODAY_WORKOUT` | "Regenerating today's workout is not yet available. You can modify your workout instead." |
| `"show my progress"` | `VIEW_PROGRESS` | "You can view your progress on the Progress page." |
| `"generate a new plan"` | `GENERATE_PLAN` | "You can generate a new plan from the Generate Program page." |
| `"update my goals"` | `UPDATE_GOAL` | "You can update your goals from your profile page." |
| `"swap my meal"` | `SWAP_MEAL` | "You can swap meals from the Meals page." |
| `"why is this my workout?"` | `REQUEST_EXPLANATION` | "I'm here to help! What would you like to know more about?" |
| `"hey"` | `SMALL_TALK` | "Hi! I'm your fitness coach. How can I help you today?" |

**What to Verify**:
- ✅ Appropriate message is returned
- ✅ No errors occur
- ✅ User experience is smooth

---

## How to Run Tests

1. **Open Convex Dashboard** or check server logs
2. **Send test messages** via the chat UI
3. **Check console logs** for:
   - `🔍 [INTENT PARSING]` - Intent classification
   - `🔄 [INTENT MAPPING]` - Intent mapping
   - `🛡️ [CONFIDENCE GATING]` - Confidence check
   - `⚙️ [EXECUTION]` - Execution start
   - `✅ [EXECUTION RESULT]` - Execution result

4. **Verify**:
   - Intent classification matches expected
   - Confidence is in expected range
   - Gating works correctly
   - Execution produces expected results

---

## Success Criteria Summary

### ✅ Layer 1 (Intent Classification)
- LLM returns valid JSON
- Intent matches expected value
- Confidence is reasonable
- Params are extracted correctly

### ✅ Layer 2 (Confidence Gating)
- Low confidence inputs are blocked
- No actions performed on ambiguous input
- User receives clarifying question

### ✅ Layer 3 (Execution)
- Existing actions still work
- Database changes are correct
- Responses are appropriate
- Unsupported intents fail gracefully

---

## Notes

- If intent classification is wrong → **tweak prompt only**, don't change logic
- If confidence is consistently wrong → **tweak prompt only**
- If execution fails → **check existing code**, not intent routing
- All logging is temporary and should be removed after testing
