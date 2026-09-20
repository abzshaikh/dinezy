# Phase 2 Report — Restaurant Users & Permissions

**Final scope note (read this first):** Phase 2 originally included a
team-invite-by-email feature. It was built, then removed after live-testing
turned up a Firestore security-rules limitation that couldn't be resolved
reliably from this sandbox (three separate rule-redesign attempts all hit
the same `permission-denied` error). Per the user's explicit decision, the
invite feature was scrapped entirely rather than continuing to debug it
blind. **Addendum 4** at the bottom of this report has the removal details
and the finalized scope; **Addendums 1–3** are kept as-is for the historical
record of the debugging journey (useful if a future phase ever revisits
team invites with a different design). The sections below describe what
Phase 2 actually delivers today, post-removal.

## What was implemented

Team-management for a restaurant, scoped to the members that already
exist: an owner can see the full member list, change a member's role,
suspend/reactivate a member, and grant or revoke individual permissions for
one person on top of their role's defaults (the "granular permission
system" the spec called for — not just role names). A new read-only Roles &
Permissions reference page shows the full role × permission matrix.

Adding a brand-new (non-owner) member is **not available in this phase** —
that was the invite feature, and it's been removed (see Addendum 4). The
Users page says so directly in its subtitle so this isn't a silent gap.

## Files created

- `src/services/restaurantUserService.ts` — members: list, update role,
  suspend/reactivate, permission overrides.
- `src/features/restaurant-users/UsersPage.tsx` — member table,
  permission-gated.
- `src/features/restaurant-users/MemberPermissionsDialog.tsx` — per-member
  permission override checklist, grouped by feature area.
- `src/features/roles/RolesPermissionsPage.tsx` — read-only role ×
  permission matrix.

## Files modified

- `src/types/restaurantUser.ts` — added `displayName`, `email` (denormalized
  at join time), `joinedAt`. Also carries `invitedBy`, `invitedEmail`,
  `acceptedFromInviteId` — leftover fields from the removed invite feature,
  always `null` today; see Addendum 4 for why they were left in place.
- `src/types/permissions.ts` — added `PERMISSION_GROUP_LABELS` and
  `groupPermissions()`, shared by the Users and Roles pages.
- `src/services/restaurantService.ts` — `createRestaurant()` now takes the
  owner's name/email and writes them onto the owner's membership doc, so the
  Users page never needs to read another user's private profile.
- `src/features/restaurants/CreateRestaurantPage.tsx` — passes the owner's
  name/email through to `createRestaurant()`.
- `src/app/navConfig.ts` — enabled the "Users" and "Roles & Permissions" nav
  items.
- `src/App.tsx` — added `/app/restaurant/users` and `/app/restaurant/roles`
  routes.
- `firestore.rules` — membership-management rule set (see below). The
  invite-related rules and the `invites` match block that were here earlier
  in Phase 2 have been removed — see Addendum 4.
- `firestore.indexes.json` — one composite index on `restaurantUsers`
  (`restaurantId` ASC, `createdAt` ASC), needed by `listMembers()`. The two
  `invites`-collection indexes that were here earlier in Phase 2 have been
  removed along with the feature.

## Database collections affected

- `restaurantUsers/{restaurantId}_{userId}` — new fields as above; role,
  status, and permissionOverrides are now mutable by the owner (never the
  owner's own membership, and never granting the `owner` role through this
  path).

## Business logic worth noting

- **Fixed roles, granular overrides.** Changing a member's role resets any
  permission overrides they had (a fresh role starts from that role's
  defaults, not a stale mix) — implemented in
  `updateMemberRole`. Overrides are stored only for permissions that differ
  from the role's default; toggling a permission back to match the default
  clears the override key entirely rather than storing a redundant `true`/
  `false`.
- **Ownership is not reassignable through this feature.** `role: 'owner'`
  can never be set as a role change, and an owner's own membership can never
  be updated by this code path — by design, there is currently no "transfer
  ownership" feature; every restaurant always has exactly the one owner who
  created it.
- **No way to add a non-owner member yet.** The only `restaurantUsers` doc
  that can be created today is the owner's, at restaurant-creation time.
  There's no open "request to join" flow, and (as of this update) no invite
  flow either — see Addendum 4.

## Assumptions

- Only the `owner` role manages users today (`users.manage` is granted only
  to `owner` in the fixed role table) — `canManageUsers()` in the security
  rules checks the role directly rather than the resolved permission set
  (including overrides). If a future phase grants `users.manage` to a
  non-owner role via a permission override, that helper needs to check the
  override too; documented in the rules file itself so it isn't missed.

