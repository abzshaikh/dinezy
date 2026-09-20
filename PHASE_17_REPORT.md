# Phase 17 — UI Design System Revamp ("Neon Service")

> **Update (same session, 2026-08-23):** the "Known issue" below — Dashboard
> stat cards hardcoded to 0 — is now fixed. See "Dashboard now wired to real
> data" at the end of this report. Two more small follow-ups landed in the
> same session: the Menu Items grid is now 5 columns (was 3) with a
> distinct card background (`background.paper` instead of blending into the
> page); and the Dashboard gained a Sales/Expenses/Profit trend chart with a
> Day/Week/Month/Year switcher — see "Dashboard trend chart" at the end of
> this report. A fourth follow-up, also same session: a search feature was
> added across 10 pages (a shared `SearchField` component) — see "Search
> feature" further down this report. A fifth and final follow-up: a
> ranking bug on Menu Profitability was found and fixed (see
> `PHASE_14_REPORT.md`), and the previously-flagged "extend `StatCard` to
> the other report pages" item was completed — see "StatCard extended to
> all report pages" at the very end of this report.

## Why this happened

The user asked to revamp the whole application's UI to look more professional
and user-friendly, with high-quality animation. Rather than guess at a
direction, four full live mockups were built and shown one at a time —
**Modern SaaS** (cobalt/white, Stripe-ish), **Warm Kitchen** (teal/copper on
parchment, food-forward), **Enterprise Ledger** (dense, flat, steel-blue),
and **Neon Service** (dark, high-energy, tangerine/lime/pink) — each as a
static HTML mockup of the actual dashboard, sidebar, invoice table, and
buttons, with rich entrance/hover animation, so the choice was made against
something real rather than a text description.

The user picked **Neon Service** as the flagship look, then asked for a
proper light-mode companion and a real light/dark toggle. A fifth mockup
combined both palettes behind a working toggle button to confirm the light
mode before any real code changed. Only after that was approved did this
phase touch the actual app.

## What this phase is (and isn't)

This is the **foundation and flagship page** of the redesign, not a
page-by-page hand restyle of all ~20 screens. The high-leverage move: MUI's
theme system lets color, shape, typography, and many component styles be
defined **once** and cascade automatically to every existing Button, Card,
Chip, Table, TextField, AppBar, and Drawer already in the app — so most of
the visual transformation (new palette, new fonts, rounder shapes, gradient
buttons, soft-wash status chips, page-enter animation) now applies **app-wide
without editing each of the ~20 feature pages individually**. Bespoke
animation (count-up stat cards, staggered entrance) was then built once as a
reusable component and applied richly to the Dashboard as the reference
example — other report/summary screens can adopt the same `StatCard`
component in a follow-up pass whenever wanted.

## What was built

**Theme system** (`src/app/theme.ts`) — rewritten from a single static
`theme` export to `getAppTheme(mode: 'light' | 'dark')`, returning a full
MUI theme per mode:
- Dark tokens (flagship): `#17111A` ground, `#221A27` cards, tangerine
  accent `#FF5C39`, lime positive `#C6F135`, amber warning `#FFC93C`, pink
  critical `#FF3D6E`.
- Light tokens (companion): `#FBF6F3` ground, white cards, the same hues
  deepened for AA contrast on white (`#DE4419` / `#5C7A16` / `#A0680F` /
  `#C41F52`).
- Typography: **Unbounded** (headings, chunky/geometric), **Manrope**
  (body/UI), **Space Mono** (money and other tabular figures — exported as
  the `monoNumeric` sx snippet for reuse).
