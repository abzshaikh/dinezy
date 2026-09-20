import type { Timestamp } from 'firebase/firestore';

/**
 * A day's tally of how many of one menu item sold — entered by hand at the
 * end of the day. Per the user's explicit direction, Phase 5 does NOT wire
 * sales to automatic ingredient-stock deduction: the restaurant already
 * corrects/counts its ingredient stock manually at day's end (Phase 4's
 * Adjust Stock), and keeping that as the one place stock changes avoids
 * two competing sources of truth for "how much stock is left" fighting
 * each other. This collection exists purely to answer "what sold, and
 * what was profitable" — see the Sales Report page.
 *
 * ONE doc per (date, menuItem), doc ID `{date}_{menuItemId}` — re-saving
 * the same day for the same item overwrites/corrects it rather than piling
 * up duplicate entries. This is a running daily total the restaurant edits
 * as needed, not an append-only event log like Phase 4's stock ledger, so
 * there's no `createdAt` here — only `updatedAt` (when this day's number
 * was last entered or corrected).
 *
 * `unitPriceMinor`/`unitCostMinor` are snapshotted at SAVE time (the menu
 * item's price and the recipe's live-computed cost as of that moment) so a
 * later price change or recipe edit never rewrites a past day's numbers —
 * same "snapshot what mattered at the time" principle as everywhere else
 * money is recorded in this app. `hasRecipe` is false when the item had no
 * recipe defined yet when this entry was saved; its cost/profit are then
 * meaningless and stored as 0 rather than a misleading number — the Sales
 * Report excludes these from the "most profitable" ranking.
 */
export interface DailySalesEntry {
  entryId: string; // `${date}_${menuItemId}`
  restaurantId: string;
  date: string; // 'yyyy-MM-dd'
  menuItemId: string;
  menuItemName: string;
  quantitySold: number;
  unitPriceMinor: number;
  unitCostMinor: number;
  revenueMinor: number;
  costMinor: number;
  profitMinor: number;
  hasRecipe: boolean;
  recordedByUserId: string;
  recordedByName: string;
  updatedAt: Timestamp;
}

export interface DailySalesLineInput {
  menuItemId: string;
  menuItemName: string;
  quantitySold: number;
  unitPriceMinor: number;
  unitCostMinor: number;
  hasRecipe: boolean;
}
