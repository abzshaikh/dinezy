# Phase 7 Report — Profit & Loss Report

## Why this phase, and why now

You said "i dont want suppliers at all....we can have a fuller P&L phase
now" — two decisions in one sentence. First, Suppliers (which had been
deliberately deferred, not built, since Phase 4) is now permanently out of
scope — it will not appear in a future phase either. Second, the Sales
Report's "Net Profit" figure (Phase 6) was always a single-day number with
a documented caveat that it wasn't a real P&L. This phase builds the fuller
version you asked for: a proper date-range Profit & Loss statement.

## What was implemented

- **Profit & Loss report** (`Reports → Profit & Loss`) — a statement over a
  date range you choose (Today / This Week / This Month / Last Month / This
  Year, or a custom From–To range), showing:
  - **Revenue** — total from Daily Sales entries in the range.
  - **Food cost (COGS)** — the recipe-based cost of what was sold, summed
    across the range (the same per-entry `costMinor` Phase 5 already
    computes and stores on each Daily Sales entry).
  - **Gross profit** and **gross margin %**.
  - **Expenses**, broken down by category (amount, count, % of total), plus
    a grand total, for the same range.
  - **Net profit** and **net margin %** (gross profit minus total expenses).
  - A caveat banner when any sold item in the range has no recipe (its cost
    isn't included), same pattern as the Sales Report.
- Stat cards up top for a quick read, plus a full itemized statement below
  (revenue → food cost → gross profit → expense breakdown → net profit) and
  a table of expenses by category.
- Permission gating mirrors the Sales Report: the whole page needs
  `reports.financial`; without it, you get a message instead of numbers. If
  you have `reports.financial` but not `expense.view`, you still see
  Revenue/Food Cost/Gross Profit — the expense and net-profit sections are
  simply omitted (not shown as an error), with a note explaining why.

## Files created

- `src/features/reports/PnLPage.tsx` — the report itself.

## Files modified

- `src/services/salesService.ts` — added `listDailySalesForRange(restaurantId, startDate, endDate)`.
- `src/services/expenseService.ts` — added `listExpensesForRange(restaurantId, startDate, endDate)`.
- `src/app/navConfig.ts` — enabled the "Profit & Loss" nav item (it already
  existed as a disabled placeholder since Phase 1).
- `src/App.tsx` — added the `/app/reports/pnl` route.
- `firestore.rules` — file-header comment only, noting Phase 7 and the
  permanent Suppliers exclusion. **No new match blocks, no new permission
  keys** — this report only reads the existing `dailySales` and `expenses`
  subcollections, governed by the same `reports.financial`/`expense.view`
  rules Phases 5 and 6 already put in place.

## Database collections affected

None — no new collections, no schema changes. This phase is purely a new
read-only view over `restaurants/{restaurantId}/dailySales` and
`restaurants/{restaurantId}/expenses`.

No changes to `firestore.indexes.json`. Both new range queries filter on a
single field with `>=`/`<=` and `orderBy` on that **same** field (`date` /
`expenseDate`) — Firestore's automatic single-field index covers a range
filter plus an orderBy on the same field, same as every prior phase's
index-avoidance. No composite index needed, and nothing new to deploy.

## Business logic worth noting

- **Food cost here is recipe-based only — not the inventory-formula COGS
  (Beginning stock + Purchases − Ending stock) mentioned in earlier
  architecture notes.** This is a deliberate scope decision, not an
  oversight. You told me in Phase 5 that ingredient stock deduction is
  manual and happens at the end of the day, specifically so stock numbers
  stay simple and correct — building an inventory-formula COGS on top of
  that would require tracking a historical cost basis for stock at each
  point in time (what it was worth when purchased vs. today's price), which
  this app doesn't do and which would conflict with the manual-deduction
  workflow you asked for. The recipe-based number (what each sold item's
  ingredients cost, per Phase 5's `Recipe`/`computeRecipeCostMinor`) is the
  accurate, available figure, and it's what both the Sales Report and this
  P&L use.
- **Suppliers is now a permanent exclusion, not a deferral.** Every
  Firestore document, permission key, and design decision that would touch
  a Suppliers module remains genuinely absent — there's no placeholder
  table or unused field anywhere expecting it. If you change your mind
  later, adding it would be a clean new phase (a `suppliers` subcollection,
  a `supplierId` field on `Purchase`), not a retrofit.
- **"Custom range" bypasses `resolveDateRangePreset`.** That helper's
  `'custom'` case has always fallen through to today-only (documented since
  it was written in Phase 1) — genuine custom-range picking needed its own
  two date inputs (`From`/`To`), which this page adds. If you pick an
  inverted range (To before From), the page silently swaps them rather than
  returning an empty result.
- **The expense category breakdown counts only non-voided expenses** —
  consistent with how the Sales Report's Net Profit and the Expenses page's
  running total already treat voided entries (excluded unless you're
  explicitly reviewing them).
- **"Item-day" in the missing-recipe caveat, not "item".** Because this
  report spans multiple days, the same menu item missing a recipe shows up
  once per day it was sold — the caveat count reflects that, so it can be
  larger than the number of distinct menu items without recipes.

## Assumptions

- **No CSV/PDF export** — the report is view-only in the app. Worth adding
  later if you want to hand a P&L to an accountant or file it somewhere.
- **No comparison view** (e.g. this month vs. last month side-by-side) —
  you pick one range at a time. Doable as a later enhancement if useful.
- **No allocation of irregular/lump-sum expenses across days** — e.g. a
  once-a-year insurance payment logged as a single expense on one date will
  show up entirely in whatever range contains that date, not spread evenly.
  This matches how you're logging expenses today (Phase 6), so it's
  consistent, just worth knowing when reading a monthly number that
  includes a big one-off.

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress blocks `firestore.googleapis.com`, so this couldn't be exercised
  live against your real Firebase project from inside this environment.
  Build and typecheck are clean; live verification needs to happen on your
  machine (see below).
- Very large date ranges (e.g. "This Year" for a restaurant with a long
  sales history) pull every Daily Sales and Expense document in that range
  client-side with no pagination — fine at the scale of one restaurant's
  data for a year or two, but worth watching if the range grows very large.

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same 5 pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 7 code.

## How to verify on your machine

1. `npm install` (only if you haven't already).
2. No new rules or indexes to deploy this phase — `firestore.rules` only
   changed a comment.
3. `npm run dev`, log in as the restaurant owner, open
   **Reports → Profit & Loss**.
4. Confirm "This Month" (the default) shows a Revenue/Gross Profit/
   Expenses/Net Profit set of numbers that match what you'd expect from
   your Daily Sales and Expenses entries for the current month.
5. Switch between the range presets (Today, This Week, Last Month, This
   Year) and confirm the numbers change sensibly — e.g. "Today" should
   roughly match the same day's numbers on the Sales Report.
6. Pick "Custom range", set a From/To spanning a couple of weeks you have
   data for, and confirm the statement and expense breakdown table add up
   (Total expenses in the table should equal the "Total expenses" stat
   card and the sum of expense line items shown).
7. Check the expense category breakdown percentages sum to roughly 100%.
8. If you have a second test account with `reports.financial` but not
   `expense.view`, confirm the page still loads with Revenue/Food
   Cost/Gross Profit and a note explaining expenses are hidden, rather than
   erroring.
9. Sell (record in Daily Sales) an item with no recipe defined during your
   test range, and confirm the "item-day(s) have no recipe" caveat appears
   and that item's cost is excluded from Food Cost.
