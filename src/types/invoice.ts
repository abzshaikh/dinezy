import type { Timestamp } from 'firebase/firestore';

export type InvoiceStatus = 'issued' | 'voided';

/** One line on an invoice — SNAPSHOTS the menu item's name/price at the moment of billing, same snapshot-vs-live split as DailySalesEntry (see the project doc's "Recipe cost vs historical sales" note). A later menu price change never rewrites a past invoice. */
export interface InvoiceLineItem {
  menuItemId: string;
  menuItemName: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}

/**
 * Invoice document stored at: restaurants/{restaurantId}/invoices/{invoiceId}
 *
 * `invoiceNumber` is assigned atomically from the restaurant's
 * `settings.invoicePrefix`/`nextInvoiceNumber` counter (see
 * createInvoice() in invoiceService.ts) — a Firestore transaction reads the
 * current counter, computes this invoice's number, writes the invoice, and
 * bumps the counter in the SAME transaction, so two invoices created at
 * (near-)the same instant can never collide on the same number.
 *
 * `gstPercent`/`serviceChargePercent` are SNAPSHOTTED from
 * RestaurantSettings at issue time, same reasoning as the line items' price
 * snapshot — if the restaurant's tax rate changes later, an already-issued
 * invoice keeps showing the rate that was actually charged.
 *
 * Once issued, an invoice's amounts/line items are IMMUTABLE — the only
 * state change allowed is issued -> voided (see firestore.rules). A mistake
 * is corrected by voiding and creating a fresh invoice, never by editing a
 * numbered financial document in place — same "never silently rewrite
 * financial history" principle as the stockLedger/restaurantUsers
 * append-only pattern, applied to the one collection in this app that's
 * closest to a real legal document.
 */
export interface Invoice {
  invoiceId: string;
  restaurantId: string;
  invoiceNumber: string;
  invoiceDate: string; // yyyy-MM-dd, same plain-string convention as DailySalesEntry.date/Expense.expenseDate
  customerName: string | null;
  note: string | null;
  lineItems: InvoiceLineItem[];
  subtotalMinor: number;
  serviceChargePercent: number;
  serviceChargeMinor: number;
  gstPercent: number;
  gstMinor: number;
  totalMinor: number;
  status: InvoiceStatus;
  voidedAt: Timestamp | null;
  voidedReason: string | null;
  voidedByUserId: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** One line of user input for creating an invoice — just item + quantity; price/name are looked up from the live menu at save time (see createInvoice()). */
export interface InvoiceLineInput {
  menuItemId: string;
  quantity: number;
}

export interface SaveInvoiceInput {
  customerName?: string;
  note?: string;
  lineItems: InvoiceLineInput[];
}
