# Phase 18 — "Aurora Bento" app-wide redesign

> **Bug fix (2026-09-17, same day, before live-testing continued)**: the
> desktop sidebar shipped broken — see "Bug fix: floating sidebar broken
> and overlapping" near the end of this report.

## Why

The user felt the Phase 17 "Neon Service" design (still the app's only visual
system since it shipped) had gotten stale — "too boring" — and specifically
wanted a genuine layout/structural rethink, not just a color swap, with real
attention paid to the mobile experience being *designed* for touch rather
than a shrunk-down desktop drawer.

## Process

Three fully distinct directions were mocked up as live artboards (desktop +
mobile each) on a design canvas and shown to the user for comparison, using
the same real dashboard data in each so the comparison was honest:

1. **Bento Fresh** — light, airy, coral/mint bento-grid dashboard with a
   floating rounded dock sidebar and a floating pill + FAB on mobile.
2. **Kinetic Brutalist** — bold, high-contrast, thick borders, hard offset
   shadows, blocky rectangular bottom-nav tabs on mobile.
3. **Ambient Glass** — dark glassmorphism with blurred aurora light blooms
   behind translucent frosted panels, floating glass pill nav + swipe-up
   sheet handle on mobile.

The user picked a merge: **Bento Fresh's layout** (the floating dock sidebar,
the bento-grid dashboard arrangement, the hero-card-then-two-up mobile
stacking) rebuilt in **Ambient Glass's dark palette** (deep navy background,
aurora blooms, frosted glass panels) with **Ambient Glass's mobile nav
pattern** (glass pill bottom nav + swipe-up sheet). A fourth "merged" artboard
pair was mocked up combining exactly those three picks and confirmed with the
user before any real code was touched.

## What shipped — "Aurora Bento" design system

