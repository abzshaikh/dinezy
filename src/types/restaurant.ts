import type { Timestamp } from 'firebase/firestore';

export type RestaurantStatus = 'active' | 'suspended' | 'archived';

/**
 * Restaurant document stored at: restaurants/{restaurantId}
 * All restaurant-specific business data (menu, inventory, purchases, orders,
 * expenses, etc.) lives in SUBCOLLECTIONS under this document:
 *   restaurants/{restaurantId}/menuItems/{id}
 *   restaurants/{restaurantId}/ingredients/{id}
 *   restaurants/{restaurantId}/purchases/{id}
 *   ...etc (added in later phases)
 * The document path itself is the tenant-isolation boundary; Firestore
 * security rules key off it via the restaurantUsers membership check.
 */
export interface Restaurant {
  restaurantId: string;
  restaurantName: string;
  legalName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  fssaiNumber: string | null;
  currency: string; // ISO 4217 code, default 'INR'
  timezone: string; // IANA tz, default 'Asia/Kolkata'
  logo: string | null;
  ownerId: string;
  status: RestaurantStatus;
  settings: RestaurantSettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Business/financial configuration for the restaurant (Phase 6+ fields already reserved). */
export interface RestaurantSettings {
  gstPercent: number; // e.g. 5 for 5%
  serviceChargePercent: number;
  defaultWeightUnit: 'g' | 'kg';
  defaultVolumeUnit: 'ml' | 'l';
  financialYearStartMonth: number; // 1-12, e.g. 4 for April
  invoicePrefix: string;
  nextInvoiceNumber: number;
  targetFoodCostPercent: number; // used in Phase 6 Pricing Analysis, default 30
}

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  gstPercent: 5,
  serviceChargePercent: 0,
  defaultWeightUnit: 'kg',
  defaultVolumeUnit: 'l',
  financialYearStartMonth: 4,
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  targetFoodCostPercent: 30,
};

export interface CreateRestaurantInput {
  restaurantName: string;
  legalName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  currency?: string;
  timezone?: string;
}

/**
 * Phase 8 — editing an existing restaurant's profile + settings (the
 * Restaurant Profile page). Same business-info shape as
 * `CreateRestaurantInput` (currency/timezone required here rather than
 * optional, since the form always has a current value to edit), plus the
 * logo URL and the full `RestaurantSettings` block. `restaurantService.
 * updateRestaurant` never touches `ownerId`/`restaurantId`/`status` —
 * those aren't part of this input type at all, matching the
 * `firestore.rules` invariant that this update can't change either.
 */
export interface UpdateRestaurantInput {
  restaurantName: string;
  legalName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  currency: string;
  timezone: string;
  logo: string | null;
  settings: RestaurantSettings;
}
