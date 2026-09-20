import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import type {
  CreateExpenseCategoryInput,
  Expense,
  ExpenseCategory,
  RecurringExpenseTemplate,
  SaveExpenseInput,
  SaveRecurringExpenseTemplateInput,
} from '../types';

const categoriesCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'expenseCategories');
const expensesCol = (restaurantId: string) => collection(db, 'restaurants', restaurantId, 'expenses');
const recurringTemplatesCol = (restaurantId: string) =>
  collection(db, 'restaurants', restaurantId, 'recurringExpenseTemplates');

export async function listExpenseCategories(restaurantId: string): Promise<ExpenseCategory[]> {
  const q = query(categoriesCol(restaurantId), orderBy('displayOrder', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<ExpenseCategory, 'categoryId'>), categoryId: d.id }));
}

export async function createExpenseCategory(restaurantId: string, input: CreateExpenseCategoryInput): Promise<void> {
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

export async function updateExpenseCategory(restaurantId: string, categoryId: string, input: CreateExpenseCategoryInput): Promise<void> {
  const ref = doc(categoriesCol(restaurantId), categoryId);
  await updateDoc(ref, {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    displayOrder: input.displayOrder ?? 0,
    updatedAt: serverTimestamp(),
  });
}

export async function setExpenseCategoryActive(restaurantId: string, categoryId: string, isActive: boolean): Promise<void> {
  const ref = doc(categoriesCol(restaurantId), categoryId);
  await updateDoc(ref, { isActive, updatedAt: serverTimestamp() });
}

/** Refuses to delete a category with expenses still assigned to it — same "archive instead" guard as menu categories (see menuService.deleteCategory). */
export async function deleteExpenseCategory(restaurantId: string, categoryId: string): Promise<void> {
  const inCategory = await getDocs(query(expensesCol(restaurantId), where('categoryId', '==', categoryId), limit(1)));
  if (!inCategory.empty) {
    throw new AppError('This category still has expenses recorded against it. Archive it instead, or reassign those expenses first.');
  }
  await deleteDoc(doc(categoriesCol(restaurantId), categoryId));
}

/** Most-recent-first expense list, filtered client-side in the UI by date range/category — same "small enough, avoid another index" reasoning as Phase 3's menu queries and Phase 4's stock ledger pull. */
export async function listExpenses(restaurantId: string, max = 500): Promise<Expense[]> {
  const q = query(expensesCol(restaurantId), orderBy('expenseDate', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Expense, 'expenseId'>), expenseId: d.id }));
}

/** All expenses on one specific day — a single equality filter on the plain `expenseDate` string, same shape as Phase 5's `listDailySales`, no composite index needed. Used by the Sales Report to fold same-day expenses into a net-profit figure. */
export async function listExpensesForDate(restaurantId: string, date: string): Promise<Expense[]> {
  const q = query(expensesCol(restaurantId), where('expenseDate', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Expense, 'expenseId'>), expenseId: d.id }));
}

/**
 * Every expense (voided or not — the caller filters) across a date range
 * (inclusive), used by the P&L report. A range filter plus an `orderBy` on
 * that same field (`expenseDate`) — same index-free shape as
 * `salesService.listDailySalesForRange`, no composite index needed.
 */
export async function listExpensesForRange(restaurantId: string, startDate: string, endDate: string): Promise<Expense[]> {
  const q = query(
    expensesCol(restaurantId),
    where('expenseDate', '>=', startDate),
    where('expenseDate', '<=', endDate),
    orderBy('expenseDate', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Expense, 'expenseId'>), expenseId: d.id }));
}

/** `categoriesById` is the already-loaded category list (the caller, ExpensesPage, already has it), used to resolve the denormalized `categoryName`. */
export async function createExpense(
  restaurantId: string,
  input: SaveExpenseInput,
  categoriesById: Map<string, ExpenseCategory>,
  createdBy: { userId: string; name: string },
): Promise<void> {
  const category = categoriesById.get(input.categoryId);
  if (!category) throw new AppError('That category could not be found — refresh and try again.');
  const now = serverTimestamp();
  await addDoc(expensesCol(restaurantId), {
    restaurantId,
    categoryId: input.categoryId,
    categoryName: category.name,
    amountMinor: input.amountMinor,
    expenseDate: input.expenseDate,
    vendorName: input.vendorName?.trim() || null,
    note: input.note?.trim() || null,
    receiptUrl: input.receiptUrl ?? null,
    isVoided: false,
    createdByUserId: createdBy.userId,
    createdByName: createdBy.name,
    createdAt: now,
    updatedAt: now,
  });
}

