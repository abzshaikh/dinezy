# Phase 15 Report — Team Member Invites (Reintroduced)

## Why this phase, and why now

The last real gap on the candidate list from the "continue with what you
think makes more sense... complete everything" instruction (Suppliers and
Orders/POS remain the two permanent exclusions). Every restaurant has had
exactly one member — its owner — since Phase 2, when a first attempt at
this exact feature was built, then permanently removed after three failed
security-rules redesigns all hit the same `permission-denied` error live
(see "Incident 3" in the project doc, and `PHASE_2_REPORT.md`'s Addendum
3/4). This phase reintroduces it with a **deliberately different shape**
chosen specifically to avoid that failure mode.

**This is the riskiest phase shipped under the "complete everything"
mandate**, and that risk is real, not hedging language: this sandbox has no
live Firestore access to test against — the exact same limitation that made
Incident 3 undebuggable the first time. Everything below has been reviewed
carefully against Firestore's documented security-rules semantics and
mirrors patterns already proven live-working elsewhere in this same rules
file, but "reviewed carefully" is not "tested live." See "Risk and rollback"
at the end of this report before treating this as done.

## What was implemented

- **Send an invite** — Users page (`/app/restaurant/users`), visible only
  with `users.manage` (owner-only, same gate as everything else on that
  page): an "Invite Member" button opens a dialog (email + role, any
  non-owner role). Sending an invite does NOT create an account or a
  membership doc — it's purely a record saying "this email, this role, this
  restaurant, pending."
- **Manage sent invites** — a new "Invites" section on the same page lists
  every invite ever sent for the restaurant (any status: pending / accepted
  / revoked / declined), with a Revoke action on pending ones.
- **Accept/decline an invite** — a new banner on "My Restaurants"
  (`/restaurants`, the page shown before any restaurant is selected)
  appears whenever the signed-in user's email has one or more pending
  invites, anywhere. Each shows the restaurant name, inviting person, and
  role offered, with Accept/Decline buttons. Accepting creates the
  `restaurantUsers` membership doc and marks the invite accepted in one
  atomic batch; declining just marks it declined. The invitee must already
  be signed in (or register/log in first) with the **exact email** the
  invite was sent to — there's no magic link, no email actually gets sent
  by this app (no backend/Cloud Functions on the Spark plan) — the invite
  is discovered purely by matching the signed-in user's Auth email against
  the invite's stored email.

## Files created

- `src/types/invite.ts` — `RestaurantInvite`, `InviteStatus`, `SendInviteInput`.
- `src/services/inviteService.ts` — `sendInvite`, `listInvitesForRestaurant`,
  `listPendingInvitesForEmail`, `revokeInvite`, `declineInvite`, `acceptInvite`.
- `src/features/restaurant-users/SendInviteDialog.tsx` — the invite-sending form.
- `src/features/restaurants/PendingInvitesBanner.tsx` — the accept/decline banner.
- `PHASE_15_REPORT.md` — this report.

## Files modified

- `src/features/restaurant-users/UsersPage.tsx` — invite button, invites
  table, revoke confirmation; removed the old "adding new team members
  isn't available yet" copy.
- `src/features/restaurants/MyRestaurantsPage.tsx` — renders
  `PendingInvitesBanner`.
- `src/types/restaurantUser.ts` — updated the doc comment on
  `invitedBy`/`invitedEmail`/`acceptedFromInviteId`: these are no longer
  permanently-null reserved fields, they're populated for real now.
- `src/utils/validation.ts` — `sendInviteSchema`.
- `firestore.rules` — new `invites` top-level match block; a second branch
  on the `restaurantUsers` `create` rule for accepting an invite; header
  comment updated. **This needs `firestore:rules` deployed** — new match
  block, not just a comment.
- `README.md` — bumped to "Phase 15 of 15".

## Database collections affected

- **New top-level collection: `invites/{inviteId}`.** See "Why a top-level
  collection" below for the design reasoning — this is the one decision in
  this phase most directly shaped by Incident 3.
