# Phase 10 Report — Settings (Personal Account)

> **Addendum (2026-08-23): Change-email card removed.** Right after this
> phase landed, you asked to remove the change-email functionality and keep
> only change-password. Done — `ChangeEmailCard` (and its `changeUserEmail`
> service function, `changeEmailSchema` validation schema, and the
> `firebaseUser` usage that only existed to show the current email) are all
> deleted. The rest of this report describes the page as originally
> delivered; wherever it mentions the email card, treat that as historical —
> it no longer exists. Settings is now two cards: Profile and Password.
> `npm run build`/`npm run lint` reverified clean after the removal (same 5
> pre-existing unrelated warnings, nothing new).

## Why this phase, and why now

Asked what's still pending after Phase 9, you ruled out Orders/POS
("i dont want orders/POS feature") — the last thing keeping billing/invoicing
and a few other candidates blocked. Asked to pick from what's left, you chose
the top-level **Settings** page, which has sat disabled since Phase 1 with no
defined scope (it's distinct from Restaurant Profile, Phase 8's page for
restaurant-wide business/financial data). Asked what it should contain, you
picked **personal account settings** — the one genuine gap in the app right
now: there is currently no way to change your own name, photo, email, or
password once registered.

## What was implemented

- **Settings page** (`/app/settings`, top-level nav item now enabled, also
  reachable from the account menu in the top bar) — three independent cards:
  - **Profile**: first name, last name, phone, and a Cloudinary photo upload
    (reusing the same `ImageUploadField` Restaurant Profile uses for logos).
    Plain Firestore write to your own `users/{userId}` doc — no password
    needed.
  - **Sign-in email**: enter a new email + your current password, get a
    confirmation link sent to the new address. The email does NOT change
    until you click that link (see "Business logic worth noting" below for
    why this is the deliberate, safer choice over an instant change).
  - **Password**: enter your current password + a new one (with confirm) to
    change your sign-in password.
- **Your uploaded photo now actually shows up** — the account-menu avatar in
  the top bar (previously always just your initials) now shows your profile
  photo if you've set one.
- **Settings added to the account dropdown menu** in the top bar, alongside
  "My Restaurants" and "Log out" — a second, faster way to reach the page
  besides the sidebar.

## Files created

- `src/features/settings/SettingsPage.tsx` — the page (three cards/forms).
- `PHASE_10_REPORT.md` — this report.

## Files modified

- `src/services/authService.ts` — added `updateUserProfile()`,
  `changeUserEmail()`, `changeUserPassword()`, and a shared
  `reauthenticate()` helper.
- `src/utils/validation.ts` — added `accountProfileSchema`,
  `changeEmailSchema`, `changePasswordSchema`.
- `src/utils/errors.ts` — added friendly messages for
  `auth/requires-recent-login` and `auth/operation-not-allowed`.
- `src/app/navConfig.ts` — enabled the top-level "Settings" item.
- `src/App.tsx` — added the `/app/settings` route.
- `src/app/AppLayout.tsx` — avatar now shows the profile photo; added a
  "Settings" item to the account dropdown menu.
- `firestore.rules` — header comment only, noting Phase 10 and that
  Orders/POS is now permanently out of scope alongside Suppliers.
- `README.md` — bumped to "Phase 10 of 12".

## Database collections affected

None. Everything here writes to the existing `users/{userId}` document
(defined since Phase 1) through the existing self-update rule — no new
collections, no new match blocks, no new composite indexes, no new
`PERMISSIONS` entries (this page needs no restaurant permission at all; it's
gated purely on being signed in, same as any `/app/*` route).

## Business logic worth noting

- **Email changes use `verifyBeforeUpdateEmail`, not `updateEmail`.** The
  older `updateEmail()` API now throws `auth/operation-not-allowed` on any
  Firebase project with Email Enumeration Protection enabled — the default
  for every new project since mid-2023, which very likely includes yours.
  `verifyBeforeUpdateEmail()` is the current, non-deprecated replacement: it
  sends a confirmation link to the NEW address and only swaps the Auth
  record over once that link is clicked. Practical effect: after submitting
  the form, `auth.currentUser.email` is still the OLD address until you
  confirm — the UI says this explicitly rather than implying an instant
  change.
