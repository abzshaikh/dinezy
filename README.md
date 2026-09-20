# Restaurant Management System (RMS)

A multi-tenant restaurant management system: menu, raw-material inventory,
recipe-based costing, purchases, expenses, sales, and profit & loss —
built so an owner can answer "how much did I make, how much did I spend,
what does each dish actually cost, and am I profitable?"

This is **Phase 18 of 18** — see `PHASE_1_REPORT.md` through
`PHASE_18_REPORT.md` for what's implemented so far. Phases 1-16 completed
the original candidate backlog (Suppliers and Orders/POS remain permanently
excluded — see `PHASE_16_REPORT.md`'s "Permission design" for how billing
avoids being a reintroduction of Orders/POS). Phase 17 and Phase 18 are
both full UI design-system revamps requested directly by the user, not
backlog items — Phase 18 ("Aurora Bento") replaced Phase 17's ("Neon
Service") palette/layout/mobile-nav design about a month later — see
`PHASE_17_REPORT.md` and `PHASE_18_REPORT.md`.

> **Phase 17 is a UI/design-system revamp ("Neon Service")** — new light +
> dark themes with a real toggle (defaults to dark), Unbounded/Manrope/Space
> Mono typefaces, gradient buttons, animated stat cards, and a page-transition
> fade on every screen. **Adds a new dependency (`framer-motion`) and drops
> one (`@fontsource/inter`) — run `npm install` once after pulling.** No
> `firestore.rules` changes. See `PHASE_17_REPORT.md` for what was (and
> wasn't) restyled, and its "Known issue" note about the Dashboard's
> still-placeholder numbers (pre-existing, not introduced this phase).

> **Phase 16 changed `firestore.rules` again** (a new `invoices`
> subcollection, plus a second update-rule branch on `restaurants` for
> atomic invoice numbering). Deploy with `firebase deploy --only
> firestore:rules --project restaurant-management-553db` before testing.
> Lower-risk than Phase 15's change (plain per-restaurant subcollection,
> no cross-collection lookups) — see `PHASE_16_REPORT.md`.

> **Phase 15's team-invite feature has been confirmed working live** by
> the user (2026-08-23) — invite send/accept/decline all verified against
> the real project. See `PHASE_15_REPORT.md` for the design.

> **Phase 11 added a new dependency (`jspdf`, for P&L PDF export).** Run
> `npm install` once after pulling these changes before `npm run dev` if
> you haven't already — see `PHASE_11_REPORT.md` for details.

## Stack

React + TypeScript + Vite, Firebase (Auth, Firestore), Cloudinary (image
hosting), Material UI, React Hook Form + Zod, React Router, TanStack Query,
date-fns.

> **Why Cloudinary and not Firebase Storage?** Cloud Storage for Firebase now
> requires the Blaze (pay-as-you-go) billing plan, even for tiny usage — a
> Google policy change from Sept 2024. This project targets the free Spark
> plan, so images (menu items, restaurant logos) go through Cloudinary's free
> tier instead. See `src/services/cloudinaryService.ts`. If you later
> upgrade to Blaze, switching back to Firebase Storage is a small, isolated
> change (see the comment in `src/config/firebase.ts`).

## Getting started

```bash
npm install

# Terminal 1 — start the local Firebase emulators (Auth, Firestore, UI)
npm run emulators

# Terminal 2 — start the app (already configured to talk to the emulators)
npm run dev
```

Open http://localhost:5173 for the app and http://localhost:4000 for the
Firebase Emulator UI (inspect Auth users and Firestore data directly).

By default (`.env.local`) the app connects to the **local emulators**, not a
real Firebase project — nothing you do requires real credentials or costs
anything. Data lives only in the emulator process and resets when you stop
it (add `--export-on-exit` / `--import` flags to `firebase emulators:start`
if you want it to persist between runs).

### Connecting to your real Firebase project

1. In the [Firebase console](https://console.firebase.google.com), open your
   project → gear icon → **Project settings** → **General** tab → scroll to
   **Your apps** → your web app → **SDK setup and configuration** → select
   **Config**. Copy the `firebaseConfig` values.
2. Copy `.env.example` to `.env.local`, set `VITE_USE_FIREBASE_EMULATOR=false`,
   and paste those values into the `VITE_FIREBASE_*` variables.
3. In the Firebase console, go to **Authentication → Sign-in method** and
   enable the **Email/Password** provider (it's off by default on a new project).
4. Deploy the security rules **and indexes**: `firebase login`, then
   `firebase use --add` (pick your project, save as `default`), then
   `firebase deploy --only firestore:rules,firestore:indexes --project <your-project-id>`.
   (Rules alone can still be pasted into **Firestore Database → Rules** in
   the console if you only changed those, but a composite index has no console
   equivalent — it can also be created lazily by clicking the link in the
   error Firestore throws the first time the query runs without it.)
5. Set up Cloudinary for images — see the **Image hosting** section below.

### Image hosting (Cloudinary)

1. Sign up free at https://cloudinary.com/users/register/free (no card needed).
2. Note your **Cloud name** from the dashboard.
3. **Settings → Upload → Upload presets → Add upload preset** — set
   **Signing Mode** to **Unsigned**, name it, save.
4. Add to `.env.local`:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
   VITE_CLOUDINARY_UPLOAD_PRESET=your-preset-name
   ```

## Project structure

```
src/
  app/            App shell (layout, theme, nav config)
  config/         Firebase + Cloudinary initialization
  contexts/       AuthContext, RestaurantContext
  types/          Shared TypeScript types (User, Restaurant, RestaurantUser, Permissions)
  services/       All Firestore/Auth/Cloudinary access — authService, restaurantService, cloudinaryService, ...
  components/common/  Reusable UI: dialogs, states, guards, ImageUploadField, ...
  features/       One folder per product area (auth, restaurants, dashboard, restaurant-users, roles, ...)
  routes/         ProtectedRoute, RequireRestaurant
  utils/          money.ts, dates.ts, errors.ts, validation.ts
```

## Data model

Every restaurant's data lives under `restaurants/{restaurantId}/...` as
subcollections, so the Firestore document path itself is the tenant
boundary — see `firestore.rules` and `PHASE_1_REPORT.md` for the full
reasoning. Money is always stored as integer minor units (paise) — see
`src/utils/money.ts` — never as floats. Images are stored as Cloudinary URL
strings on the relevant document (e.g. `menuItem.image`), not as binary data.
