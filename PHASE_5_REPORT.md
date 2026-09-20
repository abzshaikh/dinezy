# Phase 5 Report — Recipes, Daily Sales & Sales Report

## What was implemented

Three connected pieces, scoped by your explicit instruction that selling an
item should **not** automatically deduct ingredient stock — you already
correct/count stock by hand at the end of the day (Phase 4's Adjust Stock),
and you wanted that to stay the one place stock changes, rather than
competing with an automatic per-sale deduction:

- **Recipes** — map a menu item to the ingredients (and quantities) it
  uses, so you can see its food cost and margin. Cost is computed LIVE
  from each ingredient's current cost — no ingredient stock is touched by
  defining or "selling" a recipe.
- **Daily Sales** — a simple end-of-day entry screen: pick a date, type
  how many of each menu item sold, save. One number per item per day, not
  itemized per-order — matching how you said you'd be entering this by
  hand.
- **Sales Report** — for one selected day, shows the items that sold the
  most (by quantity) and the most profitable items (by revenue minus food
  cost), plus day totals.

## Files created

- `src/types/recipe.ts` — `Recipe`, `RecipeLine`, `SaveRecipeInput`.
- `src/types/sales.ts` — `DailySalesEntry`, `DailySalesLineInput`.
- `src/services/recipeService.ts` — `listRecipes`, `fetchRecipe`,
  `saveRecipe`, `deleteRecipe`, `computeRecipeCostMinor`.
- `src/services/salesService.ts` — `listDailySales`, `saveDailySales`.
- `src/features/menu/RecipesPage.tsx` — table of menu items with recipe
  cost/margin, Add/Edit/Remove recipe.
- `src/features/menu/RecipeFormDialog.tsx` — ingredient + quantity line
  editor with a live cost/margin preview.
- `src/features/sales/DailySalesPage.tsx` — the end-of-day quantity-sold
  entry grid, one row per menu item.
- `src/features/reports/SalesReportPage.tsx` — the "most sold" / "most
  profitable" report for a chosen day.

## Files modified

- `src/types/index.ts` — added the two new type module exports.
- `src/utils/validation.ts` — added `recipeLineSchema`/`recipeSchema`.
- `src/app/navConfig.ts` — enabled Recipes (under Menu), renamed and
  enabled "Sales" → **Daily Sales** (under Sales; Orders and Payments stay
  disabled — those are full POS features, out of scope here), and enabled
  Sales Report (under Reports).
- `src/App.tsx` — added `/app/menu/recipes`, `/app/sales/daily`,
  `/app/reports/sales` routes.
- `firestore.rules` — added `recipes` and `dailySales` subcollection rules
  (see below). **No new permission keys** — `recipes.view`/`recipes.edit`
  and `orders.view`/`orders.create`/`reports.view`/`reports.financial`
  already existed in `src/types/permissions.ts` from Phase 1's original
  permission list, unused until now. `rolePermissions()` in
  `firestore.rules` did not need any changes.

## Database collections affected

- `restaurants/{restaurantId}/recipes/{menuItemId}` (new subcollection,
  one doc per menu item — the doc ID **is** the menuItemId).
- `restaurants/{restaurantId}/dailySales/{entryId}` (new subcollection,
  doc ID `{date}_{menuItemId}`).

No changes to `firestore.indexes.json` — `listDailySales` filters on a
single field (`date`) with no `orderBy`, which Firestore's automatic
single-field indexing covers without a composite index, same
index-avoidance approach as Phase 3.

## Business logic worth noting

- **No automatic stock deduction — by design, per your instruction.**
  Recipes exist purely to compute a menu item's food cost/margin, and
  Daily Sales exists purely to feed the Sales Report. Neither one writes
  to `ingredients.currentStockQty` or the Phase 4 stock ledger. This keeps
  exactly one source of truth for stock (your manual Purchases/
  Waste/Adjustment entries) instead of two competing ones that could drift
  apart. If you ever want automatic deduction later, it's an additive
  change — Daily Sales already has everything it needs (quantity sold ×
  recipe lines) to compute what *would* have been consumed.
- **Recipe cost is LIVE, Daily Sales cost is SNAPSHOTTED — on purpose,
  two different things.** `Recipe` docs never store a cost — every time
  you view the Recipes page or the RecipeFormDialog's preview, the cost is
  recalculated from each line's ingredient's *current*
  `costPerUnitMinor`. That's what "live" means: it moves as ingredient
  prices change, matching the architecture project's "recipes compute
  cost live" decision. `DailySalesEntry`, by contrast, snapshots
  `unitCostMinor`/`unitPriceMinor` at the moment you save that day's
  numbers — so if you raise a menu item's price next month, last month's
  Sales Report doesn't silently recompute with today's price. Same
  "snapshot what mattered at the time" principle as everywhere else money
  is recorded in this app.
- **`hasRecipe: false` means cost is unknown, not zero.** If you record
  sales for an item before giving it a recipe, its cost/profit are stored
  as 0 and flagged with `hasRecipe: false` — the Sales Report excludes
  these from the "Most Profitable" ranking (rather than showing a
  misleadingly high profit number) and tells you how many items were
  excluded and why.
- **Daily Sales is editable, unlike the Phase 4 stock ledger.** The stock
  ledger is an append-only audit trail — corrections are new offsetting
  entries, never edits. Daily Sales is different: it's a running "today's
  number" you might type wrong and want to fix directly, so re-saving the
  same date+item overwrites it. To avoid accidentally erasing a correct
  number, the entry form only sends a day's number to the server for
  items whose field you actually typed something into this session —
  leaving a field blank leaves that day's existing entry untouched; typing
  `0` explicitly records "nothing sold." `firestore.rules` still disallows
  `delete` on this collection — a mistake gets corrected by re-saving the
  right number, not by deleting history.
- **Financial figures are visible to anyone who can read the collection —
  the "hide cost/profit for `reports.view`-only users" behavior is a UI
  convenience, not a security boundary**, matching the exact caveat
  already documented on `PermissionGuard` elsewhere in this app. Firestore
  rules can't redact individual fields from a document — either a role can
  read `dailySales` or it can't. So the read rule allows anyone with
  `orders.view`, `reports.view`, *or* `reports.financial` to read the
  collection (since the same records back both the entry page and the
  report), and the Sales Report page only visually hides the cost/profit
  columns and the "Most Profitable" table from someone lacking
  `reports.financial`. If you need real hard enforcement here later (e.g.
  a cashier who can see quantities but must never see profit margins even
  via dev tools), that would need splitting sales quantity and financial
  data into separate documents — flagging this now in case it matters to
  you, since it's a real, if currently accepted, gap.
- **`recipes.edit`/`orders.create`/`reports.financial` already lined up
  with sensible defaults from Phase 2's original role table, with zero
  changes needed**: `kitchen_manager` already had `recipes.edit` (kitchen
  staff know the recipes), `manager`/`cashier` already had
  `orders.create` (front-of-house records the day's sales), and
  `accountant` already had `reports.financial` but not `orders.create`
  (sees the profit report, doesn't enter sales numbers). This wasn't
  planned ahead of time for this exact feature, but the original
  Phase-1-era permission list (see `src/types/permissions.ts`) already
  anticipated something in this shape.

## Assumptions

- **"Profit" here means revenue minus food cost only** — no labor,
  rent, or other overhead. This is the recipe-based food-cost profit, not
  a full P&L; the architecture notes call out a separate, later
  inventory-formula COGS calculation (Beginning+Purchases−Ending) that
  feeds an actual Profit & Loss statement in a future phase. Don't treat
  the Sales Report's "Profit" as your bottom line.
- **Daily Sales is a single day's total per item, not itemized orders.**
  There's no per-order timestamp, table number, or payment method — if you
  later want that level of detail (a real POS/Orders module), that's a
  bigger, separate feature; this phase deliberately kept the data model as
  small as your stated workflow needed.
- **Recipes are optional.** A menu item with no recipe still sells fine
  through Daily Sales — its revenue counts, but its cost/profit are
  excluded from financial totals and the "Most Profitable" ranking (see
  above) rather than guessed at.
- **Quantities can be fractional** (e.g. `2.5` if that's meaningful for
  something you sell by weight/portion) — not restricted to whole numbers,
  though most restaurant items will naturally be entered as whole counts.
- **No date-range report yet** — Sales Report is one day at a time, per
  your request. The underlying `listDailySales(restaurantId, date)` query
  (a single equality filter, no `orderBy`) would extend to a range
  (`where('date','>=',...).where('date','<=',...)`) without needing a new
  composite index, so a "this week" / "this month" view is a small
  addition later if you want it — flagging it as an easy option rather
  than something already promised.

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress blocks `firestore.googleapis.com`, so none of this could be
  exercised live against your real Firebase project from inside this
  environment. Build and typecheck are clean; live verification needs to
  happen on your machine (see below).
- See the "financial figures are visible to anyone who can read the
  collection" note above — a real, accepted gap if you ever need a role
  that can see sales counts but truly never see profit numbers.
- `listDailySales`/the Sales Report have no pagination concerns yet (one
  day's data is naturally small), but a future date-range report should
  keep an eye on how many docs that pulls back once you have a long
  history.

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same 5 pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 5 code.

## How to verify on your machine

1. `npm install` (only if you haven't already).
2. Deploy the updated rules: `firebase deploy --only firestore:rules --project restaurant-management-553db`
   (no new composite indexes this phase, so `firestore:indexes` isn't
   needed).
3. `npm run dev`, log in as the restaurant owner, open **Menu → Recipes**.
   Add a recipe to a couple of menu items (pick a few ingredients and
   quantities each) and confirm the cost/margin columns update.
4. Change one of those ingredients' cost on the Ingredients page, then
   come back to Recipes and confirm that item's recipe cost updated too
   (this is the "live cost" behavior).
5. Open **Sales → Daily Sales**, pick today's date, enter a quantity sold
   for a few items (including at least one that has no recipe yet), and
   save.
6. Open **Reports → Sales Report** for the same date. Confirm "Most Items
   Sold" shows everything you entered, and "Most Profitable Items" only
   shows the ones with a recipe, with a note about the one(s) excluded.
7. Go back to Daily Sales, change one quantity, save again, and confirm
   the Sales Report updates to match (corrections work).
8. Try leaving a field blank and saving — confirm that item's previously
   saved quantity for that day is unaffected (only touched fields are
   sent).
9. If you have a second test account with a role that lacks
   `reports.financial` (e.g. `manager`, which has `reports.view` but not
   `reports.financial`), confirm the Sales Report still shows "Most Items
   Sold" but hides cost/profit and the "Most Profitable" table for that
   user.
