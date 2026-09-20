import type { Timestamp } from 'firebase/firestore';

/** Simple veg/non-veg/egg marker, common on Indian restaurant menus. Optional — leave unset if not relevant. */
export const DIETARY_TYPES = ['veg', 'non_veg', 'egg'] as const;
export type DietaryType = (typeof DIETARY_TYPES)[number];

export const DIETARY_TYPE_LABELS: Record<DietaryType, string> = {
  veg: 'Veg',
  non_veg: 'Non-Veg',
  egg: 'Contains Egg',
};

/**
 * Category document stored at: restaurants/{restaurantId}/menuCategories/{categoryId}
 * Purely organizational — groups menu items for display and for future
 * reporting (e.g. "which category sells best"). `displayOrder` controls
 * where it appears in the Menu Items page and (later) on customer-facing
 * menus; lower sorts first.
 */
export interface MenuCategory {
  categoryId: string;
  restaurantId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  /** Soft-delete flag — inactive categories are hidden from pickers but keep their history. */
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateMenuCategoryInput {
  name: string;
  description?: string;
  displayOrder?: number;
}

/**
 * Menu item document stored at: restaurants/{restaurantId}/menuItems/{itemId}
 * `priceMinor` follows the same integer-minor-units convention as every
 * other money field in this app (see src/utils/money.ts) — never a float.
 * `isAvailable` is the day-to-day "86'd today" toggle (e.g. ran out of an
 * ingredient); `isActive` is the longer-lived soft-delete flag (e.g.
 * removed from the menu for the season). Both default true on creation.
 */
export interface MenuItem {
  itemId: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  image: string | null;
  dietaryType: DietaryType | null;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateMenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  priceMinor: number;
  image?: string | null;
  dietaryType?: DietaryType | null;
  displayOrder?: number;
}