- `shape.borderRadius` raised to 14 (was 10) — the whole app reads rounder.
- Component overrides: gradient `contained`+`primary` buttons with a
  colored glow shadow, flat-bordered Cards (no default MUI elevation), pill
  Chips with a "wash" background for success/warning/error (light
  background, colored text, matching the mockups' status-chip look),
  monospace uppercase table headers, rounded 12px form fields, borderless
  AppBar/Drawer.
- **MUI API note**: this project's `@mui/material` (`^9.3.1`) no longer
  supports combined-class overrides like `containedPrimary` /
  `filledSuccess` — variant and color are separate classes now. Fixed by
  using the `variants` array API (`{ props: { variant, color }, style }`)
  instead; caught immediately by `tsc -b` during this phase's own build.

**Light/dark toggle**:
- `src/contexts/ThemeModeContext.tsx` (new) — holds `mode` state, persists
  to `localStorage` (`rms-theme-mode`), **defaults to dark** (the flagship
  look) for anyone without a saved preference.
- `src/components/common/ThemeToggle.tsx` (new) — icon button with a
  sun/moon crossfade (framer-motion `AnimatePresence`), placed in the app
  topbar (`AppLayout`) next to the role chip, and in `AuthLayout` (top-right
  corner) so it's reachable before login too.
- `src/App.tsx` restructured: `ThemeModeProvider` now wraps a new
  `ThemedApp` component that reads the mode via `useThemeMode()` and picks
  `getAppTheme(mode)` for MUI's `ThemeProvider` — this is what makes the
  toggle actually repaint the whole app instantly.

**Animation infrastructure**:
- `src/hooks/useCountUp.ts` (new) — animates a number from 0 to its target
  on mount (eased, ~1.1s), respects `prefers-reduced-motion` by jumping
  straight to the final value.
- `src/components/common/StatCard.tsx` (new) — the reusable "flagship"
  component: colored left accent bar, icon chip, count-up figure in tabular
  Space Mono, optional trend line, staggered entrance (`framer-motion`,
  delay = index × 80ms) and hover-lift. Built once so any report/dashboard
  screen can adopt the same look by importing it.
- `src/components/common/PageTransition.tsx` (new) — wraps the routed
  `<Outlet />` in `AppLayout`, keyed by `location.pathname`, so **every**
  page (all ~20, no per-page edit needed) gets a soft fade + rise on
  navigation instead of an abrupt swap.

**Layout restyle** (`src/app/AppLayout.tsx`):
- Sidebar brand mark: flat primary-color box → gradient rounded mark with a
  colored glow shadow, brand name set in Unbounded.
- Active nav item: flat `primary.main` fill → gradient pill with glow
  shadow (mirrors the approved mockup's sliding-pill nav).
- `ThemeToggle` added to the topbar.
- `<Outlet />` wrapped in `PageTransition`.

**Fonts** (`index.html`) — Google Fonts `<link>` (Unbounded, Manrope, Space
Mono) with `preconnect`, replacing the old `@fontsource/inter` package
(uninstalled — no longer used anywhere).

**Dashboard rebuild** (`src/features/dashboard/DashboardPage.tsx`) — the
flagship example of the new system: the six placeholder metric cards (still
showing ₹0 — see "Known issue" below, unchanged from Phase 1) now use
`StatCard` with per-metric icons and accent colors, staggered count-up
entrance, plus a new header row with **Record Sale** / **+ New Invoice**
quick-action buttons linking to the routes those features already ship at.
The old caption *"Available once Sales & Expenses modules ship"* was
removed — those modules shipped in Phases 5/16 and the caption was stale.

**Global CSS** (`src/index.css`) — thin theme-aware scrollbar (most of this
app is tables + a fixed sidebar, and the default scrollbar stood out against
the new look), smooth `background-color` transition on `<body>` for the
mode switch.

## Known issue — RESOLVED same session (see update at the top)

`DashboardPage`'s six stat cards were hardcoded to `0` — dating to Phase 1,
never wired to the real Sales/Expenses data that shipped in later phases.
Originally this phase restyled the cards and fixed the now-inaccurate
caption but deliberately left the data wiring alone; the user then asked
directly why the numbers still showed 0, so it was wired up properly in the
same session. See "Dashboard now wired to real data" below.

## What did NOT change this phase

The ~19 other feature pages (Menu, Inventory, Sales, Reports, Billing,
Expenses, Settings, Restaurant Users, Roles) were not hand-edited. They
inherit the new look automatically wherever they use standard MUI
components (which is everywhere in this codebase) — new colors, rounder
shapes, gradient buttons, wash-style status chips, monospace table headers,
and the page-enter fade all apply without any per-page change. What they do
**not** get automatically: the bespoke `StatCard` count-up treatment on
their own summary numbers (e.g. `SalesReportPage`, `PnLPage`,
`MenuProfitabilityPage`, `MenuCostingPage` all show their own totals in
plain `Card`/`Typography` still) — adopting `StatCard` there is a
mechanical follow-up, not a design decision, whenever it's wanted.

## Verification

- `npm run build` (`tsc -b && vite build`) — clean.
- `npm run lint` (`oxlint`) — same pre-existing warning categories only (2
  new instances of already-accepted categories: `only-export-components` on
  `ThemeModeContext.tsx`, `set-state-in-effect` on `useCountUp.ts` — both
  the same pattern already present in `AuthContext`/`RestaurantContext`).
- **Visual verification via headless Chromium** (this sandbox has no live
  Firestore access, so only the pre-login `LoginPage`/`AuthLayout` could be
  rendered end-to-end): screenshotted dark mode, clicked the toggle,
  screenshotted light mode — both render correctly, the toggle switches
  instantly, computed `font-family` on headings correctly resolves to
  `Unbounded, sans-serif`. The Google Fonts stylesheet itself failed to
  load in this sandbox (`ERR_TUNNEL_CONNECTION_FAILED` — this sandbox's
  network is restricted the same way it's always blocked live Firestore and
  the Firebase emulator download; it is **not** a bug in this code), so the
  screenshots show the system-font fallback rather than the real Unbounded/
  Manrope/Space Mono rendering — the real deployment has normal internet
  access to `fonts.googleapis.com` and will render the actual typefaces.

## Assumptions

- Dark is the default/flagship mode for new visitors (no saved preference)
  — matches "Neon style will be for dark mode" from the user's own framing.
- Money/report figures across the app should eventually use `monoNumeric`
  for a consistent "printed figure" feel, but that's only applied to
  `StatCard` so far, not retrofitted onto every existing table's amount
  columns.
- `package.json`/`package-lock.json` changed (`framer-motion` added,
  `@fontsource/inter` removed) — **the user needs to run `npm install`**
  once after pulling these changes, same as every prior phase that touched
  dependencies (Phase 11's `jspdf` being the precedent).

## Dashboard now wired to real data (same-session follow-up)

The user asked directly why the Dashboard still showed 0 despite having
recorded sales and expenses. `DashboardPage.tsx` now queries real data:

- `listDailySalesForRange` and `listExpensesForRange` (both already used by
  `PnLPage`) are called once each for the month-to-date range
  (`resolveDateRangePreset('thisMonth')` — start of month through today).
  Today's figures are computed as the subset of that same result where
  `date === todayStr` / `expenseDate === todayStr`, so this page never
  fires more reads than `PnLPage` does for an equivalent range — no new
  queries were invented, just the existing range queries reused.
- **Today's Profit / Net Profit (MTD)** = gross profit from sales
  (`sum(profitMinor)`, i.e. revenue minus food cost) minus active
  (non-voided) expenses for that period — the identical formula `PnLPage`
  already uses for `netProfitMinor`, so the Dashboard and the P&L report
  will always agree on the same range.
- **Permission-aware, not just data-aware**: the dailySales Firestore rule
  allows read via `orders.view` OR `reports.view` OR `reports.financial`;
  the expenses rule requires `expense.view`. `DashboardPage` now checks the
  exact same permissions before querying (`canSeeSales`,
  `canSeeExpenses`) — a role with neither (e.g. `kitchen_manager` or
  `inventory_manager`, per `ROLE_PERMISSIONS`) would otherwise hit a
  permission-denied error on page load.
- **`StatCard` gained a `locked` prop** for this: a card the viewer's role
  can't read shows a lock icon and "Ask an owner for access" instead of
  `0` — deliberately not `0`, since `0` on a stat card reads as "nothing
  happened" when the real situation is "you can't see this," and the
  original bug report was exactly that confusion. `cashier` (has
  `orders.view`, not `expense.view`) now sees real Sales figures and
  locked Expense/Profit cards, for example — an honest, role-correct view
  rather than a wrong number.
- Profit cards require **both** `canSeeSales` and `canSeeExpenses` (a true
  net figure needs both inputs) — a role with only one of the two sees
  that card locked rather than a half-computed number.
- No `firestore.rules` change — this reuses existing, already-deployed
  read rules exactly as `PnLPage` does.
- Build/lint verified clean again after this change (same baseline
  warnings only).

## Dashboard trend chart (same-session follow-up)

The user asked to compare Sales, Expenses, and Profit over time — by day,
week, month, or year. `DashboardTrendChart.tsx` (new, rendered below the
stat cards on `DashboardPage`) adds this as a three-line chart with a
segmented Day/Week/Month/Year switcher:

- **New dependency: `recharts` (v3)**. No charting library existed in this
  project before. Chosen over hand-rolling SVG because this is a real,
  ongoing React codebase — `ResponsiveContainer`/`Tooltip`/`Legend` give
  correct resizing, hover, and accessibility behavior for free, and stay
  easy for a future session to extend (e.g. reusing the same chart on
  `PnLPage`) rather than maintaining bespoke chart-drawing code.
- **`src/utils/trendData.ts` (new)** — the bucketing logic, kept separate
  from the chart component so it's independently testable:
  - `resolveTrendWindow(granularity)` — a fixed lookback per granularity,
    picked so the chart always shows a readable ~12-14 points rather than a
    crowded or sparse axis: last 14 days, last 12 weeks, last 12 months, or
    last 5 years.
  - `buildTrendBuckets(granularity)` — the full ordered list of periods in
    that window, including empty ones, so a day with nothing recorded shows
    as a dip to zero rather than a gap in the line.
  - `bucketTrendData(...)` — a single pass over the already-fetched
    `dailySales`/`expenses` rows (one Map per metric, keyed by bucket) that
    sums each row into its bucket. Profit per bucket is gross sales profit
    minus active (non-voided) expenses in that same bucket — the same
    formula used by `PnLPage` and the Dashboard stat cards above it, so all
    three places on the Dashboard/reports agree with each other.
- **One range query per granularity change**, reusing
  `listDailySalesForRange`/`listExpensesForRange` exactly as the stat cards
  do — switching to "Years" doesn't fire four separate queries, it re-runs
  the same two calls over a wider `[start, end]` and re-buckets client-side.
  React Query caches each `(granularity, range)` combination, so flipping
  back to a previously-viewed period is instant.
- **Same permission gating as the stat cards**: `canSeeSales`/
  `canSeeExpenses` (passed down from `DashboardPage`, which already computes
  them against the exact Firestore read rules) control which lines render
  and which query even fires. A role with only one of the two sees only
  that line, plus a caption explaining the others are hidden pending
  access — no Profit line without both, since a real net figure needs both
  inputs. A role with neither sees a locked message instead of an empty
  chart, consistent with the locked `StatCard`s above it.
- **Color mapping matches the stat cards**: Sales uses the same "accent"
  color, Expenses the same "warning" color, Profit the same "positive"
  color, pulled from the same `accentPalette(theme)` helper — so the chart
  reads as a continuation of the cards rather than introducing a new color
  language, and it repaints correctly on the light/dark toggle since it
  reads live theme colors rather than hardcoded hex values.
- **Interaction**: hover shows a tooltip with the exact period and each
  visible metric's currency-formatted value; the Y-axis uses a compact
  currency format (`formatCompactCurrency`, new in `utils/money.ts`, e.g.
  "₹12.5K") to stay readable at "Years" scale; a legend is always shown
  since there is more than one series.
- **Empty state**: if the selected window has no recorded sales or
  expenses at all (e.g. a brand-new restaurant), the chart area shows a
  plain "nothing recorded yet" message instead of a flat zero line.
- No `firestore.rules` change — reuses the same already-deployed read
  rules as everywhere else on the Dashboard.
- New dependency (`recharts`) means **`npm install` is needed again** after
  pulling this change — same as the `framer-motion` addition earlier in
  this phase.

## Search feature (same session, 2026-08-23)

The user asked to add search to Menu Items, and explicitly delegated the
scope decision: *"can we add search feature in menu items and also you
take the decision of wherever search feature is needed."*

- **One shared component, used everywhere**: `src/components/common/
  SearchField.tsx` — a `TextField` with a search icon, a clear button that
  appears once there's text, and an exported `matchesSearch(haystack,
  query)` helper. Matching is case- and diacritic-insensitive (both sides
  are lowercased and run through `.normalize('NFD').replace(/[̀-ͯ]/g,
  '')` before an `.includes()` check), so "café" matches "cafe" and vice
  versa. One component means identical look and matching behavior on
  every page it's added to, rather than ten slightly different reimplementations.
- **Purely client-side, no backend changes at all**: every page's search
  is a plain `.filter()` over a list a `useQuery` call had already fetched
  — no new Firestore query, no new composite index, no `firestore.rules`
  change, and no new npm dependency. Consistent with this app's existing
  Phase 3 precedent (menu-category filtering is also done client-side over
  an already-loaded list).
- **Added to 10 pages**, each searching the fields most useful for finding
  something in a long list:
  - `MenuItemsPage` — name, category, description (the explicit request).
  - `IngredientsPage` — name, category.
  - `RecipesPage` — menu item name, category.
  - `ExpensesPage` — vendor, note, category (folded into the existing
    date-range/category/voided filter row).
  - `InvoicesPage` — invoice number, customer name.
  - `PurchasesPage` — ingredient name, vendor name.
  - `WastePage` — ingredient name, waste reason, note.
  - `MenuProfitabilityPage` — menu item name. The "#1 most profitable"
    badge's rank is tagged from the FULL sorted list before search
    narrows the rows shown, so a search never relabels a lower-ranked
    item as "#1."
  - `DailySalesPage` — menu item name, inside its quantity-entry grid.
  - `NewInvoicePage` — menu item name, inside its quantity-entry grid.
  - For the last two: search only narrows which rows are SHOWN. The
    `quantities` state and every downstream calculation (line totals,
    subtotal, GST, service charge, what actually gets saved/billed) still
    read from the full, unfiltered item list — so typing a quantity for an
    item and then changing the search text so that row disappears never
    silently drops the entered value.
  - Every search-enabled page now distinguishes "no data at all yet"
    (original empty-state copy, generally with a create action) from
    "data exists, nothing matches this search" (new copy, no create
    action) — two different messages instead of one generic "empty" state.
- **Deliberately NOT added to 7 pages**, with the specific reason for each:
  - `MenuCategoriesPage`, `ExpenseCategoriesPage`, `RecurringExpensesPage`
    — short, hand-curated lists where scrolling is never a real problem.
  - `StockLedgerPage` — already has an exact-match "Ingredient" dropdown
    filter; a free-text search box would be redundant next to it.
  - `ExpiryPage` — its query is inherently bounded to "upcoming expiry"
    purchases, short by nature.
  - `SalesReportPage` — a single-day report with two short side-by-side
    ranked tables; low value for the UI cost of adding a search box.
  - `UsersPage` — a small per-restaurant staff roster, not expected to
    grow past a handful of names.
- **Two real bugs caught by `npm run lint` (not `npm run build`)**: on
  `IngredientsPage` and `InvoicesPage`, the new filtered-list `useMemo` was
  initially written after those files' existing
  `if (query.isLoading) return ...; if (query.isError) return ...;` early
  returns — a React Hook not called on every render
  (`react-hooks(rules-of-hooks)`). `npm run build`'s type-checker doesn't
  catch this; only the lint rule does. Fixed by dropping the `useMemo`
  wrapper for a plain `.filter()` at the same spot (these lists are small
  enough that memoizing isn't needed) and removing the resulting unused
  `useMemo` import from both files. Worth remembering for future pages
  with the same load/error-guard shape.
- Eleven files pushed directly to the connected folder: the new
  `SearchField.tsx`, plus `MenuItemsPage.tsx`, `IngredientsPage.tsx`,
  `RecipesPage.tsx`, `ExpensesPage.tsx`, `InvoicesPage.tsx`,
  `PurchasesPage.tsx`, `WastePage.tsx`, `MenuProfitabilityPage.tsx`,
  `DailySalesPage.tsx`, `NewInvoicePage.tsx`. `npm run build` and
  `npm run lint` both verified clean (zero errors; only the same
  pre-existing baseline lint warnings plus one new expected
  `only-export-components` warning on `SearchField.tsx`, which exports
  both a component and a helper function — same pattern already present
  elsewhere in this codebase). No dependency change, no deploy step.

## StatCard extended to all report pages (same session, 2026-08-23)

Explicitly chosen by the user when asked what to build next, after
saying they'd batch-test everything once all phases are done rather than
test as each one lands. This closes out the "not built this phase" note
above about `SalesReportPage`/`PnLPage`/`MenuProfitabilityPage`/
`MenuCostingPage` still showing their headline numbers in a plain local
card.

- Each of those four pages had its own private
  `function StatCard({ label, value: string, sub? })` — a `Paper` with
  two `Typography`s, no animation, no icon. All four were deleted and
  replaced with the real `src/components/common/StatCard` (the same
  component `DashboardPage` uses): numeric `value` + a `format(v)`
  function, an `icon`, an `accent` of `'accent' | 'positive' | 'warning'
  | 'critical'`, an optional `caption`, and a stagger `index` so cards on
  the same page animate in slightly staggered rather than all at once.
- **`SalesReportPage`**: Items sold, Revenue, Food cost, Gross profit,
  Expenses, Net profit.
- **`PnLPage`**: Revenue, Gross profit, Total expenses, Net profit
  (margin %s moved from the old `sub` prop to the new `caption` prop).
- **`MenuCostingPage`**: Target food cost %, Blended food cost %, Items
  over target, No recipe yet. The two cards that previously picked a
  manual `color` (red/green by over/under target) now express that
  through `StatCard`'s `accent` prop instead, falling back to a neutral
  accent when there's no priced data yet (previously these silently
  showed a green "0.0%" with no real signal behind the color).
- **`MenuProfitabilityPage`**: Revenue, Sales-weighted food cost %, Total
  profit, Items over target — same accent-mapping treatment. "Total
  profit" now also turns `'critical'` if the period's total is actually
  negative, which the original plain card never signaled at all.
- Icons reuse the Dashboard's own vocabulary for consistency: Paid =
  sales/revenue, ReceiptLong = cost, TrendingUp = gross
  profit/growth, AccountBalanceWallet = expenses, Savings = net profit,
  GpsFixed = a target figure, WarningAmber = an over-target/at-risk count.
- Ratio/percentage figures (e.g. "Items over target: 3 / 8") are
  expressed via `StatCard`'s `format(v)` callback closing over the fixed
  denominator or `%` suffix — `StatCard` itself only animates a single
  raw number, so the numerator or percentage counts up while the rest of
  the string stays static.
- **Purely a display-layer change** — re-read each page's underlying
  totals/aggregation logic before and after to confirm nothing about the
  actual numbers, queries, or permission gating moved; only how those
  same numbers are presented changed.
- No new dependency, no `firestore.rules` change, no deploy step needed.
  `npm run build`/`npm run lint` both reconfirmed clean (zero errors,
  same baseline warnings as every prior phase this session).
- **This was the last "known, flagged, mechanical follow-up" noted
  anywhere in the project docs** — there is no longer a page in the app
  showing its stat cards in the old plain style; every screen with
  summary figures now uses the one real `StatCard` component.
