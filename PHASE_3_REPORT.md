# Phase 3 Report — Menu Categories & Menu Items

## What was implemented

Menu management for a restaurant: an owner (or anyone with the right
permission) can create, edit, and archive/restore menu categories (e.g.
Starters, Mains, Desserts), and create, edit, price, photograph, and
archive/restore menu items within those categories. Each item also has an
independent "available today" toggle for temporary out-of-stock situations,
separate from the longer-lived archive flag. A category can't be
permanently deleted while it still has menu items in it — the UI blocks
that and tells you to move or delete the items first (or just archive the
category instead, which is reversible).

This is scoped exactly to categories and items — recipes (ingredient-level
costing) and menu costing are separate, later phases; they need the
Inventory phase's ingredient data to mean anything, so building them now
would be premature.

## Files created

- `src/types/menu.ts` — `MenuCategory`, `CreateMenuCategoryInput`,
  `MenuItem`, `CreateMenuItemInput`, `DietaryType` + labels.
- `src/services/menuService.ts` — categories (list/create/update/
  archive-restore/delete-if-empty) and items (list/create/update/
  set-availability/set-active/delete).
- `src/features/menu/MenuCategoriesPage.tsx` — category table.
- `src/features/menu/CategoryFormDialog.tsx` — create/edit category form.
- `src/features/menu/MenuItemsPage.tsx` — item card grid, filterable by
  category.
- `src/features/menu/MenuItemFormDialog.tsx` — create/edit item form
  (photo, category, name, description, price, dietary marker, display
  order).

## Files modified

- `src/types/index.ts` — added `export * from './menu';`.
- `src/utils/validation.ts` — added `menuCategorySchema`, `menuItemSchema`.
- `src/app/navConfig.ts` — enabled the "Categories" and "Menu Items" nav
  items under Menu.
- `src/App.tsx` — added `/app/menu/categories` and `/app/menu/items`
  routes.
- `firestore.rules` — added `menuCategories`/`menuItems` subcollection
  rules, and a new general-purpose `hasPermission(restaurantId,
  permission)` helper (see below).

## Database collections affected

- `restaurants/{restaurantId}/menuCategories/{categoryId}` (new
  subcollection).
- `restaurants/{restaurantId}/menuItems/{itemId}` (new subcollection).

No changes to `firestore.indexes.json` — both list queries
(`listCategories`, `listMenuItems`) order on a single field with no
`where()` filter, which Firestore indexes automatically. Filtering by
category in the Menu Items page is done client-side over the
already-fetched list instead of a server-side `where('categoryId', '==',
...)` query, specifically to avoid needing another composite index
deploy — see the note in `menuService.ts` and the Phase 2 lesson about
missing indexes only surfacing at runtime, not at build time.

## Business logic worth noting

- **`hasPermission()` — a real permission-resolution rule helper, not just
  a role check.** Every prior rule in this app (`canManageUsers`,
  `isOwner`) checks a member's `role` directly and explicitly does NOT
  consider `permissionOverrides` — documented as an intentional
  simplification since `users.manage` is owner-only by design. Menu
  actions are different: `menu.create`/`menu.edit`/`menu.delete` are NOT
  granted to most roles by default (only `owner` has them; `manager`,
  `kitchen_manager`, and `cashier` only get `menu.view`), but the whole
  point of the Phase 2 permission-overrides system is to let an owner
  grant an individual person `menu.edit` without changing their role. So
  the menu rules needed a rule-side function that replicates
  `resolvePermissions()` from `src/types/permissions.ts` exactly: role
  defaults, then per-permission overrides layered on top (grant if
  `overrides[permission] == true`, revoke if explicitly `false`, otherwise
  fall back to the role default). This required hand-mirroring
  `ROLE_PERMISSIONS` as a `rolePermissions(role)` function in rules
  language, since rules can't import the TS source of truth — **if you
  ever change `ROLE_PERMISSIONS` in `src/types/permissions.ts`, update
  `rolePermissions()` in `firestore.rules` to match**, or a role's
  effective permissions will silently diverge between the client-side
  `PermissionGuard` (which reads the real TS source) and what the server
  actually allows.
