/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_agent from "../ai/agent.js";
import type * as ai_conversationAgent from "../ai/conversationAgent.js";
import type * as ai_embeddingConversationAgent from "../ai/embeddingConversationAgent.js";
import type * as ai_goalParser from "../ai/goalParser.js";
import type * as ai_llmConversationAgent from "../ai/llmConversationAgent.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_rag from "../ai/rag.js";
import type * as ai_schemas from "../ai/schemas.js";
import type * as ai_slotRegistry from "../ai/slotRegistry.js";
import type * as ai_types from "../ai/types.js";
import type * as conversation from "../conversation.js";
import type * as http from "../http.js";
import type * as llmConversation from "../llmConversation.js";
import type * as plans from "../plans.js";
import type * as testHf from "../testHf.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/agent": typeof ai_agent;
  "ai/conversationAgent": typeof ai_conversationAgent;
  "ai/embeddingConversationAgent": typeof ai_embeddingConversationAgent;
  "ai/goalParser": typeof ai_goalParser;
  "ai/llmConversationAgent": typeof ai_llmConversationAgent;
  "ai/prompts": typeof ai_prompts;
  "ai/rag": typeof ai_rag;
  "ai/schemas": typeof ai_schemas;
  "ai/slotRegistry": typeof ai_slotRegistry;
  "ai/types": typeof ai_types;
  conversation: typeof conversation;
  http: typeof http;
  llmConversation: typeof llmConversation;
  plans: typeof plans;
  testHf: typeof testHf;
  users: typeof users;
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
