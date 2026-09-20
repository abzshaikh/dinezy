import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import type {
  CreateIngredientInput,
  Ingredient,
  RecordAdjustmentInput,
  RecordPurchaseInput,
  RecordWasteInput,
  StockLedgerEntry,
  UpdateIngredientInput,
} from '../types';

const ingredientsCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'ingredients');
const stockLedgerCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'stockLedger');

/**
 * The stock ledger is the source of truth for every quantity/cost change on
 * an ingredient — `recordPurchase`/`recordWaste`/`recordAdjustment` below
 * are the ONLY places that should ever write `currentStockQty` or
 * `costPerUnitMinor` after creation. Each one uses a Firestore transaction
 * so the ledger entry and the ingredient's updated totals commit together or
 * not at all — same pattern as createRestaurant's batch write, just with a
 * transaction because these need to READ the current stock first to compute
 * the new total (a batch can't read).
 */

export async function listIngredients(restaurantId: string): Promise<Ingredient[]> {
  const q = query(ingredientsCol(restaurantId), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Ingredient, 'ingredientId'>), ingredientId: d.id }));
}

export async function createIngredient(
  restaurantId: string,
  input: CreateIngredientInput,
  createdBy: { userId: string; name: string },
): Promise<void> {
  const now = serverTimestamp();
  const ref = doc(ingredientsCol(restaurantId));
  const openingQty = input.openingStockQty ?? 0;

  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      ingredientId: ref.id,
      restaurantId,
      name: input.name.trim(),
      category: input.category?.trim() || null,
      unit: input.unit,
      costPerUnitMinor: input.costPerUnitMinor,
      currentStockQty: openingQty,
      reorderLevel: input.reorderLevel ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    if (openingQty > 0) {
      const ledgerRef = doc(stockLedgerCol(restaurantId));
      tx.set(ledgerRef, {
        entryId: ledgerRef.id,
        restaurantId,
        ingredientId: ref.id,
        ingredientName: input.name.trim(),
        type: 'adjustment',
        quantity: openingQty,
        unit: input.unit,
        unitCostMinor: null,
        totalCostMinor: null,
        vendorName: null,
        expiryDate: null,
        wasteReason: null,
        adjustmentDirection: 'increase',
        note: 'Opening stock',
        createdByUserId: createdBy.userId,
        createdByName: createdBy.name,
        createdAt: now,
      });
    }
  });
}

/** Master-data-only update — never touches currentStockQty/costPerUnitMinor's derivation (cost IS editable here directly, for correcting a typo; going forward it's normally kept current by recordPurchase). */
export async function updateIngredient(restaurantId: string, ingredientId: string, input: UpdateIngredientInput): Promise<void> {
  const ref = doc(ingredientsCol(restaurantId), ingredientId);
  await updateDoc(ref, {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    unit: input.unit,
    costPerUnitMinor: input.costPerUnitMinor,
    reorderLevel: input.reorderLevel ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function setIngredientActive(restaurantId: string, ingredientId: string, isActive: boolean): Promise<void> {
  const ref = doc(ingredientsCol(restaurantId), ingredientId);
  await updateDoc(ref, { isActive, updatedAt: serverTimestamp() });
}

/** Records a purchase: adds a stock-ledger entry, increases stock, and updates the ingredient's cost to this purchase's unit cost ("last cost" method — see the Ingredient type doc comment). */
export async function recordPurchase(
  restaurantId: string,
  input: RecordPurchaseInput,
  createdBy: { userId: string; name: string },
): Promise<void> {
  const ingredientRef = doc(ingredientsCol(restaurantId), input.ingredientId);
  const ledgerRef = doc(stockLedgerCol(restaurantId));
  const now = serverTimestamp();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ingredientRef);
    if (!snap.exists()) throw new AppError('That ingredient could not be found.');
    const ingredient = snap.data() as Ingredient;

    const totalCostMinor = Math.round(input.unitCostMinor * input.quantity);

    tx.set(ledgerRef, {
      entryId: ledgerRef.id,
      restaurantId,
      ingredientId: input.ingredientId,
      ingredientName: ingredient.name,
      type: 'purchase',
      quantity: input.quantity,
      unit: ingredient.unit,
      unitCostMinor: input.unitCostMinor,
      totalCostMinor,
      vendorName: input.vendorName?.trim() || null,
      expiryDate: input.expiryDate ? Timestamp.fromDate(input.expiryDate) : null,
      wasteReason: null,
      adjustmentDirection: null,
      note: input.note?.trim() || null,
      createdByUserId: createdBy.userId,
      createdByName: createdBy.name,
      createdAt: now,
    });

    tx.update(ingredientRef, {
      currentStockQty: ingredient.currentStockQty + input.quantity,
      costPerUnitMinor: input.unitCostMinor,
      updatedAt: now,
    });
  });
}

