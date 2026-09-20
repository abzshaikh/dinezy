# Phase 14 Report — Menu Profitability (Sales-Weighted)

> **Fix (same session, 2026-08-23):** the "#1 most profitable" badge could
> land on the wrong item — see "Bug fix: '#1' badge on a recipe-less item"
> at the end of this report.

## Why this phase, and why now

The last item on the pre-existing "reports" candidate list, and the one
Phase 9's own report explicitly flagged as the natural follow-up: Menu
Costing (Phase 9) blends food cost % as "if I sold exactly one of
everything" — useful for spotting a badly-priced dish the moment a recipe
changes, but not a picture of what actually happened. This page is that
picture: real Daily Sales data, weighted by what actually sold, over a real
date range.

## What was implemented

- **Menu Profitability** report (`Reports → Menu Profitability`,
  `/app/reports/menu-profitability`, previously a disabled placeholder
  since Phase 1) — every menu item sold in a chosen date range, ranked
  most-profitable-first, with quantity sold, revenue, food cost, food cost
  %, profit, and an Over Target/On Target/No Recipe status chip against
  your `targetFoodCostPercent` setting.
- Stat cards: total revenue, a genuinely **sales-weighted** food cost %
  across the whole range (see "Business logic" below for why this differs
  from Menu Costing's number), total profit, and how many items are over
  target.
- Same date-range picker (presets + custom) as the P&L report, built on the
  same `listDailySalesForRange` query Phase 7 already uses — no new reads.

## Files created

- `src/features/reports/MenuProfitabilityPage.tsx` — the page.
- `PHASE_14_REPORT.md` — this report.

## Files modified

- `src/app/navConfig.ts` — enabled "Menu Profitability" (existed as a
  disabled placeholder since Phase 1).
- `src/App.tsx` — added the `/app/reports/menu-profitability` route.
- `firestore.rules` — header comment only.
- `README.md` — bumped (see combined note in whichever later phase's
  report has the final version number — several phases landed together
  this session).

## Database collections affected

None. Pure client-side aggregation of `dailySales` documents (Phase 5)
already readable under the existing `reports.financial`-gated rule — same
"no new reads, no new rules" shape as Phase 7's P&L and Phase 9's Menu
Costing.

## Business logic worth noting

- **This is the sales-weighted report Phase 9's own report said was
  missing.** Its exact words: *"'Blended food cost %' is NOT
  sales-weighted... The disabled 'Menu Profitability' nav placeholder... is
  the more natural home for a sales-weighted version later."* This phase is
  that placeholder, built as promised.
- **Menu Profitability and Menu Costing can legitimately disagree on the
  same item, same day** — and that's not a bug in either one. Menu Costing
  uses the CURRENT recipe cost and CURRENT menu price, live, regardless of
  whether that item has sold recently. Menu Profitability uses Phase 5's
  SNAPSHOTTED `unitPriceMinor`/`unitCostMinor` — the price and cost as they
  were at the moment each day's sales were recorded. If a recipe or price
  changed since, the two reports are answering different questions on
  purpose ("what does this dish cost to make right now" vs "what did this
  dish actually cost when it sold last month") — see the architecture
  doc's "Recipe cost vs historical sales" bullet, which established this
  snapshot-vs-live split back in Phase 5, well before either report
  existed to make it visible.
- **Cost/profit are computed only over the days an item actually had a
  recipe.** Quantity and revenue always include every sale, but if an item
  sold on some days with a recipe and others without (e.g. a recipe was
  added partway through the range), only the recipe-covered days count
  toward its food cost % and profit — same exclusion Phase 9 and the
  existing Sales Report already apply, just tracked per-item across a
  range instead of per-day. An item with NO recipe for the entire range
  shows "No recipe" and is excluded from the food-cost-% and
  items-over-target stat cards (its revenue still counts toward total
  revenue).
- **"Sales-weighted" blended % = total food cost across all costed sales ÷
  total revenue across those same sales** — a real weighted average across
  actual transaction volume, not an average of each item's individual
  percentage. A item that sold 500 units moves this number far more than
  one that sold 2, which is exactly the point: it reflects real exposure,
  not menu-listing count.

## Assumptions

- **Archived (inactive) menu items still show up if they sold in-range.**
  Unlike Menu Costing (which reads the current active menu list), this
  report is driven entirely by historical Daily Sales records — a
  discontinued item that sold earlier in the range is still real revenue/
  cost history and stays visible, which is the correct behavior for a
  historical report (the opposite of Menu Costing's forward-looking "what
  should I worry about right now" framing).
- **"Over target" is the same strict greater-than, no tolerance band** as
  Phase 9, for consistency between the two reports.

## Remaining / known issues

- Same sandbox limitation as every prior phase: no live Firestore access
  from inside this environment — this report's aggregation logic was
  reviewed carefully against `saveDailySales`'s exact snapshot behavior
  (`src/services/salesService.ts`) but the full page — real data across a
  real range, the food-cost-% math, the over-target flagging — needs to be
  checked on your machine against actual Daily Sales entries.
- Phases 3 through 14 all remain not-yet-live-tested by you against the
  real project.

## Build/test result

`npm run build` and `npm run lint` — verified together with the other
phases delivered in this same continuation; clean, same 5 pre-existing
warnings, nothing new from this phase's code.

## How to verify on your machine

1. No rules or index deploy needed — `firestore.rules` only changed a
   comment.
2. Restart `npm run dev`, hard-refresh.
3. Open **Reports → Menu Profitability**, pick a range with Daily Sales
   entries in it.
4. Confirm the ranking looks right — an item that sold a lot at a good
   margin should sit near the top even if a rarely-sold item has a "better"
   individual food cost %.
5. Compare the sales-weighted food cost % here against Menu Costing's
   blended % for the same period — they're allowed to differ; confirm you
   understand why from the on-page disclaimer if they do.
6. If any item's recipe changed mid-range, confirm this report still uses
   whatever cost was actually recorded on each sale day (not today's
   recipe cost).

## Bug fix: "#1" badge could land on a recipe-less item (found + fixed 2026-08-23)

**Found by the user**, testing against a real restaurant where none of the
sold items had a recipe defined yet. All four items in range showed
Profit = ₹0.00 and status "No recipe" — yet one of them (not the item with
the highest quantity sold or highest revenue) was still marked "#1."

**Root cause**: the original ranking sorted every item purely by
`profitMinor` descending. An item with no recipe never has `profitMinor`
computed at all — it sits at its untouched default of 0, which is
"unmeasured," not "broke even." When several items are all missing
recipes, they're all tied at 0, and `Array.sort`'s comparator returns 0 for
every pair — the resulting order for those ties depends on JavaScript's
sort implementation detail (stable sort preserves insertion order from the
`Map` built while aggregating `dailySales` rows), not on anything
meaningful about which item actually performed best. Whichever recipe-less
item happened to appear first in that insertion order won "#1" — a coin
flip dressed up as a ranking.

**Fix**: `mostProfitable`'s sort now treats "has a recipe" as the primary
sort key — items with real cost data (`costedRevenueMinor > 0`) always
rank above items without one, and only costed items are ever compared by
actual `profitMinor`; recipe-less items are ordered by revenue instead
(purely for a sensible, non-arbitrary list order, not a profit claim). The
"#1" badge's render condition was likewise changed from `rank === 0` alone
to `rank === 0 && hasCostData` — so a recipe-less item can never display
"#1," even if it happens to be first in the array. If EVERY item in range
lacks a recipe, no row shows "#1" at all now (previously, one arbitrarily
would).

**Not specific to Menu Profitability's search feature** — this bug existed
since this report's original Phase 14 build; it only became visible once a
real dataset had multiple items with no recipe at all. `MenuItemsPage`'s
food cost work (Phase 9's Menu Costing) has its own, separate over-target
flagging and was not affected by this bug.

Verified: `npm run build` and `npm run lint` both clean, zero new errors,
same pre-existing baseline warnings.