- **Query-provability, applied correctly this time.** The
  `menuCategories`/`menuItems` list queries are plain subcollection
  queries (`restaurants/{oneSpecificRestaurantId}/menuItems`), not
  `collectionGroup()` queries — `restaurantId` is always pinned to one
  literal value by the query's own path, exactly the safe pattern
  identified during Phase 2's invite-feature incident (see
  `PHASE_2_REPORT.md`). `hasPermission()`'s internal `get()` call is safe
  here for the same reason isMember()/isOwner() have always been safe for
  the `restaurants/{restaurantId}` and `restaurantUsers` reads.
- **Money.** `priceMinor` follows the same integer-minor-units convention
  as everywhere else (`src/utils/money.ts`) — the form collects a decimal
  price in the restaurant's currency and converts with `toMinor()`/
  `fromMinor()` at the form boundary, never storing or computing with a
  float.
- **Two independent "off" states, on purpose.** `isAvailable` (today's
  86-list — ran out of an ingredient, temporary) and `isActive`
  (longer-lived archive — removed from the menu, e.g. seasonal item) are
  separate fields so a manager flipping availability during a dinner rush
  doesn't accidentally look like a permanent menu change, and vice versa.
- **z.coerce vs plain numbers in Zod schemas.** `menuCategorySchema` and
  `menuItemSchema` use plain `z.number()` for `displayOrder`/`price`, NOT
  `z.coerce.number()`. `z.coerce.number()` makes the schema's *input* type
  `unknown`, which breaks `useForm<FormValues>()`'s type inference against
  `@hookform/resolvers/zod` (a known type-inference mismatch between
  react-hook-form and zod coercion). The fix used throughout: keep the
  field as `z.number()` and convert the DOM input string to a number via
  react-hook-form's own `register(field, { valueAsNumber: true })` instead
  — worth remembering for any future numeric form field in this app rather
  than rediscovering this build error again.

## Assumptions

- `inventory_manager` and `accountant` roles do NOT have `menu.view` by
  default (per the existing `ROLE_PERMISSIONS` table from Phase 2) — they
  won't see the Menu Categories/Menu Items pages at all unless granted an
  override. This wasn't a new decision made in this phase; it's just the
  first time it has a visible effect, since Phase 2's Users/Roles pages
  were gated by `users.manage`/plain membership, not `menu.view`.
- Deleting a category is blocked (client-side check) if it still has any
  menu items, active or archived. There's no "force delete and cascade" —
  the safer path is always to move or delete the items first.
- No drag-and-drop reordering — `displayOrder` is a plain number field in
  the create/edit form. Fine for the likely scale of a single restaurant's
  menu; worth adding a drag handle in a future polish pass if it becomes
  annoying to renumber by hand.
- No customer-facing menu view yet (e.g. a public menu page or QR-code
  menu) — this phase is the owner/staff-facing management screens only.

## Remaining / known issues

- Same sandbox limitation as Phases 1 and 2: this container's network
  egress blocks `firestore.googleapis.com` and `api.cloudinary.com`, so
  none of this could be exercised live against your real Firebase project
  or Cloudinary from inside this environment. Build and typecheck are
  clean; live verification needs to happen on your machine (see below).
- No bulk import (e.g. CSV) for menu items — one at a time via the form.
  Worth revisiting if you're digitizing an existing large printed menu.

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same pre-existing warnings from Phase 1/2 context files (fast-refresh
hints on files that export both a Provider and a hook) — nothing new from
Phase 3 code.

## How to verify on your machine

1. `npm install` (only if you haven't already).
2. Deploy the updated rules: `firebase deploy --only firestore:rules --project restaurant-management-553db` (no index changes this phase, so `firestore:indexes` isn't needed).
3. `npm run dev`, log in as the restaurant owner, open **Menu → Categories**.
   Create 2-3 categories (e.g. Starters, Mains, Desserts).
4. Open **Menu → Menu Items**, create a few items across those categories —
   try uploading a photo, setting a price, and picking a dietary marker.
5. Toggle an item's "Available" switch off/on and confirm it updates
   immediately without a full page reload.
6. Archive a category or item and confirm it shows an "Archived" chip and
   dims, then restore it.
7. Try deleting a category that still has items in it — confirm you get
   the friendly "move or delete those first" error rather than a raw
   Firestore error.
8. If you have a second test account with a non-owner role (there isn't
   currently a way to add one — see `PHASE_2_REPORT.md`'s Addendum 4 — so
   this step may need to wait for a future phase), confirm that a role
   without `menu.create`/`menu.edit` sees the pages read-only, and that
   granting a `menu.edit` permission override to that role via **Users →
   permission overrides icon** makes editing work for that person without
   changing their role.
