import type { Timestamp } from 'firebase/firestore';

/**
 * Category document stored at: restaurants/{restaurantId}/expenseCategories/{categoryId}
 * Same shape/purpose as MenuCategory (src/types/menu.ts) — purely
 * organizational, groups expenses for the category breakdown on the
 * Expenses page. Deleting a category with expenses still assigned to it is
 * blocked client-side (see expenseService.deleteExpenseCategory), same
 * "archive instead" guard as menu categories.
 */
export interface ExpenseCategory {
  categoryId: string;
  restaurantId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateExpenseCategoryInput {
  name: string;
  description?: string;
  displayOrder?: number;
}

/**
 * Expense document stored at: restaurants/{restaurantId}/expenses/{expenseId}
 * `categoryName` is denormalized at write time (same pattern as everywhere
 * else in this app) so a historical expense still reads correctly if its
 * category is later renamed or archived.
 *
 * `expenseDate` is a plain `yyyy-MM-dd` string, NOT a Firestore Timestamp —
 * deliberately matching Phase 5's `DailySalesEntry.date` convention rather
 * than Phase 4's `Timestamp`-based `expiryDate`. The reason: this field is
 * always compared at day granularity (which day was this expense on, does
 * it match the Sales Report's selected day) never as a precise moment in
 * time, and a plain sortable string lets `listExpensesForDate` use the same
 * cheap single-equality-filter query Phase 5 uses for `listDailySales`,
 * with no timezone-conversion pitfalls and no composite index.
 *
 * `isVoided` is this collection's "correction" mechanism — same role as
 * `isActive` on MenuItem/Ingredient, named differently because "voided" is
 * the standard bookkeeping term for a cancelled financial entry. An expense
 * is never hard-deleted (see firestore.rules): mistakes are corrected by
 * editing the record (createExpense/updateExpense keep full edit access)
 * or, if it should never have been counted at all, voiding it — which
 * excludes it from totals without erasing the record.
 *
 * `receiptUrl` (Phase 12) is an optional Cloudinary-hosted photo of the
 * physical receipt/invoice, same "store the hosted URL, never the raw
 * file" pattern as every other image in this app (menu item photos,
 * restaurant logo, profile photo). Photo only, not PDF — see
 * `PHASE_12_REPORT.md` for why (the existing Cloudinary upload preset and
 * `uploadImage()` helper are image-only; most receipts are phone photos
 * anyway).
 */
export interface Expense {
  expenseId: string;
  restaurantId: string;
  categoryId: string;
  categoryName: string;
  amountMinor: number;
  expenseDate: string; // 'yyyy-MM-dd'
  vendorName: string | null;
  note: string | null;
  receiptUrl: string | null;
  isVoided: boolean;
  createdByUserId: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SaveExpenseInput {
  categoryId: string;
  amountMinor: number;
  expenseDate: string;
  vendorName?: string;
  note?: string;
  receiptUrl?: string | null;
}

/**
 * `recurringExpenseTemplates` (Phase 13) — a SAVED SHAPE for a
 * periodically-recurring cost (rent, a subscription), not itself a
 * financial record. Logging the actual expense is still an explicit,
 * editable action (see `RecurringExpensesPage.tsx`'s "Log expense" flow) —
 * consistent with this app's established manual-entry philosophy (Phase
 * 5's manual EOD stock deduction, no Orders/POS): nothing here silently
 * creates an `Expense` document on a schedule. There's no backend cron
 * available on this project's Spark billing plan anyway (Cloud Functions
 * need Blaze), so a template just tells the UI "this is due" and prefills
 * the New Expense form — the user still reviews and clicks Save.
 *
 * `dayOfMonth`/`dayOfWeek`: only one is meaningful, depending on
 * `frequency`. `dayOfMonth` (1-31) is clamped to the last real day of a
 * shorter month when computing due dates (e.g. 31 in February -> the
 * 28th/29th) — same convention most billing systems use, rather than
 * skipping the month or rolling into the next one.
 *
 * `lastGeneratedDate` (`yyyy-MM-dd` or null) is the ONLY piece of state
 * this template tracks — the next due date is always DERIVED from it (see
 * `src/utils/recurrence.ts`), never stored, so it can't drift out of sync
 * with `frequency`/`dayOfMonth`/`dayOfWeek` if those are edited later.
 */
export type RecurrenceFrequency = 'weekly' | 'monthly';

export interface RecurringExpenseTemplate {
  templateId: string;
  restaurantId: string;
  categoryId: string;
  categoryName: string;
  amountMinor: number;
  vendorName: string | null;
  note: string | null;
  frequency: RecurrenceFrequency;
  dayOfMonth: number | null; // 1-31, used when frequency === 'monthly'
  dayOfWeek: number | null; // 0 (Sun) - 6 (Sat), used when frequency === 'weekly'
  lastGeneratedDate: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SaveRecurringExpenseTemplateInput {
  categoryId: string;
  amountMinor: number;
  vendorName?: string;
  note?: string;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
}
