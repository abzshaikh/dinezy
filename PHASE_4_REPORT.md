# Phase 4 Report — Inventory (Ingredients, Purchases, Waste, Stock Ledger, Expiry)

## What was implemented

Raw-material inventory tracking for a restaurant, scoped **without a
Suppliers module** — you told me to skip suppliers and just build
inventory, so vendor name is captured as a free-text field on a purchase
(for "who did I buy this from" context) rather than a managed
`suppliers` collection with its own CRUD, contact info, etc. That can be
added later as a proper module without touching anything built here — the
`vendorName` string field on a purchase would just gain an optional
`supplierId` alongside it.

What's in scope:

- **Ingredients** — the raw-material catalog (name, category, unit,
  cost per unit, current stock, reorder level, active/archived).
- **Purchases** — recording a delivery: quantity, unit cost, optional
  vendor name, optional expiry date, optional note. Increases stock and
  updates the ingredient's cost.
- **Waste** — recording spoilage/expiry/overproduction/other loss.
  Decreases stock; blocked if it would take stock negative.
- **Manual adjustments** — correcting stock to a known count (e.g. after
  a physical count), for the initial "opening stock" at ingredient
  creation, and for any other correction. Records the delta either
  direction.
- **Stock Ledger** — a single, permanent, filterable audit trail of every
  purchase/waste/adjustment across all ingredients, most recent first.
- **Expiry** — purchases that had an expiry date entered, soonest first,
  with an "Expires in Nd" / "Expired" / "OK" status chip.

Everything that changes a stock quantity or cost goes through the ledger
in the same Firestore transaction — there is no code path that updates
`currentStockQty` or `costPerUnitMinor` directly without also writing a
ledger entry explaining why.

## Files created

- `src/types/inventory.ts` — `Ingredient`, `CreateIngredientInput`,
  `UpdateIngredientInput`, `StockLedgerEntry`, `RecordPurchaseInput`,
  `RecordWasteInput`, `RecordAdjustmentInput`, `INGREDIENT_UNITS`,
  `WASTE_REASONS` + labels.
- `src/services/inventoryService.ts` — `listIngredients`,
  `createIngredient`, `updateIngredient`, `setIngredientActive`,
  `recordPurchase`, `recordWaste`, `recordAdjustment`,
  `listRecentStockLedger`, `listUpcomingExpiry`, `fetchIngredient`.
- `src/features/inventory/IngredientsPage.tsx` — ingredient table with
  stock/cost/status columns and a low-stock warning icon.
- `src/features/inventory/IngredientFormDialog.tsx` — create/edit
  ingredient form (opening stock is only asked for on create).
- `src/features/inventory/AdjustStockDialog.tsx` — "set stock to X" form.
- `src/features/inventory/PurchaseFormDialog.tsx` — record-a-purchase form.
- `src/features/inventory/WasteFormDialog.tsx` — record-waste form.
- `src/features/inventory/PurchasesPage.tsx` — purchase history (ledger
  filtered to `type === 'purchase'`).
- `src/features/inventory/WastePage.tsx` — waste history (ledger filtered
  to `type === 'waste'`).
- `src/features/inventory/StockLedgerPage.tsx` — full audit trail with
  ingredient + type filters.
- `src/features/inventory/ExpiryPage.tsx` — upcoming/expired purchases.

## Files modified

- `src/types/index.ts` — added `export * from './inventory';`.
- `src/utils/validation.ts` — added `ingredientSchema`, `purchaseSchema`,
  `wasteSchema`, `adjustmentSchema`.
- `src/app/navConfig.ts` — enabled Ingredients, Stock Ledger, Purchases,
  Waste, and Expiry under Inventory. **Stock** and **Suppliers** stay
  disabled — "Stock" was a placeholder for a separate stock-taking
  screen that isn't part of this phase's scope (the Stock Ledger covers
  the audit-trail need), and Suppliers per your instruction.
- `src/App.tsx` — added the five `/app/inventory/...` routes.
- `firestore.rules` — added `ingredients` and `stockLedger` subcollection
  rules (see below).
- `firestore.indexes.json` — added one composite index (see below).

## Database collections affected

