import type { Timestamp } from 'firebase/firestore';
import type { IngredientUnit } from './inventory';

/**
 * One line of a recipe: how much of one ingredient goes into ONE unit of
 * the menu item this recipe belongs to (e.g. one plate of Butter Chicken
 * uses 0.25 kg of chicken). `ingredientName`/`unit` are denormalized at
 * save time — same pattern as StockLedgerEntry/RestaurantUser elsewhere in
 * this app — so a recipe still reads correctly if the ingredient is later
 * renamed, and the UI doesn't need a join just to show a line.
 */
export interface RecipeLine {
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  quantity: number;
}

/**
 * Recipe document stored at: restaurants/{restaurantId}/recipes/{menuItemId}
 * One recipe per menu item — the doc ID IS the menuItemId (a 1:1
 * relationship) — so "does this item have a recipe yet" is a single
 * get(), not a query.
 *
 * Cost is intentionally NOT stored on this document — it's computed LIVE
 * from `lines` + each ingredient's CURRENT `costPerUnitMinor` (see
 * recipeService.computeRecipeCostMinor), per this app's "recipes compute
 * cost live, sales snapshot at record time" convention. That means a
 * recipe's cost can move as ingredient costs change day to day — that's
 * intentional, not a bug. A Daily Sales entry (src/types/sales.ts)
 * snapshots the cost as of the day it's recorded, so a past day's profit
 * numbers never shift retroactively just because today's flour got more
 * expensive.
 *
 * Phase 5 deliberately does NOT deduct ingredient stock when a recipe is
 * "sold" via Daily Sales — see DailySalesEntry's doc comment. Stock only
 * ever changes through Phase 4's Purchases/Waste/Adjustment flows, entered
 * by hand at day's end.
 */
export interface Recipe {
  recipeId: string; // == menuItemId
  restaurantId: string;
  menuItemId: string;
  menuItemName: string;
  lines: RecipeLine[];
  updatedAt: Timestamp;
}

export interface SaveRecipeInput {
  menuItemId: string;
  menuItemName: string;
  lines: { ingredientId: string; quantity: number }[];
}
