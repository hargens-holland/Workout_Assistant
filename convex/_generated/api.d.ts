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
import type * as mealLogs from "../mealLogs.js";
import type * as plans from "../plans.js";
import type * as splits from "../splits.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";
import type * as workoutEditing from "../workoutEditing.js";

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
  mealLogs: typeof mealLogs;
  plans: typeof plans;
  splits: typeof splits;
  users: typeof users;
  validation: typeof validation;
  workoutEditing: typeof workoutEditing;
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