- `restaurantUsers` — no new fields, but a second `create`-rule branch (see
  "Security rules design" below) and the three previously-always-null
  fields (`invitedBy`/`invitedEmail`/`acceptedFromInviteId`) now get
  populated for real for an invite-accepted membership.

## Why a top-level collection, not `restaurants/{id}/invites`

Phase 2's design put invites in a subcollection, discovered via
`collectionGroup('invites')` (the invitee doesn't know which restaurant
invited them in advance, so a subcollection needs a collection-group query
to search across all restaurants at once). That query's authorizing rule
needed a `get()`/`exists()` check whose target varied per-document across an
unbounded, unpinned result set — exactly the shape Firestore's rules engine
cannot prove safe for a `list` request, and it was rejected outright with
`permission-denied` across three independently-worded rule attempts (see
the project doc's "IMPORTANT — Firestore rule constraint" note).

A **top-level** `invites` collection sidesteps this because the invitee's
own lookup (`where('email','==', myEmail)`) needs a completely different
query shape — no `collectionGroup()`, and more importantly, no `get()` at
all on that branch. There is nothing to prove: the rule reads a field on the
very document being evaluated. This wasn't possible with the subcollection
shape because the invitee's identity (their own uid — the actual provable
thing) was never part of an invite doc's *path*, only its *email field*, and
Firestore's provability rules care about paths, not arbitrary field values,
for the get()-pinning case — but a **pure field comparison with no get() at
all** was always safe regardless of collection shape. The real fix here
isn't "top-level vs. subcollection" in the abstract — it's "does the
invitee's read branch need a get() at all," and restructuring as a
top-level collection is what makes the answer "no."

## Security rules design (`firestore.rules`)

### `invites/{inviteId}` read rule

```
allow read: if isSignedIn()
  && (resource.data.email == request.auth.token.email.lower()
      || canManageUsers(resource.data.restaurantId));
```

This is a **single `||` of two branches, deliberately the same shape as
the already-proven-working `restaurantUsers` read rule** two blocks above
it in the same file (`resource.data.userId == request.auth.uid ||
isMember(resource.data.restaurantId)`). Branch one (the invitee's own
lookup) is a pure field comparison — no `get()`, so it's unconditionally
safe no matter what query shape reaches it. Branch two (the restaurant
admin listing invites they sent) does call `canManageUsers()`, which is
`get()`-based — but the ONLY query this app runs on that branch is
`where('restaurantId','==', restaurantId)` (see
`listInvitesForRestaurant`), which pins `resource.data.restaurantId` to a
single known value for every document the query could possibly return —
exactly the "field constrained by the query's own equality filter" case
the project doc's provability note describes as safe, and exactly the
shape `restaurantUsers`' own rule already relies on successfully.