## Addendum (found during the user's live testing)

The initial `firestore.indexes.json` only included the `collectionGroup`
index needed for "find my pending invites across every restaurant" (part of
the now-removed invite feature). One more composite index was missing and
only surfaced once real queries ran against the deployed rules — Firestore's
automatic indexing doesn't cover a query that filters on one field and
orders by a different one:

- `restaurantUsers` (COLLECTION scope): `restaurantId` ASC, `createdAt` ASC
  — needed by `listMembers()` (the Users page's member table).

This is now in `firestore.indexes.json`. Re-run
`firebase deploy --only firestore:indexes` (or open Firestore's own
"this query needs an index" error link, which builds it for you) if you
haven't already.

## Addendum 2 (found during the user's live testing — invite banner not visible)

*(Historical — describes the since-removed invite feature.)*

The user invited a second account, logged in as that account, and couldn't find
the invite anywhere. Two real fixes came out of this at the time:

1. **`PendingInvitesBanner` silently swallowed query errors.** If the Firestore
   query failed for any reason (e.g. a composite index still "Building" right
   after a deploy — see Addendum above), the banner just rendered nothing, with
   no error, no console warning, nothing to tell you it had failed rather than
   legitimately found zero invites. It was changed to show an error `Alert` with
   a Retry button instead of silently disappearing — this is what surfaced the
   real error described in Addendum 3 below.
2. **The banner only ever appeared on the My Restaurants page.** A mail-icon
   badge was added to the top bar (`AppLayout.tsx`) as a fix for that.

Both of these components (`PendingInvitesBanner`, the top-bar mail badge) were
deleted along with the rest of the invite feature — see Addendum 4.

## Addendum 3 (the actual root cause — a Firestore rules/query limitation)

*(Historical — this is the debugging trail that led to the removal decision
in Addendum 4. Kept in full because the underlying Firestore limitation is
real and will matter again if a future phase adds any `collectionGroup()`
query.)*

With Addendum 2's fixes in place, the browser console showed the real error
underneath: `FirebaseError: Missing or insufficient permissions` on the
"which restaurants have invited me" lookup. This is a genuine Firestore
limitation, not a data or user mistake:

**Firestore can only serve a `list`/query request if it can prove every
branch of the security rule holds for the query's entire potential result
set, using only that query's own equality filters** — not by evaluating the
rule per returned document the way a single `get()` read works. The
original `invites` read rule was:

```
allow read: if isMember(restaurantId) || resource.data.email == myEmail();
```

`isMember(restaurantId)` calls `get()` on another document. That's fine for
a query scoped to ONE restaurant (`restaurantId` is pinned by the query's
own path, so Firestore can resolve it once) — but the "find my pending
invites across every restaurant" query used `collectionGroup('invites')`
across EVERY restaurant at once, where `restaurantId` varies per document
and can't be pinned to a single value. Firestore can't prove that branch
safe for an unpinned collection-group query, and — this is the non-obvious
part — it rejects the ENTIRE rule outright rather than falling back to just
the other (provable) branch, even though `resource.data.email == myEmail()`
alone would have been enough.

**First fix attempted**: rewrote the rule to call `get()`/`exists()` at all:

```
allow read: if resource.data.email == myEmail() || resource.data.invitedBy == request.auth.uid;
```

with matching `invitedBy`-filtered queries and a matching composite index.
The user confirmed (by pasting the deployed rules text from the Firebase
console) that this fix WAS live — but the exact same `permission-denied`
error persisted.

**Second fix attempted**: split the single `||`-joined `allow read`
statement into two separate `allow read` statements (in case Firestore's
query-safety analyzer treated an OR differently from two independent grant
statements), and inlined `request.auth.token.email` directly in place of
the `myEmail()` helper function (in case a function-call wrapper was
opaque to the analyzer). The user confirmed this was also deployed and
tested — the error still persisted, unchanged.

**Outcome**: with three independent, reasonable rule designs all producing
the identical error, and no way to test against the real Firestore backend
from this sandbox (its network egress blocks `firestore.googleapis.com`),
further blind iteration wasn't a good use of the user's time. The user made
the call to remove the feature rather than continue debugging it — see
Addendum 4.

The exact remaining root cause is genuinely unresolved. If a future phase
revisits team invites, the recommended approach is a different data shape
from the start — e.g. a **top-level** `invites` collection (`invites/{id}`
with a `restaurantId` field) instead of a subcollection reached via
`collectionGroup()`. A plain top-level collection query with a `where`
filter doesn't have the collection-group wildcard-pinning problem at all,
so it sidesteps this class of bug entirely rather than needing to out-think
Firestore's rule analyzer.

## Addendum 4 — Decision: the invite feature was removed

After Addendum 3's second fix attempt also failed live-testing, the user
said: *"can we remove this inviting feature and continue with the next
update, i dont want the invitation feature...lets scrap it and move ahead."*
This was treated as the final word — no further debugging was attempted.

**What was removed:**

- `src/features/restaurant-users/InviteUserDialog.tsx` (deleted)
- `src/features/restaurants/PendingInvitesBanner.tsx` (deleted)
- `src/types/invite.ts` — `RestaurantInvite`, `InviteStatus`,
  `CreateInviteInput` (deleted)
- `inviteUserSchema` / `InviteUserFormValues` from `src/utils/validation.ts`
  (removed)
- `createInvite`, `listPendingInvitesForRestaurant`, `listMyPendingInvites`,
  `revokeInvite`, `declineInvite`, `acceptInvite`, `getMemberByEmail` from
  `src/services/restaurantUserService.ts` (removed)
- The mail-icon pending-invite badge and its `useQuery`/data-fetching logic
  from `src/app/AppLayout.tsx` (removed)
- The "Invite User" button, pending-invitations table, and revoke dialog
  from `src/features/restaurant-users/UsersPage.tsx` (removed) — replaced
  with a subtitle note that adding members isn't available yet
- The `PendingInvitesBanner` render from
  `src/features/restaurants/MyRestaurantsPage.tsx` (removed)
- The entire `match /invites/{inviteId} { ... }` block from
  `firestore.rules` (removed), plus the now-dead "Path B: accepting a
  pending invite" branch of the `restaurantUsers` create rule (simplified
  to owner-at-creation-time only) and the now-unused `myEmail()` helper
  function
