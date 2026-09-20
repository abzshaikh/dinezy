# Phase 6 Report — Expenses & Net Profit

## Why this phase, and why now

You said "continue with what you think is best," so here's the reasoning:
Phase 5 gave you gross profit per item (revenue minus food cost) with a
"most profitable items" report. The natural next gap was everything else
that eats into that — rent, utilities, salaries, and other operating
costs — which the app already had permission keys and even disabled nav
placeholders for ("Expenses", "Expense Categories") but nothing behind
them. Building Expenses next, and folding it into the Sales Report as a
same-day Net Profit figure, is the smallest step that turns "most
profitable items" into an actual daily profit picture, without touching
anything you didn't ask for (still no automatic stock deduction, still no
Orders/POS, still no Suppliers).

## What was implemented

- **Expense Categories** — a simple category list (Rent, Utilities,
  Salaries, etc.), same create/edit/archive/delete-if-empty pattern as
  Menu Categories.
- **Expenses** — log an expense: category, amount, date, optional
  vendor and note. Unlike Phase 4's Purchases/Waste (append-only,
  never edited), an expense CAN be edited after the fact — you can fix a
  typo in the amount or date. It can never be hard-deleted, though — a
  mistake that shouldn't count at all gets **voided** instead (a
  reversible flag, same idea as archiving a menu item), so a day's expense
  total never changes silently without a visible trace.
- **Expenses list** — filterable by date-range preset (Today/This
  Week/This Month/Last Month) and category, with a running total for the
  selected range, and a toggle to show/hide voided entries.
- **Sales Report, extended** — the day you select on the Sales Report now
  also shows that day's total expenses and a **Net Profit** figure (gross
  profit minus that day's expenses), sitting alongside the existing
  Revenue/Food Cost/Gross Profit stats. The existing "Most Profitable
  Items" ranking is unchanged (still per-item food-cost profit) — a
  caption now clarifies it's not the same number as Net Profit, since
  Net Profit is a whole-day figure that also subtracts expenses, not
  something that can be attributed to one menu item.

## Files created

- `src/types/expense.ts` — `ExpenseCategory`, `CreateExpenseCategoryInput`,
  `Expense`, `SaveExpenseInput`.
- `src/services/expenseService.ts` — category CRUD, `listExpenses`,
  `listExpensesForDate`, `createExpense`, `updateExpense`,
  `setExpenseVoided`.
- `src/features/expenses/ExpenseCategoriesPage.tsx` /
  `ExpenseCategoryFormDialog.tsx` — category management (mirrors Menu
  Categories exactly).
- `src/features/expenses/ExpensesPage.tsx` / `ExpenseFormDialog.tsx` —
  the expense list/filters and the log-an-expense form.

## Files modified

- `src/types/index.ts` — added the expense type module export.
- `src/utils/validation.ts` — added `expenseCategorySchema`, `expenseSchema`.
- `src/app/navConfig.ts` — enabled "Expenses" and "Expense Categories"
  (both existed as disabled placeholders since Phase 1).
- `src/App.tsx` — added `/app/expenses/list` and `/app/expenses/categories`
  routes.
- `src/features/reports/SalesReportPage.tsx` — added the Expenses/Net
  Profit stat cards and the disambiguating caption on "Most Profitable
  Items" (see above).
- `firestore.rules` — added `expenseCategories` and `expenses` subcollection
  rules (see below). **No new permission keys** —
  `expense.view`/`expense.create`/`expense.edit` already existed in
  `src/types/permissions.ts` from Phase 1, unused until now.
  `rolePermissions()` needed no changes.

## Database collections affected

- `restaurants/{restaurantId}/expenseCategories/{categoryId}` (new
  subcollection).
- `restaurants/{restaurantId}/expenses/{expenseId}` (new subcollection).

No changes to `firestore.indexes.json`. `listExpenses` orders on a single
field (`expenseDate` desc) with no filter; `listExpensesForDate` filters on
a single field (`expenseDate ==`) with no `orderBy` — both are covered by
Firestore's automatic single-field indexing, same index-avoidance approach
as Phase 3 and Phase 5.

## Business logic worth noting

- **`expenseDate` is a plain `yyyy-MM-dd` string, not a Firestore
  Timestamp** — a deliberate departure from Phase 4's `expiryDate`
  (`Timestamp`). The reasoning: this field is always compared at day
  granularity (does this expense fall on the day the Sales Report is
  showing), never as a precise moment in time, so a plain sortable string
  matches Phase 5's `DailySalesEntry.date` convention and lets
  `listExpensesForDate` use the exact same cheap single-equality-filter
  query shape as `listDailySales`, with no timezone-conversion pitfalls.
