# Phase 9 Report — Menu Costing

## Why this phase, and why now

Asked what Phase 9 should build, you picked "wire up Phase 8's Settings
values" — the GST %/service charge %/default units/invoice numbering/target
food cost % fields that became editable in Phase 8 but didn't yet DO
anything. Of those, `targetFoodCostPercent` is the one with a real,
already-scoped consumer waiting for it: the "Menu Costing" nav item has sat
disabled since Phase 1, reserved for exactly this. Two of the others
(`defaultWeightUnit`) had a small, genuine gap this phase also closed. The
rest (GST %, service charge %, invoice numbering) still don't have a
consumer — see "Not built this phase" below for why that's a deliberate
line, not an oversight.

## What was implemented

- **Menu Costing page** (`Menu → Menu Costing`, `/app/menu/costing`) — every
  active menu item with a recipe, ranked by food cost % (recipe cost ÷
  price), compared against your `targetFoodCostPercent` setting:
  - Stat cards: your target %, a blended food cost % across all priced
    items, how many items are over target, and how many have no recipe yet
    (and are therefore excluded from the other figures).
  - A table sorted worst-first (highest food cost % at the top) so the
    items eating into your margin the most are immediately visible, each
    with a Price / Recipe Cost / Food Cost % / vs Target (in percentage
    points) / Over Target-or-On Target chip.
  - Items without a recipe show at the bottom with a "No recipe" /
    "No data" chip instead of being silently dropped, with a banner
    pointing you to the Recipes page.
  - A "Change target in Settings" button (for anyone with
    `restaurant.settings`) jumps straight to Restaurant Profile rather than
    duplicating an edit control here.
- **New ingredients now default to your configured weight unit** — the
  ingredient form previously hardcoded `unit: 'kg'` for a brand-new
  ingredient regardless of what you'd set as your restaurant's default
  weight unit (Phase 8's `defaultWeightUnit`). It now defaults to that
  setting instead. Editing an existing ingredient is unaffected — this only
  changes what's pre-selected when adding a new one.

## Files created

- `src/features/menu/MenuCostingPage.tsx` — the page.

## Files modified

- `src/features/inventory/IngredientFormDialog.tsx` — new-ingredient unit
  now defaults from `restaurant.settings.defaultWeightUnit`.
- `src/app/navConfig.ts` — enabled "Menu Costing" (existed as a disabled
  placeholder since Phase 1).
- `src/App.tsx` — added the `/app/menu/costing` route.
- `firestore.rules` — file-header comment only, noting Phase 9.

## Database collections affected

None — no new collections, no schema changes. Menu Costing reads the same
`menuCategories`/`menuItems`/`ingredients`/`recipes` collections the Recipes
page (Phase 5) already reads, through the same existing rules. No changes to
`firestore.indexes.json` — nothing here is a new query shape; it reuses
`listCategories`/`listMenuItems`/`listIngredients`/`listRecipes` unchanged.

## Business logic worth noting

- **Permission: gated on `recipes.view`, not `reports.financial`.** This
  matches the Recipes page's own precedent — recipe cost/margin has always
  been `recipes.view`-gated content in this app (the Recipes page shows
  Price/Recipe Cost/Margin to anyone with `recipes.view`, no additional
  financial-reporting permission). Checked against the fixed role table:
  every role that has `recipes.view` (owner, manager, kitchen_manager) also
  has `menu.view` and `inventory.view`, so gating on `recipes.view` alone
  is safe today — it won't let someone through to a page whose underlying
  Firestore reads then get denied. If a future phase ever gives a role
  `recipes.view` without the other two, this page (and the Recipes page)
  would need revisiting.
- **"Blended food cost %" is NOT sales-weighted.** It's `sum(recipe cost
  across priced items) ÷ sum(price across priced items)` — i.e. "if I sold
  exactly one of everything on the menu, what's my overall food cost %."
  It deliberately does not pull Daily Sales data to weight by what actually
  sold more — that's a heavier query (a date range, like the P&L) and a
  product decision (which date range represents "normal" sales) this phase
  didn't make for you. The disabled "Menu Profitability" nav placeholder
  (`/app/reports/menu-profitability`, still unbuilt) is the more natural
  home for a sales-weighted version later.
- **GST %, service charge %, invoice prefix/number remain unconsumed —
  deliberately, not an oversight.** These need an actual billing/invoicing
  feature to apply them to (a bill total, a printed invoice number), which
  doesn't exist yet and is a meaningfully bigger scope decision — most
  naturally tied to Orders/POS, which you've been asked about twice now and
  haven't confirmed wanting (you've consistently preferred simpler
  manual-entry workflows: the Daily Sales tally over per-order POS, manual
  stock deduction over automatic). Building billing logic around a POS flow
  you may not want felt like the wrong thing to guess at, so this phase
  stopped at the one setting (`targetFoodCostPercent`) that had a clear,
  already-scoped, non-POS-dependent consumer.
- **`defaultVolumeUnit` still isn't consumed anywhere.** The ingredient
  form has one combined unit dropdown (weight and volume units mixed
  together: g, kg, ml, l, pcs, dozen) with no separate "is this
  weight-or-volume-measured" question asked first, so there's no clean spot
  to apply a volume-specific default without first adding that extra
  question to the form. Defaulting to `defaultWeightUnit` alone was the
  smallest correct fix; making the form volume-aware too is a small
  follow-up if you want it.

## Assumptions

- **"Over target" is a strict greater-than, no tolerance band.** An item
  exactly at your target shows "On Target", one point over shows "Over
  Target" — no buffer zone (e.g. within 1-2 points still counted as fine).
  Worth adjusting if you find the line too strict in practice.
- **Archived (inactive) menu items are excluded**, same filter the Recipes
  page already applies — a discontinued item's old cost % isn't relevant to
  a going-forward costing view.

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress blocks `firestore.googleapis.com`, so none of this could be
  exercised live against your real Firebase project from inside this
  environment. Build and typecheck are clean; live verification needs to
  happen on your machine.
- Phases 3 through 9 all remain not-yet-live-tested by you against the real
  project.

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same 5 pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 9 code.

## How to verify on your machine

1. No new rules or indexes to deploy this phase — `firestore.rules` only
   changed a comment.
2. Restart `npm run dev` if it isn't already picking up the new files,
   hard-refresh the browser.
3. Open **Menu → Menu Costing**. Confirm it lists your active menu items
   sorted with the highest food cost % first, and that the target shown
   matches whatever you set on Restaurant Profile.
4. Change the target food cost % on Restaurant Profile, come back to Menu
   Costing, and confirm the "Over Target" / "On Target" chips and vs-Target
   column update to match.
5. Add a new ingredient (Inventory → Ingredients → New Ingredient) and
   confirm the Unit field pre-fills with whatever you've set as your
   default weight unit on Restaurant Profile (not always "kg" anymore).
6. Confirm a menu item with no recipe shows up at the bottom with a
   "No recipe" chip rather than being silently missing from the list.