- Both `invites`-collectionGroup composite indexes from
  `firestore.indexes.json` (removed, kept only the `restaurantUsers` index)

**What was deliberately left alone:** the `invitedBy` / `invitedEmail` /
`acceptedFromInviteId` fields on `RestaurantUser` (`src/types/restaurantUser.ts`)
and the corresponding `invitedBy: null, invitedEmail: null,
acceptedFromInviteId: null` writes in `restaurantService.ts`'s
`createRestaurant()`. They're harmless always-null metadata today (every
membership doc is the owner's), and removing them would mean touching more
files for no functional benefit. A future phase can repurpose or drop them
if it reintroduces member invites.

**Verified after removal**: `npm run build` (`tsc -b && vite build`) and
`npm run lint` (`oxlint`) both pass clean, with zero remaining references
anywhere in `src/` to any of the deleted symbols above.

## Remaining / known issues

- **Adding a non-owner member is not available.** This is the direct
  consequence of Addendum 4 — there is currently no way to get a second
  person into a restaurant at all. This is the most likely thing a future
  phase needs to revisit, with a different design (see the recommendation
  at the end of Addendum 3).
- No "transfer ownership" flow — if the sole owner needs to hand off the
  restaurant, that's not built yet.
- Permission overrides are saved one Firestore write per changed permission
  (not batched) when several are toggled in the same dialog session; fine at
  this scale (a handful of overrides per person, rarely changed), but worth
  a `writeBatch` if that ever matters.
- Same sandbox limitation as Phase 1: this container's network egress
  blocks `firestore.googleapis.com`, so none of this could be exercised live
  against your real Firebase project or the Firestore emulator from inside
  this environment. Build and typecheck are clean; live verification needs
  to happen on your machine (see below).

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same pre-existing warnings from Phase 1's context files (fast-refresh
hints on files that export both a Provider and a hook) — nothing new from
Phase 2 code, and nothing related to the removed invite feature.

## How to verify on your machine

1. `npm install` (only if you haven't since Phase 1).
2. Deploy the updated rules/indexes to your real project:
   `firebase deploy --only firestore:rules,firestore:indexes --project restaurant-management-553db`
   (the `invites` index that used to be required is gone now, so this
   deploy should be quick).
3. `npm run dev`, log in as the restaurant owner, open **Restaurant →
   Users**. Confirm you see yourself listed as Owner, and that there's no
   "Invite" button or pending-invitations section (expected — see Addendum 4).
4. Since role/suspend/permission-override changes need a second member to
   act on, and there's currently no way to add one, those can't be
   end-to-end verified against a real second account until a future phase
   restores some way to add members. If you'd like, I can add a one-off
   manual way to seed a second test member directly in the Firestore
   console for testing purposes — just ask.
5. Check **Restaurant → Roles & Permissions** renders the full role ×
   permission matrix correctly.