### `src/app/theme.ts` (full rewrite)
- New token set for both modes. Dark (flagship, and the default — unchanged
  from Phase 17's decision to default new visitors to dark):
  bg `#0F1024`, glass surface `rgba(255,255,255,0.06)` with a 20px backdrop
  blur, ink `#F1F0FA`, teal accent `#2DD4BF` (primary), violet `#8B5CF6`
  (secondary — used in gradients, avatars, the FAB), emerald `#34D399`
  (success/positive), amber `#FBBF24` (warning), rose `#FB7185`
  (critical/error).
- Light companion (Bento-style — solid white cards, soft shadows, no blur):
  bg `#F4F7F3`, ink `#1C2321`, the same five-hue family deepened for
  contrast on white (teal `#0D9488`, violet `#7C3AED`, emerald `#059669`,
  amber `#B45309`, rose `#E11D48`).
- Typography moved from Unbounded/Manrope/Space Mono to **Plus Jakarta
  Sans** (headings + body, differentiated by weight rather than a separate
  serif) and **Fira Code** for `monoNumeric` (money/data figures) — matching
  the Ambient Glass mockup's type system.
- `shape.borderRadius` raised from 14 to 20 for the softer bento-style
  rounding.
- `MuiCard`/`MuiPaper`/`MuiDrawer`/`MuiAppBar` overrides now paint the glass
  surface + backdrop blur in dark mode (solid white + soft shadow in light
  mode) — this is what makes every existing screen's cards/tables/dialogs
  pick up the new look automatically, with no per-page edits needed, exactly
  as the Phase 17 theme's own design intended.
- Added `MuiMenu`/`MuiDialog` overrides (solid `surfaceSolid` navy, not
  glass — dropdowns/dialogs need to stay legible over whatever's behind
  them, not blur it) — Phase 17's theme didn't need these since it had no
  translucent surfaces to distinguish from.
- Exported `AURORA_STOPS` (the three aurora blob colors) for the new
  `AuroraBackdrop` component.
- Button gradient, nav active-state gradient, and logo-badge gradient all
  changed from the old single-hue accent gradient to a teal→violet
  two-stop gradient, matching the merged mockup's brand treatment.

### `src/components/common/AuroraBackdrop.tsx` (new)
Three fixed, pointer-events-none blurred blobs (teal/violet/pink) — shared
between `AppLayout` (main app) and `AuthLayout` (login/signup) so dark mode
looks the same from the first screen a visitor sees, not just after login.

### `src/app/AppLayout.tsx` (rewrite)
- **Desktop (`md+`)**: the permanent `Drawer` is now inset with a 20px
  margin on all sides and rounded corners instead of flush to the screen
  edge — the "floating glass dock" from the Bento Fresh mockup. Content and
  the `AppBar` are offset accordingly (`SIDEBAR_OFFSET = 20 + 264 + 20`).
- **Mobile (`xs`/`sm`)**: the old hamburger + full-height temporary `Drawer`
  is gone entirely. In its place:
  - A **floating glass pill bottom nav** (fixed, 16px inset from the
    screen edges, rounded-full, backdrop-blurred) with Dashboard, Daily
    Sales, a center gradient **FAB** that jumps straight to
    `/app/billing/invoices/new`, Reports, and a **More** tab.
  - **More** opens a **swipe-up glass sheet** (`Drawer anchor="bottom"`,
    rounded top corners, a decorative grab-handle bar) containing the full
    nav tree (all sections/children, reusing the same `NavSectionItem`
    logic as the desktop sidebar) plus "Switch Restaurant" — so nothing
    reachable on desktop became unreachable on mobile, it's just one tap
    deeper for the sections people don't need every day.
  - Main content gets extra bottom padding on mobile so the last card in
    any page isn't hidden behind the floating nav.
- `AuroraBackdrop` renders behind everything in dark mode only (no aurora
  in light mode, which doesn't have the glass panels it's meant to show
  through).
- `AppBar` lost its hamburger button (nothing to open on mobile anymore)
  and is now transparent/glass-blurred instead of a flat bordered bar.

### `src/features/auth/AuthLayout.tsx`
Got the same `AuroraBackdrop` (dark mode) and the teal→violet logo-badge
gradient, so login/signup match the redesigned app instead of still looking
like Phase 17.

### `src/components/common/StatCard.tsx`
Dropped the colored **left accent bar** — a Neon Service signature that
read as dated next to the new glass panels with no left-border cards
anywhere else in the system. The accent color now lives only in the icon
chip tint and the hover glow (`box-shadow` bloom in dark mode). Every page
that already uses `StatCard` (Dashboard, Sales Report, P&L, Menu Costing,
Menu Profitability — see Phase 17's own StatCard-extension entry) picked
this up automatically.

### `src/contexts/ThemeModeContext.tsx`
Comment-only update — the "why dark is default" note now points at this
phase instead of Phase 17.

## What did *not* need touching

Every other screen in the app (Menu, Inventory, Billing, Expenses, all the
CRUD tables and forms) builds its UI out of MUI `Card`/`Paper`/`Button`/
`Chip`/`TableCell`/`Dialog`/`OutlinedInput` — all styled centrally in
`theme.ts` — and a grep confirmed no screen hardcodes an old palette hex
value outside `theme.ts` itself. So the glass-panel, teal/violet accent,
Plus Jakarta Sans/Fira Code look now applies app-wide from these six file
changes, without hand-editing every feature page. This is the same
"redesign applies without touching each screen" property Phase 17's theme
was built for, and it held up for this second redesign too.

## Verification

- `npx tsc --noEmit` — clean.
- `npx oxlint src` — clean (only pre-existing warnings unrelated to this
  change: `only-export-components` / `set-state-in-effect` in files this
  phase didn't touch).
- `npm run build` — clean production build.
- Pushed to the user's connected project folder
  (`D:\Projects\sites\Restaurant Mgmt\restaurant`) via the device bridge:
  `index.html`, `src/app/theme.ts`, `src/app/AppLayout.tsx`,
  `src/components/common/StatCard.tsx`,
  `src/components/common/AuroraBackdrop.tsx` (new file),
  `src/features/auth/AuthLayout.tsx`, `src/contexts/ThemeModeContext.tsx`.

No interim testing was requested from the user for this phase — per their
standing instruction (2026-08-23), they're batching all testing until every
phase is done and want a consolidated checklist at that point. This phase's
scenarios (desktop floating sidebar nav, mobile bottom nav + FAB + More
sheet, light/dark toggle, StatCard hover glow) should be folded into that
eventual checklist rather than tested now.

## Bug fix: floating sidebar broken and overlapping

The user opened the app right after this phase shipped (ahead of the
batched testing they'd said they'd do later — screenshots showed the issue
immediately) and reported the desktop sidebar looked "broken and
overlapping." Screenshot showed the floating sidebar's bottom corners
melted into a heavily rounded, pinched shape well above the panel's actual
bottom edge, and the main content appeared to render underneath/behind the
sidebar rather than beside it.

**Two real bugs, both introduced by this phase's `AppLayout.tsx` rewrite:**

1. **Main content wasn't offset past the sidebar at all.** The old
   `AppLayout` wrapped both the temporary (mobile) and permanent (desktop)
   `Drawer`s in a `<Box component="nav" sx={{ width: DRAWER_WIDTH,
   flexShrink: 0 }}>` — that wrapper is what reserves the sidebar's space
   in the flex row, since a permanent `Drawer`'s `.MuiDrawer-paper` is
   `position: fixed` (taken out of normal flow) and its own root element
   has no width unless given one. This phase's rewrite dropped that
   wrapper and never gave the `Drawer` itself (only its nested paper) a
   width — so no space was reserved for it at all, and the main content
   `Box`, despite being explicitly sized to `calc(100% - offset)`, started
   painting from `x=0` with nothing pushing it right, landing directly
   underneath the fixed-position floating sidebar. **Fix**: gave the
   `Drawer` root itself `width: SIDEBAR_OFFSET, flexShrink: 0` in its own
   `sx` (the standard MUI permanent-drawer pattern), and simplified the
   main content `Box` back to plain `flexGrow: 1` (+ `minWidth: 0`) so it
   fills whatever space the flex row leaves after the sidebar — no manual
   width/margin math needed once the sidebar is a real flex participant.
2. **`borderRadius: 4` on the sidebar's `.MuiDrawer-paper` rendered as
   80px, not 4px.** This project raised `theme.shape.borderRadius` from
   14 to 20 as part of the "Aurora Bento" tokens. MUI's `sx` prop treats a
   *bare number* passed to `borderRadius` (anywhere in the object,
   including inside a nested selector like `'& .MuiDrawer-paper'`) as a
   multiplier on `theme.shape.borderRadius`, not a literal pixel value —
   so `borderRadius: 4` became `4 × 20 = 80px`. On a 264px-wide sidebar
   panel, an 80px corner radius is enormous, which is exactly the
   melted/pinched shape in the user's screenshot. The same bug, less
   visually obvious, was hiding in five nav-item `ListItemButton`s
   (`borderRadius: 2` → 40px, too pill-shaped for a ~40px-tall row), the
   mobile bottom-nav pill container, the "More" sheet's grab-handle dot
   (harmless in effect — both were already ≥999, which saturates to a
   full pill regardless of the exact multiplier), and two **pre-existing**
   files that never changed this phase but were silently affected by the
   shape.borderRadius bump anyway: `MenuItemsPage.tsx`'s item-card
   radius (28px → 40px) and `DashboardTrendChart.tsx`'s tooltip radius
   (21px → 30px). **Fix**: every `borderRadius` value inside an `sx` prop
   across the app is now an explicit pixel string (`'28px'`, `'14px'`,
   `'999px'`, `'22px'`), never a bare number, so it can never again be
   silently reinterpreted by a future `theme.shape.borderRadius` change.
   MUI theme `styleOverrides` (in `theme.ts`) were never affected by this
   — those are plain CSS-in-JS objects, not run through the `sx`
   transform, so a bare number there really is a literal pixel value.

Files touched: `src/app/AppLayout.tsx` (both bugs),
`src/features/menu/MenuItemsPage.tsx`,
`src/features/dashboard/DashboardTrendChart.tsx` (radius-only, side-effect
cleanup). `npx tsc --noEmit`, `npx oxlint src`, and `npm run build` all
reconfirmed clean. Pushed to the user's connected folder the same way as
the rest of this phase.

## Bug fix #2: active nav item's "abrupt background color change"

Immediately after the fix above, the user flagged the active ("Dashboard")
sidebar item itself: a hard, jarring rectangle of solid color against the
translucent glass sidebar. Root cause: the active-state style
(`'&.active'` on the nav `ListItemButton`) was still the OPAQUE two-color
gradient pill from the earlier Bento Fresh mockup direction (solid
`linear-gradient(teal, violet)` fill, no transparency) — but the user's
actual chosen direction is Bento Fresh's *layout* with Ambient Glass's
*dark palette*, and the confirmed merged mockup's own active-nav-item
markup (`Merged-Desktop.dc.html`) uses a **translucent tinted highlight +
glow** (`background: rgba(255,255,255,0.12)`, a faint white border, and a
soft `box-shadow` glow in the accent color) — not a solid pill. Every
other surface in dark mode (cards, the sidebar itself, the AppBar) is
glassy/translucent; only this one active-state rule had been left as a
solid opaque block, which is exactly what read as "abrupt" next to
everything else.

**Fix**: `'&.active'` is now mode-aware — dark mode gets the translucent
highlight + glow treatment (icon tinted the accent teal, label stays the
normal ink color, background/border/shadow all soft and see-through);
light mode (which has no glass panels to clash with) keeps the original
solid gradient pill, since that's the correct treatment there (matching
Bento Fresh's own light-mode mockup). One file changed
(`src/app/AppLayout.tsx`), `npx tsc --noEmit`/`npx oxlint src`/`npm run
build` all clean, pushed to the connected folder.

## Follow-up: nav sections now a single-open accordion

User-requested refinement, same day: the sidebar's collapsible sections
(Restaurant, Menu, Sales, Inventory, Billing, Expenses, Reports) could all
be expanded at once, so the list could grow tall enough to need scrolling
even in the floating sidebar's fixed height. Changed the open/closed state
from a `Record<string, boolean>` (independent per-section toggles) to a
single `openSection: string | null` — expanding one section now collapses
whichever other one was open, standard accordion behavior. Since both the
desktop floating sidebar and the mobile "More" swipe-up sheet render the
exact same `navContent()` nav tree off this one shared state, the
accordion behavior is automatically consistent in both places with no
separate mobile-specific change needed. One file changed
(`src/app/AppLayout.tsx`), build/lint clean, pushed to the connected
folder.
