# Phase 8 Report — Restaurant Profile & Settings

## Why this phase, and why now

Asked what should come next, you picked "Restaurant Profile/Settings" — the
one disabled nav placeholder left over from Phase 1 that's pure
infrastructure rather than a new business-data collection. It's also the
last piece of the `Restaurant` document (name, address, GST/FSSAI numbers,
logo, currency, and the `RestaurantSettings` block — GST %, service charge
%, default units, financial year start, invoice numbering, target food
cost %) that's had a full data model since Phase 1 but no way to edit any
of it after creation. You separately said you'd rather keep building than
pause to live-test Phases 3–7 first — noted, and still on the list
whenever you're ready.

## What was implemented

- **Restaurant Profile page** (`Restaurant → Restaurant Profile`,
  `/app/restaurant/profile`) — edit everything about the restaurant that
  was previously only settable at creation time (`CreateRestaurantPage`):
  restaurant/legal name, address/city/state/country/pincode, phone, email,
  GST/FSSAI numbers, currency, timezone, and a logo (Cloudinary upload,
  same control used for menu item photos).
- **Settings section on the same page** — the `RestaurantSettings` block
  that's existed in the data model since Phase 1 but was never editable:
  GST %, service charge %, default weight/volume unit (used as the default
  when adding a new ingredient), financial year start month, invoice
  prefix/next number, and target food cost % (the benchmark a future
  Menu Costing / Pricing Analysis phase would compare actual recipe margins
  against).
- **Read-only fallback for anyone without `restaurant.settings`** — same
  page, same route, but the form fields are replaced with a simple
  read-only field list and a note to ask an owner, rather than hiding the
  page or erroring.
- **`restaurant.settings` — the first phase to actually use this
  permission.** It's existed in `PERMISSIONS`/`ROLE_PERMISSIONS` since
  Phase 1 (owner-only by default, nothing else granted it), reserved for
  exactly this. No role or permission-table changes were needed.
- **A small `firestore.rules` upgrade**: the restaurant document's `update`
  rule changed from a hard-coded `isOwner(restaurantId)` check to
  `hasPermission(restaurantId, 'restaurant.settings')`. Functionally
  identical today (only the owner has that permission by default), but now
  an owner CAN grant profile/settings editing to someone else — an
  accountant, say — via a permission override, without a role change,
  consistent with how every other permission in the app already works.
  Ownership (`ownerId`) and the tenant ID (`restaurantId`) still can never
  change through this path, and the rule now also locks `status` (active/
  suspended/archived) from changing here — archiving stays a separate,
  not-yet-built feature, not something this form can accidentally trigger.

## Files created

- `src/features/restaurants/RestaurantProfilePage.tsx` — the page (edit
  form + read-only fallback).

## Files modified

- `src/types/restaurant.ts` — added `UpdateRestaurantInput`.
- `src/services/restaurantService.ts` — added `updateRestaurant`.
- `src/utils/validation.ts` — added `restaurantProfileSchema`.
- `src/app/navConfig.ts` — enabled "Restaurant Profile" (existed as a
  disabled placeholder since Phase 1).
- `src/App.tsx` — added the `/app/restaurant/profile` route.
- `firestore.rules` — changed the `restaurants/{restaurantId}` `update`
  rule as described above; updated the file-header comment.

## Database collections affected

None — no new collections. This phase only adds an `update` path to the
existing `restaurants/{restaurantId}` document (Phase 1). No changes to
`firestore.indexes.json` — nothing here is a query.

## Business logic worth noting

- **Changing currency here does NOT convert any previously recorded
  amounts.** Every stored `*Minor` figure (menu prices, ingredient costs,
  sales revenue, expenses) stays the same integer — only the currency
  *label* used to format and display it changes going forward. A form
  helper text says this explicitly under the Currency field. If you
  actually operate in a different currency, this is a display setting, not
  a conversion tool.
- **The Settings block (GST %, service charge %, invoice numbering) is
  stored but not yet CONSUMED by anything else in the app.** These fields
  were reserved in the data model since Phase 1 for future billing/invoice
  features that don't exist yet — Phase 8 is the first phase to make them
  editable, but no current page reads `gstPercent`/`serviceChargePercent`/
  `invoicePrefix`/`nextInvoiceNumber` to actually apply them anywhere.
  `targetFoodCostPercent` is similarly stored for a future Menu Costing/
  Pricing Analysis phase to compare against. Treat this section as "define
  now, wire up later" rather than something with visible effect today.
- **The top-level "Settings" nav placeholder (`/app/settings`) stays
  disabled — deliberately not folded into this phase.** It's a separate,
  still-undefined nav slot from Phase 1 (most likely account/app-level
  preferences rather than restaurant business data) — different in kind
  from the Restaurant Profile page, so building this phase didn't assume
  what that one should contain.
- **Logo upload isn't shown anywhere else in the app yet** (e.g. the top
  bar, receipts) — it's stored on `Restaurant.logo` and shown on this page,
  same "define now, wire up later" situation as the Settings fields above.
- **The permission-override capability this phase enables is worth
  knowing about even though nobody's used it yet**: an owner can now go to
  Users → (a member) → grant `restaurant.settings`, and that person can
  edit the restaurant profile without being made an owner. Nothing in the
  UI surfaces this as a suggestion — it's available the same way every
  other per-user override already is, via the existing Roles &
  Permissions / member-editing flow from Phase 2.

## Assumptions

- **No audit trail on profile/settings changes** — unlike expenses
  (Phase 6) or the stock ledger (Phase 4), an edit here just overwrites the
  restaurant document; there's no history of who changed the GST % last
  Tuesday. Worth adding if this ever becomes a compliance concern.
- **No restaurant deletion or archiving from this page** — `status` is
  explicitly locked out of this update path (see above); archiving a
  restaurant remains a not-yet-built feature.
- **Invoice numbering is just a stored counter, not enforced anywhere** —
  setting "Next invoice number" here doesn't currently auto-increment on
  any action, since no invoice-generating feature exists yet.

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress blocks `firestore.googleapis.com`, so none of this could be
  exercised live against your real Firebase project from inside this
  environment. Build and typecheck are clean; live verification needs to
  happen on your machine (see below).
- Phases 3 through 8 all remain not-yet-live-tested by you against the real
  project — still on the list whenever you're ready to switch from
  building to verifying.

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same 5 pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 8 code.

## How to verify on your machine

1. `npm install` (only if you haven't already).
2. Deploy the updated rule: `firebase deploy --only firestore:rules --project restaurant-management-553db`
   (no new composite indexes this phase).
3. `npm run dev`, log in as the restaurant owner, open **Restaurant →
   Restaurant Profile**.
4. Change a few business-info fields (e.g. address, phone) and a couple of
   settings fields (e.g. GST %, target food cost %), upload a logo, and
   save. Confirm a success toast appears and the values persist after a
   page refresh.
5. Check that changing currency updates how amounts display elsewhere in
   the app (e.g. the Sales Report) without altering any of the underlying
   numbers.
6. If you have a second test account WITHOUT `restaurant.settings` (any
   non-owner role, by default), open the same page and confirm you see the
   read-only view with the "ask an owner" note instead of an editable
   form or an error.
7. Optional: as the owner, grant `restaurant.settings` to that second
   account via Users → permission overrides (Phase 2's flow), then confirm
   that account can now edit and save this page too.