**The one thing this rule depends on that Incident 3 didn't have to worry
about**: nothing here is a `collectionGroup()` query, and nothing here
combines an unpinned `get()` with a query whose result set spans multiple
possible values of the field that `get()` depends on. Every query this
phase's code actually issues filters on exactly one of `email` or
`restaurantId` — never leaves either dimension unconstrained. If a future
change ever adds a query that filters on neither (e.g. "show me all
invites, unfiltered"), this rule would very likely reject it — that's
intentional, not a bug to work around.

### `invites/{inviteId}` create/update rules

`create` requires `canManageUsers(request.resource.data.restaurantId)` —
same owner-only gate as every other users.manage action — plus field-shape
checks (role can't be `'owner'`, status must start `'pending'`, etc.).

`update` is three independent branches, each scoped with
`diff(resource.data).affectedKeys().hasOnly([...])` (same
narrow-permission-slice pattern Phase 13 established for
`recurringExpenseTemplates`) so each actor can only touch the fields their
specific action needs: an admin revoking touches only `status`; an invitee
declining touches only `status`; an invitee accepting touches `status`,
`acceptedAt`, and `acceptedByUserId` together. None of these three branches
call `get()` at all — they only compare `resource.data`/`request.auth`
fields on the single document already being written, so none of them carry
any query-provability risk regardless of how they're combined.

### `restaurantUsers` create rule — the second branch

Accepting an invite needs to create a `restaurantUsers` doc for a
non-owner, which didn't exist as a create path before this phase. The new
branch:

```
(request.resource.data.role != 'owner'
  && request.resource.data.acceptedFromInviteId != null
  && get(/databases/$(database)/documents/invites/$(request.resource.data.acceptedFromInviteId)).data.status == 'pending'
  && get(/databases/$(database)/documents/invites/$(request.resource.data.acceptedFromInviteId)).data.email == request.auth.token.email.lower()
  && get(/databases/$(database)/documents/invites/$(request.resource.data.acceptedFromInviteId)).data.restaurantId == request.resource.data.restaurantId
  && get(/databases/$(database)/documents/invites/$(request.resource.data.acceptedFromInviteId)).data.role == request.resource.data.role)
```

This `get()` targets a single, exact document path
(`invites/{acceptedFromInviteId}`) taken directly from the write's own
payload. **This is the one place in this design worth being explicit
about why Incident 3's limitation does not apply**: that limitation is
specifically about authorizing a `list`/query request, where Firestore has
to prove a rule holds across an entire, potentially-unbounded result set
without evaluating every document individually. A `create` rule authorizes
exactly one document write; there is no result set to prove anything
across, so a `get()` inside it is exactly as safe as the `get()` calls
`hasPermission()` already makes inside every `create`/`update` rule
elsewhere in this file (Phase 3 onward) — those already work today, live,
with zero incidents.

### Why the accept flow's batch write is safe despite reading the invite twice

`acceptInvite()` (`inviteService.ts`) writes the new `restaurantUsers` doc
and updates the `invites` doc's status to `'accepted'` in the same
`writeBatch`. The `restaurantUsers` create rule's `get()` calls check the
invite is still `status == 'pending'` — the value it will have
**immediately before** this batch commits, regardless of Firestore's
internal ordering semantics for rule evaluation within one batch (the two
writes describe the same real-world event, so this can't be a case of the
rule seeing a stale value from a different, unrelated prior state — the
invite is either pending right up until this exact batch, or it isn't).

## Assumptions

- **No actual email gets sent.** This app has no backend/Cloud Functions
  (Spark plan). "Sending" an invite writes a Firestore doc only; the
  invitee finds out by seeing the banner next time they're signed in to
  this app with the matching email. If the user wants a real notification
  email, that needs a genuinely different piece of infrastructure (a Cloud
  Function + an email provider, which requires the Blaze plan) — out of
  scope here, flagged rather than silently worked around.
- **The invitee must already have (or be willing to create) an account
  with the exact email invited.** Firebase Auth normalizes emails to
  lowercase (see the project doc), and this app already lowercases/trims
  every email it writes, so casing differences shouldn't bite — but a
  typo'd invite email with no matching account will simply never show a
  banner to anyone, silently. There's no "invite doesn't match any
  account" feedback loop back to the sender.
- **Only one pending invite matters per restaurant+email at a time in
  practice**, but nothing enforces that server-side — an admin could send
  two invites to the same email for the same restaurant, and the invitee
  would see two banner rows. Not blocked, since it's harmless (accepting
  either one works; the other stays pending until revoked or independently
  accepted-and-then-rejected-by-the-rule since the membership doc would
  already exist... actually accepting a SECOND one for the same restaurant
  would still pass rule checks and simply overwrite the membership doc's
  role/fields via `set()`, which is a real edge case — see "Known issues."

## Known issues

- **Double-accept edge case**: if two pending invites exist for the same
  email+restaurant and the invitee accepts both (one after another), the
  second `acceptInvite()` call's `batch.set()` on the SAME `restaurantUsers`
  doc ID will simply overwrite the first — not append, not error. Net
  effect is harmless (same restaurant, whatever role the second invite
  granted, `acceptedFromInviteId` pointing at whichever was accepted last)
  but the UI doesn't explicitly warn about this today. Sending a second
  invite to someone already invited isn't blocked client-side either.
- **No "resend" action** — a revoked or declined invite has to be
  re-created from scratch (new email+role entry), not reopened. Consistent
  with this app's "never edit terminal history, create a new record"
  pattern elsewhere, but slightly more clicks than a dedicated resend
  button would be.
- **No pagination on the invites list** — same tradeoff already accepted
  elsewhere in this app (expenses, stock ledger) for collections expected
  to stay small per restaurant.
- Same sandbox limitation as every prior phase, but **this phase is the
  one where it matters most**: no live Firestore access from inside this
  environment (confirmed again this session — the Firestore emulator
  itself couldn't even start, since downloading its jar requires
  `storage.googleapis.com`, which is blocked). The entire rules design
  above is a careful, from-first-principles application of Firestore's
  documented security-rules semantics plus close mirroring of this
  project's own already-proven-working `restaurantUsers` pattern — not a
  live-tested result.

## Risk and rollback

**This is genuinely the riskiest single change shipped since Phase 2's
original invite attempt**, and it's being shipped anyway under the
"complete everything" mandate — but flagged prominently, per that same
mandate's own instruction to flag irreversible/risky decisions.

If, after deploying `firestore.rules` and testing live, invites still don't
work (a `permission-denied` on the invitee's banner query, or on accepting
an invite): **stop and report back rather than iterating blindly again.**
Three blind iterations already happened once in Phase 2 without resolving
the root cause — repeating that pattern a fourth-through-sixth time in this
new shape isn't a good use of anyone's time. Useful first diagnostic step
if it does fail: open the Firebase Console's Firestore Rules Playground (a
real, authenticated tool this sandbox cannot reach, but the user's own
browser can) and simulate the exact failing read/write — that will show
which specific `allow` clause is rejecting it, which is far more precise
than anything guessable from this sandbox.

**Rollback path**: this phase's rules changes are additive and isolated —
the new `invites` match block and the new `restaurantUsers` create-rule
branch. Reverting `firestore.rules` to its Phase 14 state fully undoes the
server-side surface with zero effect on any other collection or existing
data (no existing document's shape changed, only new fields on newly
created ones). The client-side code (`inviteService.ts`, the two new
components, the `UsersPage`/`MyRestaurantsPage` additions) can be pulled
out independently of the rules if only a partial rollback is wanted — they
don't affect any other feature.

## Build/test result

`npm run build` (includes `tsc -b`) and `npm run lint` (oxlint) both clean
— same 5 pre-existing baseline warnings, nothing new from this phase's
code. The Firestore emulator could not be started to test rules directly
(confirmed blocked network access to `storage.googleapis.com` — see "Known
issues").

## How to verify on your machine

1. **Deploy first**: `firebase deploy --only firestore:rules --project restaurant-management-553db`
   — this phase needs the rules deploy, no index changes.
2. Restart `npm run dev`, hard-refresh, as the restaurant owner.
3. Go to **Users**, click **Invite Member**, invite a second real email
   address you control (or a second test account) as, say, "Manager."
   Confirm it shows up under "Invites" as Pending.
4. Sign out, sign in (or register) as that second email. You should land
   on **My Restaurants** and see a banner: "You've been invited to join
   [restaurant]." Click **Accept**.
5. Confirm the restaurant now appears in that account's restaurant list,
   and that signing into it shows the Manager role/permissions correctly
   (same permission checks as any other Manager).
6. Back as the owner, confirm the **Users** page now lists the new member,
   and the invite's status flipped to "Accepted."
7. Try **Revoke** on a still-pending invite and confirm the invitee's
   banner for it disappears.
8. Try **Decline** from the invitee's side on a fresh invite and confirm
   it disappears from their banner and shows "Declined" to the admin.
9. **If any step in 3-8 fails with a permissions error, stop and report
   back with the exact error rather than guessing at further rule
   changes** — see "Risk and rollback" above.
