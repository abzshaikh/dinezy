import { collection, doc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DailySalesEntry, DailySalesLineInput } from '../types';

const dailySalesCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'dailySales');

/** All entries for one day (across every menu item) — powers both the Daily Sales entry page (pre-filling what's already been recorded) and the Sales Report. A single equality filter on `date`, no `orderBy` — Firestore's automatic single-field index covers this, no composite index needed (same index-avoidance approach as Phase 3). */
export async function listDailySales(restaurantId: string, date: string): Promise<DailySalesEntry[]> {
  const q = query(dailySalesCol(restaurantId), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<DailySalesEntry, 'entryId'>), entryId: d.id }));
}

/**
 * Every entry across a date range (inclusive), used by the P&L report to sum
 * revenue/cost over more than one day. A range filter (`>=`/`<=`) plus an
 * `orderBy` on that SAME field (`date`) — still covered by Firestore's
 * automatic single-field index, no composite index needed (the rule that's
 * held since Phase 3: a composite index is only required when the filtered
 * field and the ordered field differ).
 */
export async function listDailySalesForRange(
  restaurantId: string,
  startDate: string,
  endDate: string,
): Promise<DailySalesEntry[]> {
  const q = query(
    dailySalesCol(restaurantId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<DailySalesEntry, 'entryId'>), entryId: d.id }));
}

/**
 * Upserts one day's tally, one doc per menu item, doc ID `{date}_{menuItemId}`.
 * A plain `writeBatch`, not a transaction — unlike inventoryService's stock
 * changes, there's no "read the current value first" dependency here; each
 * line is a straight overwrite of that day's number for that item, computed
 * from the snapshot values the caller (DailySalesPage) already resolved
 * from its loaded menu items / recipes.
 */
export async function saveDailySales(
  restaurantId: string,
  date: string,
  lines: DailySalesLineInput[],
  recordedBy: { userId: string; name: string },
): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  for (const line of lines) {
    const entryId = `${date}_${line.menuItemId}`;
    const ref = doc(dailySalesCol(restaurantId), entryId);
    const revenueMinor = Math.round(line.unitPriceMinor * line.quantitySold);
    const costMinor = line.hasRecipe ? Math.round(line.unitCostMinor * line.quantitySold) : 0;

    batch.set(ref, {
      entryId,
      restaurantId,
      date,
      menuItemId: line.menuItemId,
      menuItemName: line.menuItemName,
      quantitySold: line.quantitySold,
      unitPriceMinor: line.unitPriceMinor,
      unitCostMinor: line.hasRecipe ? line.unitCostMinor : 0,
      revenueMinor,
      costMinor,
      profitMinor: revenueMinor - costMinor,
      hasRecipe: line.hasRecipe,
      recordedByUserId: recordedBy.userId,
      recordedByName: recordedBy.name,
      updatedAt: now,
    });
  }

  await batch.commit();
}