/** Records waste: adds a stock-ledger entry and decreases stock. Blocked from taking stock below zero. */
export async function recordWaste(
  restaurantId: string,
  input: RecordWasteInput,
  createdBy: { userId: string; name: string },
): Promise<void> {
  const ingredientRef = doc(ingredientsCol(restaurantId), input.ingredientId);
  const ledgerRef = doc(stockLedgerCol(restaurantId));
  const now = serverTimestamp();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ingredientRef);
    if (!snap.exists()) throw new AppError('That ingredient could not be found.');
    const ingredient = snap.data() as Ingredient;

    const newQty = ingredient.currentStockQty - input.quantity;
    if (newQty < 0) {
      throw new AppError(
        `Only ${ingredient.currentStockQty} ${ingredient.unit} of ${ingredient.name} in stock — can't waste ${input.quantity}. Use "Adjust Stock" first if the recorded stock is wrong.`,
      );
    }

    tx.set(ledgerRef, {
      entryId: ledgerRef.id,
      restaurantId,
      ingredientId: input.ingredientId,
      ingredientName: ingredient.name,
      type: 'waste',
      quantity: input.quantity,
      unit: ingredient.unit,
      unitCostMinor: null,
      totalCostMinor: null,
      vendorName: null,
      expiryDate: null,
      wasteReason: input.reason,
      adjustmentDirection: null,
      note: input.note?.trim() || null,
      createdByUserId: createdBy.userId,
      createdByName: createdBy.name,
      createdAt: now,
    });

    tx.update(ingredientRef, { currentStockQty: newQty, updatedAt: now });
  });
}

/** Manually corrects stock to a known quantity (e.g. after a physical count) — records the delta as an adjustment ledger entry, positive or negative. */
export async function recordAdjustment(
  restaurantId: string,
  input: RecordAdjustmentInput,
  createdBy: { userId: string; name: string },
): Promise<void> {
  const ingredientRef = doc(ingredientsCol(restaurantId), input.ingredientId);
  const ledgerRef = doc(stockLedgerCol(restaurantId));
  const now = serverTimestamp();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ingredientRef);
    if (!snap.exists()) throw new AppError('That ingredient could not be found.');
    const ingredient = snap.data() as Ingredient;

    const delta = input.newStockQty - ingredient.currentStockQty;
    if (delta === 0) {
      throw new AppError('That matches the current stock already — nothing to adjust.');
    }

    tx.set(ledgerRef, {
      entryId: ledgerRef.id,
      restaurantId,
      ingredientId: input.ingredientId,
      ingredientName: ingredient.name,
      type: 'adjustment',
      quantity: Math.abs(delta),
      unit: ingredient.unit,
      unitCostMinor: null,
      totalCostMinor: null,
      vendorName: null,
      expiryDate: null,
      wasteReason: null,
      adjustmentDirection: delta > 0 ? 'increase' : 'decrease',
      note: input.note.trim(),
      createdByUserId: createdBy.userId,
      createdByName: createdBy.name,
      createdAt: now,
    });

    tx.update(ingredientRef, { currentStockQty: input.newStockQty, updatedAt: now });
  });
}

/**
 * Most-recent-first ledger window across ALL ingredients — the Stock Ledger
 * and Waste/Purchases pages filter this client-side by type/ingredient
 * rather than adding more composite indexes. Fine at the scale of a single
 * restaurant's activity; a future phase should add pagination if this ever
 * needs to go back further than the most recent few hundred entries.
 */
export async function listRecentStockLedger(restaurantId: string, max = 300): Promise<StockLedgerEntry[]> {
  const q = query(stockLedgerCol(restaurantId), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<StockLedgerEntry, 'entryId'>), entryId: d.id }));
}

/**
 * Purchases with a future expiry date, soonest first. Needs a composite
 * index (stockLedger: type ASC, expiryDate ASC) since it filters on `type`
 * and orders by the different field `expiryDate` — see firestore.indexes.json
 * and PHASE_4_REPORT.md.
 */
export async function listUpcomingExpiry(restaurantId: string): Promise<StockLedgerEntry[]> {
  const q = query(
    stockLedgerCol(restaurantId),
    where('type', '==', 'purchase'),
    where('expiryDate', '>', Timestamp.fromDate(new Date(0))),
    orderBy('expiryDate', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<StockLedgerEntry, 'entryId'>), entryId: d.id }));
}

export async function fetchIngredient(restaurantId: string, ingredientId: string): Promise<Ingredient | null> {
  const snap = await getDoc(doc(ingredientsCol(restaurantId), ingredientId));
  return snap.exists() ? (snap.data() as Ingredient) : null;
}
