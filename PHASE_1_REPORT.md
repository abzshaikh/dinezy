# Phase 1 Report — Foundation

## What was implemented

Full authentication (register, login, logout, forgot/reset password, session
persistence), a `users/{userId}` profile document created on signup,
protected routing, restaurant creation and a "My Restaurants" picker with
switch/persist, a `RestaurantContext` exposing the selected restaurant plus
the current user's role and resolved permission set, a fixed 6-role
permission model (Owner / Manager / Kitchen Manager / Cashier / Inventory
Manager / Accountant), the full app shell (topbar with role chip and account
menu, sidebar showing every nav section from the product spec — only
Dashboard is enabled; everything else renders disabled with a "coming in a
later phase" tooltip), a placeholder financial dashboard, and the shared
money/date/error-handling utilities every later phase builds on (integer
paise for money, never floats).

Also added after the initial Phase 1 cut, once the user's real Firebase
project turned out to be on the Spark (free) plan: Cloudinary-based image
hosting (`src/services/cloudinaryService.ts`, `src/config/cloudinary.ts`,
`src/components/common/ImageUploadField.tsx`) in place of Firebase Storage,
since Cloud Storage for Firebase now requires the Blaze billing plan even
for tiny usage.

## Files created

39+ files under `src/` — types (`user`, `restaurant`, `restaurantUser`,
`permissions`), services (`authService`, `restaurantService`,
`cloudinaryService`), contexts (`AuthContext`, `RestaurantContext`), routes
(`ProtectedRoute`, `RequireRestaurant`), common components
(`LoadingIndicator`, `EmptyState`, `ErrorState`, `ConfirmDialog`,
`CurrencyDisplay`, `PermissionGuard`, `ImageUploadField`), the auth pages,
restaurant pages, dashboard page, and app shell — plus `firebase.json`,
`.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `.env.local` /
`.env.example`, and this README.

## Database collections affected

`users`, `restaurants`, `restaurantUsers` — per the agreed schema (nested
subcollections under `restaurants/{restaurantId}/...` for everything
restaurant-scoped, starting from Phase 3). `firestore.rules` enforces: a
user reads only their own profile; only members read a restaurant; only the
owner-at-creation-time path may write a `restaurantUsers` doc (invites are
Phase 2 work). No composite indexes were needed yet.

## Business logic worth noting

- Restaurant creation writes the `restaurants` doc and the owner's
  `restaurantUsers` doc as one atomic Firestore batch — never two
  independent writes that could drift apart.
- Money is stored as integer minor units (paise) everywhere; `src/utils/money.ts`
  is the only place that converts to/from display format.
- Images are stored as Cloudinary URL strings on the owning document, never
  as binary blobs in Firestore.

## Assumptions

- Local Firebase Emulator Suite for day-to-day development (the user's real
  project is wired for production/testing use, not local dev by default —
  flip `.env.local`'s `VITE_USE_FIREBASE_EMULATOR` to switch).
- Embedded array line items on orders/purchases (not separate collections),
  and fixed role templates with permission overrides (not a custom-role
  builder) — both confirmed by the user.
- Default currency INR / timezone Asia/Kolkata on new restaurants.
- Cloudinary free tier for image hosting (confirmed by the user), in place
  of Firebase Storage (blocked on their Spark-plan project).

## Remaining / known issues

- Production bundle is a single ~1.26MB chunk (no code-splitting yet) —
  worth revisiting in Phase 12 polish, not a functional problem now.
- Inviting non-owner restaurant users isn't wired up yet — needs a
  controlled write path (a Cloud Function is the likely choice) — Phase 2.
- Cloudinary unsigned uploads can't delete images client-side (deletion
  needs a signed request with the API secret, which must never live in
  client code) — replacing an image orphans the old one in Cloudinary.
  Harmless well within the 25GB free tier for one restaurant's photos; a
  cleanup path would need a small trusted backend later.
- This project could not be exercised against the Firestore emulator live
  inside the original build sandbox (network egress to
  `storage.googleapis.com`, needed to download the emulator JAR, was
  blocked there). The Auth emulator WAS verified live. Recommended first
  step in your own environment: `npm install && npm run emulators` (one
  terminal) and `npm run dev` (another), then register two users in two
  browser sessions and confirm the second can't see the first's restaurant.

## Build/test result

`npm run build` (tsc -b + vite build) passes clean. `oxlint` shows only two
expected warnings on the context files (React's "only export components"
fast-refresh hint — standard for a file exporting both a Provider and a
hook) — no real issues.