- `restaurants/{restaurantId}/ingredients/{ingredientId}` (new
  subcollection).
- `restaurants/{restaurantId}/stockLedger/{entryId}` (new subcollection).

## Business logic worth noting

- **The ledger is the single source of truth for how stock got where it
  is.** `currentStockQty` and `costPerUnitMinor` on an ingredient
  document are derived/cached values for fast reads (so the Ingredients
  table doesn't need to sum the whole ledger to show a number) — but
  they only ever change inside the same Firestore transaction as a
  ledger entry that explains the change. There's no "just edit the stock
  number" admin backdoor, on purpose: if the real-world count is wrong,
  the fix is a manual adjustment, which itself leaves a ledger trail.
- **Three-branch update rule on `ingredients`, enforced server-side.**
  `firestore.rules` splits an ingredient update into three mutually
  exclusive branches, each allowed to touch a different, non-overlapping
  set of fields:
  - **A — master-data edit** (`inventory.edit`): name/category/unit/cost/
    reorder/active. Explicitly forbidden from touching `currentStockQty`
    — quantity only ever moves through branch B or C.
  - **B — purchase** (`purchase.create`): may change `currentStockQty`
    and `costPerUnitMinor` together (see "last cost" below), nothing else.
  - **C — waste/adjustment/opening-stock** (`waste.create`,
    `inventory.adjust`, or `inventory.create`): may change
    `currentStockQty` only, cost and master data locked.

  This means even if a client-side bug tried to send a purchase-shaped
  request that also changed the ingredient's name, or a waste request
  that also changed its cost, Firestore itself would reject it — the
  server enforces the same "ledger explains every change" invariant the
  UI is designed around, not just the UI.
- **"Last cost" costing, not weighted average.** `recordPurchase` sets
  `costPerUnitMinor` to whatever this purchase's unit cost was — it does
  not maintain a running weighted-average cost across purchases at
  different prices. This is a deliberate simplification: weighted-average
  costing needs to track cost per remaining unit as stock depletes (which
  in turn needs FIFO/batch tracking — see the Expiry limitation below) to
  stay accurate, which is a meaningfully bigger feature. "Last cost" is
  what most small-restaurant systems default to and is good enough for
  "roughly, what does this ingredient cost me right now" — flag this if
  you later build recipe costing and it turns out you need
  weighted-average precision for food-cost percentages.
- **Waste can't take stock negative.** `recordWaste` reads the current
  quantity inside the transaction and throws a friendly error ("Only X kg
  of Y in stock — can't waste Z") rather than allowing stock to go below
  zero. If the recorded stock is simply wrong (e.g. a past data-entry
  error), the message points at Adjust Stock instead.
- **Immutable audit trail — same pattern as `restaurantUsers`.**
  `stockLedger` entries are `allow update: if false; allow delete: if
  false;` in rules, same as everywhere else in this app that represents
  history. A correction is always a new offsetting entry, never an edit.
- **Denormalized `ingredientName`/`unit` on every ledger entry** — same
  reasoning as `RestaurantUser.displayName/email`: if an ingredient is
  later renamed, old ledger rows still read correctly with the name they
  had at the time, and the ledger doesn't need a join/lookup to render.
- **One new composite index, unlike Phase 3.** Phase 3 deliberately
  avoided every new index by ordering on a single field with no filter.
  The Expiry page couldn't do that cleanly — it needs
  `where('type', '==', 'purchase')` *and* `orderBy('expiryDate', 'asc')`
  on a different field, which Firestore can't serve without a composite
  index. The alternative (fetch everything, filter/sort client-side, hope
  the "recent window" `listRecentStockLedger` pull happens to include
  every unexpired purchase) is unreliable once a restaurant has more than
  a few hundred ledger entries — an old purchase with a far-future expiry
  date could silently fall out of the window. Added the index instead:
  `stockLedger` — `type` ASC, `expiryDate` ASC — in
  `firestore.indexes.json`. **This needs a deploy** (see below); unlike
  rules, a missing composite index fails at query time with a Firestore
  error containing a console link to create it, not at build time.
- **`z.coerce.number()` avoided again.** All four new Zod schemas
  (`ingredientSchema`, `purchaseSchema`, `wasteSchema`,
  `adjustmentSchema`) use plain `z.number()`, with react-hook-form's
  `valueAsNumber`/`setValueAs` doing the string-to-number conversion —
  same fix as Phase 3, applied from the start this time.

## Assumptions

- **No Suppliers module** — per your explicit instruction. Vendor is a
  free-text field on a purchase, not a managed entity.
- **No FIFO/batch (lot) tracking.** The Expiry page shows the expiry date
  of each *purchase*, not of remaining stock. If you buy 10kg with a
  10-day expiry, then use 6kg over the next week, Expiry still shows "10kg
  expiring in 3 days" — it has no way to know only 4kg of that batch is
  actually left, because stock is tracked as one running total per
  ingredient, not as separate dated batches. True lot tracking (each
  purchase becomes its own depleting batch, waste/usage draws from the
  oldest batch first) is a substantially bigger data model change and a
  reasonable candidate for a later phase if expiry accuracy at the batch
  level turns out to matter for your kitchen.
- **No recipe/usage-driven stock depletion yet.** Stock only decreases via
  Waste or a manual Adjustment right now — there's no "selling a dish
  automatically deducts its recipe's ingredients" flow, since that needs
  the Recipes feature (menu-item-to-ingredient mapping), which is a later
  phase per the original scope discussion.
- **No low-stock notifications**, just a visual warning icon on the
  Ingredients table when `currentStockQty <= reorderLevel`. Push/email
  alerts would be a polish-phase addition.
- **No CSV import/export** for ingredients or the ledger — one at a time
  via the forms, same as menu items in Phase 3.
- **Archiving an ingredient does not block existing ledger history** —
  old purchases/waste/adjustments against an archived ingredient still
  show up in the Stock Ledger and Expiry pages; only new purchases/waste
  against it are blocked by the UI (the ingredient picker only lists
  active ingredients).

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress blocks `firestore.googleapis.com`, so none of this could be
  exercised live against your real Firebase project from inside this
  environment. Build and typecheck are clean; live verification needs to
  happen on your machine (see below).
- `listRecentStockLedger` pulls the most recent 300 entries across *all*
  ingredients with no pagination — fine at the scale of a single
  restaurant's day-to-day activity, but worth adding a "load more" once a
  restaurant has been running long enough to regularly hit that cap.

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 4 code.

## How to verify on your machine

1. `npm install` (only if you haven't already).
2. **Deploy both rules and indexes this time** — this phase adds a
   composite index, not just rules:
   `firebase deploy --only firestore:rules,firestore:indexes --project restaurant-management-553db`.
   Index builds aren't instant; the Firebase console's **Firestore
   Database → Indexes** tab shows "Building" until it's ready, usually a
   couple of minutes for a project this small.
3. `npm run dev`, log in as the restaurant owner, open **Inventory →
   Ingredients**. Create 2-3 ingredients (e.g. Tomatoes, Flour, Olive Oil)
   with an opening stock quantity on a couple of them.
4. Open **Inventory → Purchases**, record a purchase against one
   ingredient with a vendor name and an expiry date a few days out.
   Confirm the ingredient's stock and cost updated on the Ingredients page.
5. Open **Inventory → Waste**, record some waste against that same
   ingredient. Then try to waste more than is currently in stock and
   confirm you get the friendly "not enough in stock" error instead of a
   raw Firestore error.
6. Open **Inventory → Stock Ledger** and confirm all three entries
   (opening stock, purchase, waste) show up, most recent first, and that
   the ingredient/type filters work.
7. Open **Inventory → Expiry** and confirm the purchase from step 4 shows
   up with the right "Expires in Nd" status. (If the index from step 2
   hasn't finished building yet, this page will show a Firestore error
   with a link — that's expected until the index is ready.)
8. Use **Adjust Stock** on an ingredient to correct its count directly,
   confirm a new adjustment entry appears in the ledger with the right
   direction (increase/decrease), and that setting it to the same value
   it already has is rejected ("nothing to adjust").
9. Archive an ingredient from the Ingredients page and confirm it's
   excluded from the ingredient picker on new Purchase/Waste forms, but
   its historical ledger entries are still visible.
