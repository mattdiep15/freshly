/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as dev from "../dev.js";
import type * as foods from "../foods.js";
import type * as http from "../http.js";
import type * as itemEdits from "../itemEdits.js";
import type * as model_auth from "../model/auth.js";
import type * as model_claude from "../model/claude.js";
import type * as model_foods from "../model/foods.js";
import type * as profiles from "../profiles.js";
import type * as receipts from "../receipts.js";
import type * as receiptsNode from "../receiptsNode.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  dev: typeof dev;
  foods: typeof foods;
  http: typeof http;
  itemEdits: typeof itemEdits;
  "model/auth": typeof model_auth;
  "model/claude": typeof model_claude;
  "model/foods": typeof model_foods;
  profiles: typeof profiles;
  receipts: typeof receipts;
  receiptsNode: typeof receiptsNode;
  seed: typeof seed;
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
