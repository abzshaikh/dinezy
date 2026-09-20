# Phase 12 Report — Receipt Photos on Expenses

## Why this phase, and why now

Asked to pick up remaining work autonomously ("continue with what you think
makes more sense... do what you think is correct and complete everything"),
this was the smallest, most self-contained item left on the candidate list
from Phase 11 — attach a receipt photo to an expense, reusing the Cloudinary
upload wiring already built for menu items, logos, and profile photos.

## What was implemented

- The New/Edit Expense form now has a **Receipt photo (optional)** upload
  field, same control used for menu item photos and the restaurant logo.
- The Expenses table has a new **Receipt** column — a small icon link that
  opens the uploaded photo in a new tab when one exists, a dash otherwise.

## Files modified

- `src/types/expense.ts` — added `receiptUrl: string | null` to `Expense`
  and `receiptUrl?: string | null` to `SaveExpenseInput`.
- `src/services/expenseService.ts` — `createExpense`/`updateExpense` now
  write `receiptUrl`.
- `src/features/expenses/ExpenseFormDialog.tsx` — added the
  `ImageUploadField`; also added an `initialValues` prop used by Phase 13's
  "log expense from a recurring template" flow (see that report) — receipts
  are never pre-filled from a template, only category/amount/vendor/note.
- `src/features/expenses/ExpensesPage.tsx` — added the Receipt column.
- `firestore.rules` — header comment only.
- `README.md` — bumped (see Phase 13's report for the final version number
  — these two phases landed together in the same session).

## Database collections affected

None structurally — `receiptUrl` is just a new field on the existing
`expenses` documents (Phase 6). No rules changes: the existing
`expense.create`/`expense.edit` rules already permit any field on create/
update, so an old expense with no `receiptUrl` at all (from before this
phase) reads back as `undefined` in the UI, treated the same as `null`.

## Business logic worth noting

- **Photo only, not PDF.** The existing `uploadImage()` helper
  (`cloudinaryService.ts`) and the Cloudinary unsigned upload preset it
  talks to are scoped to `image/jpeg`, `image/png`, `image/webp` — the same
  restriction every other upload in this app already has. Extending it to
  accept PDF receipts would mean either a second Cloudinary preset scoped to
  raw/auto resource type (an account-console change this sandbox can't make
  or verify) or asking users to photograph paper receipts, which most
  people already do anyway. Kept it simple: reuse exactly what's already
  wired up and working.
- **Uploading a NEW receipt on an edit does not delete the old one from
  Cloudinary.** Same known, already-documented limitation as every other
  image field in this app (see `cloudinaryService.ts`'s own doc comment) —
  unsigned uploads can't delete, only a signed request with the account's
  API secret can, which must never live in client code. Harmless within the
  25GB free tier for one restaurant's receipts.

## Assumptions

- No receipt is required to save an expense — always optional, so this
  phase changes nothing about expenses recorded before it or workflows that
  don't want to bother with photos.

## Remaining / known issues

- Same sandbox limitation as every prior phase: the actual Cloudinary
  upload round-trip could not be exercised live from inside this
  environment (network egress blocks `api.cloudinary.com`). The upload
  control itself is verbatim the same component already used successfully
  elsewhere in the app, so risk here is low, but it's still unverified
  specifically for this field.

## Build/test result

`npm run build` and `npm run lint` — see Phase 13's report; both phases
were verified together in the same build/lint pass since they landed in
the same session.

## How to verify on your machine

1. No rules or index deploy needed — `firestore.rules` only changed a
   comment.
2. Restart `npm run dev`, hard-refresh.
3. Open **Expenses → New Expense** (or edit an existing one), upload a
   receipt photo, save.
4. Confirm the Expenses table shows a receipt icon for that row, and
   clicking it opens the photo in a new tab.