- **The Firestore `users/{userId}.email` field is deliberately left
  untouched by this phase.** It's never written by the Profile card (only
  `firstName`/`lastName`/`phone`/`profileImage`), and the email-change flow
  only touches Firebase Auth, not Firestore — so the two can go briefly
  out of sync (Firestore keeps showing the old email until something
  re-syncs it). Nothing in this phase automatically re-syncs it after you
  click the confirmation link, since there's no reliable client-side hook
  for "the user clicked the email link on some other device/tab." Treat the
  Firestore `email` field as "email at last profile fetch," not
  necessarily current the moment a change is in flight. A clean fix (a
  Cloud Function on Auth's email-change event) needs Blaze billing, which
  is out of scope for this Spark-plan project — see the Cloudinary README
  note for the same constraint. Low-cost mitigation if this becomes
  annoying in practice: re-run `ensureUserProfile`-style sync logic
  whenever `AuthContext` notices `firebaseUser.email !== profile.email`.
- **Both email and password changes require re-entering your current
  password (reauthentication) before Firebase will allow either.** This
  isn't a design choice this phase made — it's a hard Firebase requirement
  (`auth/requires-recent-login`) once your sign-in session is more than a
  few minutes old, which is the normal case for an app you leave open.
  Rather than let that error surface confusingly after a failed attempt,
  both forms ask for the current password up front and reauthenticate
  before attempting the real change.
- **No "log out other sessions" / session-revocation UI.** Changing your
  password does NOT automatically sign out other devices/tabs already
  logged in — Firebase Auth ID tokens stay valid until they naturally
  expire (up to an hour) unless you explicitly revoke refresh tokens
  server-side, which needs the Admin SDK (a backend this project doesn't
  have — everything here is client-only, talking to Firebase directly).
  Worth knowing if "I changed my password because I think someone else has
  it" is ever a real scenario for you.

## Assumptions

- **Profile photo has no crop/resize step** — same as Restaurant Profile's
  logo upload, it's whatever `ImageUploadField`/Cloudinary's unsigned preset
  produces. If you want automatic square-cropping for avatars specifically,
  that's a Cloudinary transformation-parameter tweak, not a rebuild.
- **No email/password change confirmation step beyond Firebase's own** — no
  "type your password again to confirm" second field, no rate-limiting
  beyond what Firebase Auth already enforces (`auth/too-many-requests`).

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress blocks `identitytoolkit.googleapis.com` (Firebase Auth) and
  `firestore.googleapis.com`, so NONE of this — especially the
  reauthentication flow and the email-confirmation-link round trip — could
  be exercised live from inside this environment. This phase is the most
  important one yet to live-test carefully, since email/password changes
  touch your actual sign-in credentials on your real account.
- Phases 3 through 10 all remain not-yet-live-tested by you against the real
  project.
- The Firestore/Auth email drift noted above is a real, acknowledged gap,
  not an oversight — see "Business logic worth noting."

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same 5 pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 10 code.

## How to verify on your machine

1. No rules or index deploy needed this phase — `firestore.rules` only
   changed a comment.
2. Restart `npm run dev` if it isn't already picking up the new files,
   hard-refresh the browser.
3. Open **Settings** from the sidebar (or the account menu, top-right).
4. **Profile card**: change your first/last name, add a phone number, upload
   a photo. Save, then check the top-right avatar shows your new photo and
   the account-menu dropdown shows your new name.
5. **Sign-in email card**: enter a real email you can check, plus your
   current password. Submit, then check that inbox — confirm the link
   arrives and that your Firebase sign-in email does NOT change until you
   click it. (Careful testing this with your real account's only email —
   consider a throwaway address you can also access, or skip live-testing
   this specific card if you're not ready to touch your real login email.)
6. **Password card**: enter your current password and a new one, confirm it
   changes, then log out and log back in with the new password to confirm
   it took effect.
7. Try an intentionally wrong current password on either the email or
   password card — confirm you get "Incorrect email or password," not a
   raw Firebase error.
