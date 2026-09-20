import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import type { Ingredient, Recipe, SaveRecipeInput } from '../types';

const recipesCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'recipes');

export async function listRecipes(restaurantId: string): Promise<Recipe[]> {
  const snap = await getDocs(recipesCol(restaurantId));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Recipe, 'recipeId'>), recipeId: d.id }));
}

export async function fetchRecipe(restaurantId: string, menuItemId: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(recipesCol(restaurantId), menuItemId));
  return snap.exists() ? { ...(snap.data() as Omit<Recipe, 'recipeId'>), recipeId: snap.id } : null;
}

/**
 * Creates or replaces a menu item's recipe. `ingredientsById` is the
 * already-loaded ingredient list (the caller, RecipesPage, already has it
 * for the cost column) — used here to resolve each line's denormalized
 * `ingredientName`/`unit`, same reasoning as everywhere else in this app
 * that denormalizes a name onto a child record. Not run as a transaction:
 * there's no "read current value first" dependency the way stock changes
 * have — this is a straight overwrite of one menu item's recipe.
 */
export async function saveRecipe(
  restaurantId: string,
  input: SaveRecipeInput,
  ingredientsById: Map<string, Ingredient>,
): Promise<void> {
  const lines = input.lines.map((line) => {
    const ingredient = ingredientsById.get(line.ingredientId);
    if (!ingredient) {
      throw new AppError('One of the selected ingredients could not be found — refresh and try again.');
    }
    return {
      ingredientId: line.ingredientId,
      ingredientName: ingredient.name,
      unit: ingredient.unit,
      quantity: line.quantity,
    };
  });

  const ref = doc(recipesCol(restaurantId), input.menuItemId);
  await setDoc(ref, {
    recipeId: input.menuItemId,
    restaurantId,
    menuItemId: input.menuItemId,
    menuItemName: input.menuItemName,
    lines,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecipe(restaurantId: string, menuItemId: string): Promise<void> {
  await deleteDoc(doc(recipesCol(restaurantId), menuItemId));
}

/**
 * Live per-unit cost of a recipe: sum of each line's quantity × that
 * ingredient's CURRENT `costPerUnitMinor`. Returns 0 for a null/undefined
 * recipe (no recipe yet) so callers can use it unconditionally. Rounds
 * each line to the nearest minor unit, same "round at the multiplication"
 * approach as recordPurchase's totalCostMinor in inventoryService.ts.
 */
export function computeRecipeCostMinor(recipe: Recipe | null | undefined, ingredientsById: Map<string, Ingredient>): number {
  if (!recipe) return 0;
  return recipe.lines.reduce((total, line) => {
    const costPerUnitMinor = ingredientsById.get(line.ingredientId)?.costPerUnitMinor ?? 0;
    return total + Math.round(line.quantity * costPerUnitMinor);
  }, 0);
}