/** Full edit of an existing expense — corrects a typo in amount/date/category/etc. Does not touch `isVoided`; use setExpenseVoided for that. */
export async function updateExpense(
  restaurantId: string,
  expenseId: string,
  input: SaveExpenseInput,
  categoriesById: Map<string, ExpenseCategory>,
): Promise<void> {
  const category = categoriesById.get(input.categoryId);
  if (!category) throw new AppError('That category could not be found — refresh and try again.');
  const ref = doc(expensesCol(restaurantId), expenseId);
  await updateDoc(ref, {
    categoryId: input.categoryId,
    categoryName: category.name,
    amountMinor: input.amountMinor,
    expenseDate: input.expenseDate,
    vendorName: input.vendorName?.trim() || null,
    note: input.note?.trim() || null,
    receiptUrl: input.receiptUrl ?? null,
    updatedAt: serverTimestamp(),
  });
}

/** Voiding, not deleting — see the doc comment on Expense.isVoided. A voided expense stays visible (and un-voidable) rather than disappearing, so nothing about a day's numbers changes silently. */
export async function setExpenseVoided(restaurantId: string, expenseId: string, isVoided: boolean): Promise<void> {
  const ref = doc(expensesCol(restaurantId), expenseId);
  await updateDoc(ref, { isVoided, updatedAt: serverTimestamp() });
}

// ---------------------------------------------------------------------
// Recurring expense templates — Phase 13. See the doc comment on
// RecurringExpenseTemplate (src/types/expense.ts) for the design.
// ---------------------------------------------------------------------

export async function listRecurringExpenseTemplates(restaurantId: string): Promise<RecurringExpenseTemplate[]> {
  const q = query(recurringTemplatesCol(restaurantId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<RecurringExpenseTemplate, 'templateId'>), templateId: d.id }));
}

export async function createRecurringExpenseTemplate(
  restaurantId: string,
  input: SaveRecurringExpenseTemplateInput,
  categoriesById: Map<string, ExpenseCategory>,
): Promise<void> {
  const category = categoriesById.get(input.categoryId);
  if (!category) throw new AppError('That category could not be found — refresh and try again.');
  const now = serverTimestamp();
  await addDoc(recurringTemplatesCol(restaurantId), {
    restaurantId,
    categoryId: input.categoryId,
    categoryName: category.name,
    amountMinor: input.amountMinor,
    vendorName: input.vendorName?.trim() || null,
    note: input.note?.trim() || null,
    frequency: input.frequency,
    dayOfMonth: input.frequency === 'monthly' ? (input.dayOfMonth ?? 1) : null,
    dayOfWeek: input.frequency === 'weekly' ? (input.dayOfWeek ?? 0) : null,
    lastGeneratedDate: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateRecurringExpenseTemplate(
  restaurantId: string,
  templateId: string,
  input: SaveRecurringExpenseTemplateInput,
  categoriesById: Map<string, ExpenseCategory>,
): Promise<void> {
  const category = categoriesById.get(input.categoryId);
  if (!category) throw new AppError('That category could not be found — refresh and try again.');
  const ref = doc(recurringTemplatesCol(restaurantId), templateId);
  await updateDoc(ref, {
    categoryId: input.categoryId,
    categoryName: category.name,
    amountMinor: input.amountMinor,
    vendorName: input.vendorName?.trim() || null,
    note: input.note?.trim() || null,
    frequency: input.frequency,
    dayOfMonth: input.frequency === 'monthly' ? (input.dayOfMonth ?? 1) : null,
    dayOfWeek: input.frequency === 'weekly' ? (input.dayOfWeek ?? 0) : null,
    updatedAt: serverTimestamp(),
  });
}

export async function setRecurringExpenseTemplateActive(
  restaurantId: string,
  templateId: string,
  isActive: boolean,
): Promise<void> {
  const ref = doc(recurringTemplatesCol(restaurantId), templateId);
  await updateDoc(ref, { isActive, updatedAt: serverTimestamp() });
}

export async function deleteRecurringExpenseTemplate(restaurantId: string, templateId: string): Promise<void> {
  await deleteDoc(doc(recurringTemplatesCol(restaurantId), templateId));
}

/**
 * Called right after successfully logging an Expense from a template (see
 * `RecurringExpensesPage.tsx`) — records WHEN it was last logged so
 * `src/utils/recurrence.ts` can compute the next due date. `generatedDate`
 * is whatever date the user actually saved the expense with (usually
 * today, but they can backdate it), not necessarily the template's
 * previously-computed due date.
 */
export async function markRecurringExpenseGenerated(
  restaurantId: string,
  templateId: string,
  generatedDate: string,
): Promise<void> {
  const ref = doc(recurringTemplatesCol(restaurantId), templateId);
  await updateDoc(ref, { lastGeneratedDate: generatedDate, updatedAt: serverTimestamp() });
}
