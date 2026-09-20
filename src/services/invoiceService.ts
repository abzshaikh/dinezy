import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import type { Invoice, MenuItem, Restaurant, SaveInvoiceInput } from '../types';

const restaurantsCol = () => collection(db, 'restaurants');
const invoicesCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'invoices');

function formatInvoiceNumber(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(4, '0')}`;
}

/**
 * Creates an invoice AND atomically bumps the restaurant's
 * `settings.nextInvoiceNumber` counter, in one Firestore transaction — same
 * read-current-value-then-write-both-docs shape as
 * inventoryService.recordPurchase's stock-ledger + ingredient update. This
 * is the one place client-side that must never let two invoices land on
 * the same number, which a plain batch write (no read) couldn't guarantee.
 *
 * `menuItemsById` is the CURRENT menu, already loaded by the page (same
 * data DailySalesPage already fetches) — line item name/price are snapshot
 * from it into the invoice at this moment; a later menu price change never
 * rewrites an already-issued invoice.
 */
export async function createInvoice(
  restaurantId: string,
  input: SaveInvoiceInput,
  menuItemsById: Map<string, MenuItem>,
  createdBy: { userId: string; name: string },
): Promise<Invoice> {
  const lineItems = input.lineItems
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const item = menuItemsById.get(l.menuItemId);
      if (!item) throw new AppError('One of the selected menu items could not be found.');
      const lineTotalMinor = Math.round(item.priceMinor * l.quantity);
      return {
        menuItemId: item.itemId,
        menuItemName: item.name,
        unitPriceMinor: item.priceMinor,
        quantity: l.quantity,
        lineTotalMinor,
      };
    });

  if (lineItems.length === 0) {
    throw new AppError('Add at least one item with a quantity greater than 0.');
  }

  const restaurantRef = doc(restaurantsCol(), restaurantId);
  const invoiceRef = doc(invoicesCol(restaurantId));
  const now = serverTimestamp();

  await runTransaction(db, async (tx) => {
    const restaurantSnap = await tx.get(restaurantRef);
    if (!restaurantSnap.exists()) throw new AppError('Restaurant could not be found.');
    const restaurant = restaurantSnap.data() as Restaurant;
    const { settings } = restaurant;

    const subtotalMinor = lineItems.reduce((sum, l) => sum + l.lineTotalMinor, 0);
    const serviceChargeMinor = Math.round((subtotalMinor * settings.serviceChargePercent) / 100);
    // GST is applied on (subtotal + service charge) — the common convention
    // for Indian restaurant billing, since service charge (where levied) is
    // treated as part of the taxable supply value. This is a documented,
    // deliberate choice, not tax advice — see PHASE_16_REPORT.md.
    const gstMinor = Math.round(((subtotalMinor + serviceChargeMinor) * settings.gstPercent) / 100);
    const totalMinor = subtotalMinor + serviceChargeMinor + gstMinor;

    const invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, settings.nextInvoiceNumber);

    const invoiceData = {
      invoiceId: invoiceRef.id,
      restaurantId,
      invoiceNumber,
      invoiceDate: new Date().toISOString().slice(0, 10),
      customerName: input.customerName?.trim() || null,
      note: input.note?.trim() || null,
      lineItems,
      subtotalMinor,
      serviceChargePercent: settings.serviceChargePercent,
      serviceChargeMinor,
      gstPercent: settings.gstPercent,
      gstMinor,
      totalMinor,
      status: 'issued' as const,
      voidedAt: null,
      voidedReason: null,
      voidedByUserId: null,
      createdByUserId: createdBy.userId,
      createdByName: createdBy.name,
      createdAt: now,
      updatedAt: now,
    };

    tx.set(invoiceRef, invoiceData);
    tx.update(restaurantRef, {
      settings: { ...settings, nextInvoiceNumber: settings.nextInvoiceNumber + 1 },
      updatedAt: now,
    });
  });

  // Read the committed doc back rather than reusing the local object built
  // above — that object's createdAt/updatedAt are still unresolved
  // serverTimestamp() sentinels at this point, not real Timestamps.
  const committed = await getDoc(invoiceRef);
  if (!committed.exists()) throw new AppError('Invoice was created but could not be loaded back.');
  return committed.data() as Invoice;
}

/** Every invoice ever issued for a restaurant, newest first. */
export async function listInvoices(restaurantId: string): Promise<Invoice[]> {
  const q = query(invoicesCol(restaurantId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Invoice);
}

/** Voids an invoice — never a hard delete, never an edit of its amounts. Void and issue a fresh one to correct a mistake. */
export async function voidInvoice(restaurantId: string, invoiceId: string, reason: string, voidedBy: string): Promise<void> {
  await updateDoc(doc(invoicesCol(restaurantId), invoiceId), {
    status: 'voided',
    voidedAt: serverTimestamp(),
    voidedReason: reason.trim() || null,
    voidedByUserId: voidedBy,
    updatedAt: serverTimestamp(),
  });
}
