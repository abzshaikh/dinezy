import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import type { CreateMenuCategoryInput, CreateMenuItemInput, MenuCategory, MenuItem } from '../types';

const categoriesCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'menuCategories');
const itemsCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'menuItems');

/**
 * Both list functions below deliberately query WITHOUT a `where()` filter,
 * ordering on a single field only — that needs no composite index (only a
 * filter + orderBy on two DIFFERENT fields does, per the lesson learned the
 * hard way in Phase 2 — see PHASE_2_REPORT.md Addendum). Category/item
 * filtering (by category, by active state) is done client-side in the UI
 * instead; a single restaurant's menu is small enough (dozens to low
 * hundreds of items) that this is cheap and avoids another index-deploy
 * round trip.
 */

export async function listCategories(restaurantId: string): Promise<MenuCategory[]> {
  const q = query(categoriesCol(restaurantId), orderBy('displayOrder', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<MenuCategory, 'categoryId'>), categoryId: d.id }));
}

export async function createCategory(restaurantId: string, input: CreateMenuCategoryInput): Promise<void> {
  const now = serverTimestamp();
  await addDoc(categoriesCol(restaurantId), {
    restaurantId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    displayOrder: input.displayOrder ?? 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateCategory(restaurantId: string, categoryId: string, input: CreateMenuCategoryInput): Promise<void> {
  const ref = doc(categoriesCol(restaurantId), categoryId);
  await updateDoc(ref, {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    displayOrder: input.displayOrder ?? 0,
    updatedAt: serverTimestamp(),
  });
}

export async function setCategoryActive(restaurantId: string, categoryId: string, isActive: boolean): Promise<void> {
  const ref = doc(categoriesCol(restaurantId), categoryId);
  await updateDoc(ref, { isActive, updatedAt: serverTimestamp() });
}

/**
 * Refuses to delete a category that still has menu items in it (checked
 * client-side — Firestore rules can't easily express cross-document
 * referential-integrity checks like this). Move or delete those items
 * first, or just archive the category instead via setCategoryActive.
 */
export async function deleteCategory(restaurantId: string, categoryId: string): Promise<void> {
  const itemsInCategory = await getDocs(query(itemsCol(restaurantId), where('categoryId', '==', categoryId)));
  if (!itemsInCategory.empty) {
    throw new AppError(
      `This category still has ${itemsInCategory.size} menu item${itemsInCategory.size === 1 ? '' : 's'} in it. Move or delete those first, or archive the category instead.`,
    );
  }
  await deleteDoc(doc(categoriesCol(restaurantId), categoryId));
}

export async function listMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const q = query(itemsCol(restaurantId), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<MenuItem, 'itemId'>), itemId: d.id }));
}

export async function createMenuItem(restaurantId: string, input: CreateMenuItemInput): Promise<void> {
  const now = serverTimestamp();
  await addDoc(itemsCol(restaurantId), {
    restaurantId,
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    priceMinor: input.priceMinor,
    image: input.image ?? null,
    dietaryType: input.dietaryType ?? null,
    isAvailable: true,
    isActive: true,
    displayOrder: input.displayOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateMenuItem(restaurantId: string, itemId: string, input: CreateMenuItemInput): Promise<void> {
  const ref = doc(itemsCol(restaurantId), itemId);
  await updateDoc(ref, {
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    priceMinor: input.priceMinor,
    image: input.image ?? null,
    dietaryType: input.dietaryType ?? null,
    displayOrder: input.displayOrder ?? 0,
    updatedAt: serverTimestamp(),
  });
}

/** The day-to-day "86'd today" toggle — temporarily out of stock, distinct from `isActive`. */
export async function setMenuItemAvailability(restaurantId: string, itemId: string, isAvailable: boolean): Promise<void> {
  const ref = doc(itemsCol(restaurantId), itemId);
  await updateDoc(ref, { isAvailable, updatedAt: serverTimestamp() });
}

/** The longer-lived soft-delete flag — removed from the menu, but history (once orders exist) is kept. */
export async function setMenuItemActive(restaurantId: string, itemId: string, isActive: boolean): Promise<void> {
  const ref = doc(itemsCol(restaurantId), itemId);
  await updateDoc(ref, { isActive, updatedAt: serverTimestamp() });
}

export async function deleteMenuItem(restaurantId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(itemsCol(restaurantId), itemId));
}
