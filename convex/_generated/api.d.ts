/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as challenges from "../challenges.js";
import type * as chat from "../chat.js";
import type * as constrainedGeneration from "../constrainedGeneration.js";
import type * as constraints from "../constraints.js";
import type * as dailyTracking from "../dailyTracking.js";
import type * as goals from "../goals.js";
import type * as http from "../http.js";
import type * as llm from "../llm.js";
import type * as longTermPlans_generation from "../longTermPlans/generation.js";
import type * as longTermPlans_index from "../longTermPlans/index.js";
import type * as longTermPlans_storage from "../longTermPlans/storage.js";
import type * as mealLogs from "../mealLogs.js";
import type * as plans from "../plans.js";
import type * as primaryLifts from "../primaryLifts.js";
import type * as scheduledWorkouts from "../scheduledWorkouts.js";
import type * as split_templates from "../split_templates.js";
import type * as splits from "../splits.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";
import type * as workoutEditing from "../workoutEditing.js";
import type * as workouts_bodyCompositionWorkout from "../workouts/bodyCompositionWorkout.js";
import type * as workouts_enduranceWorkout from "../workouts/enduranceWorkout.js";
import type * as workouts_index from "../workouts/index.js";
import type * as workouts_mobilityWorkout from "../workouts/mobilityWorkout.js";
import type * as workouts_skillWorkout from "../workouts/skillWorkout.js";
import type * as workouts_strengthWorkout from "../workouts/strengthWorkout.js";
import type * as workouts_workoutUtils from "../workouts/workoutUtils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  challenges: typeof challenges;
  chat: typeof chat;
  constrainedGeneration: typeof constrainedGeneration;
  constraints: typeof constraints;
  dailyTracking: typeof dailyTracking;
  goals: typeof goals;
  http: typeof http;
  llm: typeof llm;
  "longTermPlans/generation": typeof longTermPlans_generation;
  "longTermPlans/index": typeof longTermPlans_index;
  "longTermPlans/storage": typeof longTermPlans_storage;
  mealLogs: typeof mealLogs;
  plans: typeof plans;
  primaryLifts: typeof primaryLifts;
  scheduledWorkouts: typeof scheduledWorkouts;
  split_templates: typeof split_templates;
  splits: typeof splits;
  users: typeof users;
  validation: typeof validation;
  workoutEditing: typeof workoutEditing;
  "workouts/bodyCompositionWorkout": typeof workouts_bodyCompositionWorkout;
  "workouts/enduranceWorkout": typeof workouts_enduranceWorkout;
  "workouts/index": typeof workouts_index;
  "workouts/mobilityWorkout": typeof workouts_mobilityWorkout;
  "workouts/skillWorkout": typeof workouts_skillWorkout;
  "workouts/strengthWorkout": typeof workouts_strengthWorkout;
  "workouts/workoutUtils": typeof workouts_workoutUtils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