- **Expenses are editable but never hard-deleted — a third pattern,
  distinct from both of this app's existing history conventions.** The
  stock ledger (Phase 4) is fully append-only: no edit, no delete, ever.
  Daily Sales (Phase 5) is edit-in-place with no delete. Expenses land
  in between: full edit access (`expense.edit`, for fixing a typed-in
  mistake) PLUS a reversible `isVoided` flag (for "this shouldn't count
  at all") instead of a delete button — mirroring the Archive/Restore UX
  already familiar from Menu Items/Categories and Ingredients, just named
  "voided" because that's the standard bookkeeping term for a cancelled
  entry. `firestore.rules` enforces `allow delete: if false` on `expenses`
  so this can't be bypassed even by a client bug.
- **Category management (`expense.edit`) is a different permission than
  logging an expense (`expense.create`) — intentional, and it already
  matched the existing role table with zero changes.** Looking at
  `ROLE_PERMISSIONS`: `manager` has `expense.view`/`expense.create` but
  NOT `expense.edit` — a manager can log today's expenses but can't
  restructure categories or correct someone else's entry. `accountant`
  has all three. This wasn't planned specifically for this feature, but
  fell out naturally from the Phase-1-era permission table, same story as
  Phase 5's `recipes.edit`/`orders.create` alignment.
- **Net Profit on the Sales Report degrades gracefully by permission.**
  Someone with `reports.financial` but not `expense.view` still sees
  Revenue/Food Cost/Gross Profit — the Expenses/Net Profit cards, and the
  query behind them, are skipped entirely (the query only runs when
  `canSeeExpenses` is true) rather than showing a permission error. This
  avoids a confusing partial-failure state on a page that's otherwise
  fully functional for that role.
- **"Net Profit" is still not a full P&L.** It's gross profit (revenue
  minus food cost, per Phase 5) minus that single day's logged expenses —
  it doesn't allocate monthly costs like rent across days, doesn't include
  payroll taxes or depreciation, and isn't the inventory-formula COGS
  (Beginning+Purchases−Ending) the architecture notes describe for a
  future dedicated P&L phase. Treat it as a useful daily signal, not your
  official numbers.

## Assumptions

- **A category delete is blocked if any expense (voided or not)
  references it** — same "archive instead" guard as Menu Categories, to
  avoid a dangling `categoryId` on historical records (even though
  `categoryName` is denormalized, so old records would still *display*
  fine — this guard is about keeping the data model tidy, not display
  correctness).
- **`listExpenses` pulls the most recent 500** by default, filtered
  client-side by date-range preset and category — fine at the scale of a
  single restaurant's expense volume, same tradeoff as Phase 4's stock
  ledger pull. A restaurant logging expenses for years without ever
  archiving old ones would eventually want pagination here.
- **No receipt/attachment upload** — an expense is category + amount +
  date + optional vendor/note only, no photo of the receipt. Cloudinary is
  already wired up for images elsewhere in the app (menu item photos), so
  adding a receipt photo field later is a small, well-trodden addition if
  you want it.
- **No recurring expenses** (e.g. "rent, every month automatically") —
  each expense is logged individually. Worth a future phase if monthly
  entry becomes tedious.

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress blocks `firestore.googleapis.com`, so none of this could be
  exercised live against your real Firebase project from inside this
  environment. Build and typecheck are clean; live verification needs to
  happen on your machine (see below).
- The Net Profit figure only accounts for expenses logged with today's
  exact `expenseDate` — an expense logged against the wrong date won't
  show up in that day's Net Profit until corrected (via edit, which this
  phase supports).

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same 5 pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 6 code.

## How to verify on your machine

1. `npm install` (only if you haven't already).
2. Deploy the updated rules: `firebase deploy --only firestore:rules --project restaurant-management-553db`
   (no new composite indexes this phase).
3. `npm run dev`, log in as the restaurant owner, open **Expenses →
   Expense Categories**. Create a couple of categories (e.g. Rent,
   Utilities).
4. Open **Expenses → Expenses**, log a couple of expenses against today's
   date and a couple against an earlier date, in different categories.
   Confirm the date-range/category filters and the running total work.
5. Edit one expense (change its amount), and void another. Confirm the
   voided one shows the "Voided" chip, strikethrough amount, and drops out
   of the total unless "Show voided" is on — and that a voided expense
   can be restored.
6. Try deleting a category that still has expenses against it — confirm
   you get the friendly "archive instead" error rather than a raw
   Firestore error.
7. Open **Reports → Sales Report** for the day you logged today's
   expenses against. Confirm the Expenses and Net Profit cards appear and
   the math checks out (Net Profit = Gross Profit − Expenses).
8. If you have a second test account with a role that has
   `reports.financial` but not `expense.view` (none of the current fixed
   roles are shaped exactly this way — you'd need a permission override to
   test it), confirm the Expenses/Net Profit cards are simply absent
   rather than erroring.
