import type { Timestamp } from 'firebase/firestore';

/** Fixed unit set — deliberately small. Weight/volume/count covers the vast majority of raw-material tracking. */
export const INGREDIENT_UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'dozen'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export const WASTE_REASONS = ['spoilage', 'expired', 'overproduction', 'other'] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];
export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  spoilage: 'Spoilage',
  expired: 'Expired',
  overproduction: 'Overproduction',
  other: 'Other',
};

/**
 * Ingredient document stored at: restaurants/{restaurantId}/ingredients/{ingredientId}
 * `currentStockQty` and `costPerUnitMinor` are DERIVED fields — they're kept
 * in sync by transactions in inventoryService.ts (recordPurchase/recordWaste/
 * recordAdjustment), never edited directly except at creation (opening stock
 * + starting cost) or via the explicit "Adjust Stock" action. Never write to
 * these fields from anywhere else, or the stock ledger stops being the
 * source of truth for how they got to their current value.
 *
 * `costPerUnitMinor` uses the "last cost" method: it's set to whatever the
 * most recent purchase's unit cost was. This is simpler than a weighted
 * moving average and good enough for a single small-to-medium restaurant;
 * see PHASE_4_REPORT.md for the tradeoff if this ever needs to change.
 */
export interface Ingredient {
  ingredientId: string;
  restaurantId: string;
  name: string;
  category: string | null;
  unit: IngredientUnit;
  costPerUnitMinor: number;
  currentStockQty: number;
  reorderLevel: number | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateIngredientInput {
  name: string;
  category?: string;
  unit: IngredientUnit;
  costPerUnitMinor: number;
  openingStockQty?: number;
  reorderLevel?: number;
}

export interface UpdateIngredientInput {
  name: string;
  category?: string;
  unit: IngredientUnit;
  costPerUnitMinor: number;
  reorderLevel?: number;
}

export type StockLedgerEntryType = 'purchase' | 'waste' | 'adjustment';

/**
 * Ledger document stored at: restaurants/{restaurantId}/stockLedger/{entryId}
 * IMMUTABLE — created once by a transaction in inventoryService.ts alongside
 * the matching update to the ingredient's currentStockQty (and
 * costPerUnitMinor, for purchases). Never updated or deleted; correcting a
 * mistake means recording an offsetting adjustment entry, not editing
 * history — same audit-trail philosophy as restaurantUsers/restaurants
 * elsewhere in this app.
 *
 * `quantity` is always POSITIVE — the sign of its effect on stock is implied
 * by `type` (purchase/adjustment-in increases stock, waste/adjustment-out
 * decreases it) and, for adjustments specifically, by `adjustmentDirection`.
 */
export interface StockLedgerEntry {
  entryId: string;
  restaurantId: string;
  ingredientId: string;
  ingredientName: string; // denormalized at write time, so the ledger reads fine even if the ingredient is later renamed or archived
  type: StockLedgerEntryType;
  quantity: number;
  unit: IngredientUnit; // denormalized, same reason as ingredientName
  // purchase-only fields
  unitCostMinor: number | null;
  totalCostMinor: number | null;
  vendorName: string | null;
  expiryDate: Timestamp | null;
  // waste-only field
  wasteReason: WasteReason | null;
  // adjustment-only field
  adjustmentDirection: 'increase' | 'decrease' | null;
  note: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: Timestamp;
}

export interface RecordPurchaseInput {
  ingredientId: string;
  quantity: number;
  unitCostMinor: number;
  vendorName?: string;
  expiryDate?: Date;
  note?: string;
}

export interface RecordWasteInput {
  ingredientId: string;
  quantity: number;
  reason: WasteReason;
  note?: string;
}

export interface RecordAdjustmentInput {
  ingredientId: string;
  newStockQty: number;
  note: string;
}
