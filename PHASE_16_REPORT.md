# Phase 16 Report — Manual Billing / Invoicing

## Why this phase, and why now

The last substantial item on the candidate backlog: GST %, service charge
%, and invoice numbering have sat in Settings since Phase 8, unconsumed —
Phase 9's report flagged them as needing "an actual billing/invoicing
feature to apply to." This phase builds that feature: a manual "create a
bill" tool that finally uses all three.

**Scope check done before writing any code**: this sits right next to the
explicitly excluded Orders/POS module, so I asked first rather than
assuming. Confirmed: a manual bill/invoice tool — pick menu items, enter
quantities, get GST/service charge applied automatically, get an invoice
number, export a PDF — is a different, acceptable thing from a live
order-taking/kitchen-ticket/table-management system, and is in scope. Line
items come from the menu only (no free-text line items) — also confirmed
directly rather than assumed.

## What was implemented

- **New Invoice** (`/app/billing/invoices/new`) — a grid of every active,
  currently-available menu item (same interaction shape as Daily Sales'
  quantity grid) with a quantity field per item. A live summary panel
  computes Subtotal → Service Charge → GST → Total as quantities are
  typed, using the restaurant's current Settings percentages. Optional
  customer name and note. Creating an invoice assigns the next invoice
  number, saves it, and immediately downloads a PDF.
- **Invoices** (`/app/billing/invoices`) — every invoice ever issued,
  newest first: number, date, customer, total, status (Issued/Voided).
  Download PDF on any invoice; Void on an issued one (with an optional
  reason, kept for the audit trail).
- **Automatic invoice numbering** — `{invoicePrefix}-{nextInvoiceNumber
  zero-padded to 4 digits}` (e.g. `INV-0001`), assigned atomically in the
  same Firestore transaction that creates the invoice, so two invoices
  created at nearly the same instant can never collide on the same number.
- **PDF export** — a simple, printable A4 invoice (restaurant name/
  address/GSTIN, invoice number/date, line items, subtotal/service
  charge/GST/total, a customer name if given, a VOIDED stamp if
  applicable). Reuses `jspdf` (added in Phase 11) — no new dependency.

## Files created

- `src/types/invoice.ts` — `Invoice`, `InvoiceLineItem`, `InvoiceStatus`,
  `InvoiceLineInput`, `SaveInvoiceInput`.
- `src/services/invoiceService.ts` — `createInvoice` (the transactional
  numbering + creation), `listInvoices`, `voidInvoice`.
- `src/features/billing/NewInvoicePage.tsx` — the create-invoice page.
- `src/features/billing/InvoicesPage.tsx` — the invoice list.
- `src/features/billing/VoidInvoiceDialog.tsx` — void confirmation with a
  reason field.
- `src/features/billing/invoicePdf.ts` — the PDF export.
- `PHASE_16_REPORT.md` — this report.

## Files modified

- `src/app/navConfig.ts` — new "Billing → Invoices" nav section.
- `src/App.tsx` — `/app/billing/invoices` and `/app/billing/invoices/new` routes.
- `src/types/permissions.ts` — `PERMISSION_GROUP_LABELS.orders` relabeled
  from "Orders & Sales" to "Billing (Invoices)" (see "Permission design"
  below), with a doc comment explaining why.
- `firestore.rules` — new `restaurants/{restaurantId}/invoices` match
  block; a second branch on the `restaurants/{restaurantId}` update rule
  (atomic invoice-number bump); header comment updated. **This needs
  `firestore:rules` deployed** — new match block, not just a comment.
- `README.md` — bumped to "Phase 16 of 16".

## Database collections affected

- **New subcollection: `restaurants/{restaurantId}/invoices/{invoiceId}`.**
  A plain subcollection, NOT a top-level collection and NOT queried via
  `collectionGroup()` — `restaurantId` is pinned by the path itself, same
  safe shape as every other `restaurants/{restaurantId}/...` collection in
  this app (menuItems, expenses, recipes, etc.). Nothing about this
  collection carries any of Phase 15's query-provability considerations.
- `restaurants/{restaurantId}` — no new fields (`settings.invoicePrefix`/
  `nextInvoiceNumber` already existed, reserved since Phase 1), but a new,
  narrowly-scoped way to update it (see "Security rules design").

## Permission design — repurposing the `orders.*` group

This app has had `orders.view`/`orders.create`/`orders.edit` in its
permission table since Phase 1, reserved for the never-built Orders/POS
module. `orders.create` was already repurposed once, in Phase 5, to gate
Daily Sales entry (`DailySalesPage.tsx`) — `orders.view`/`orders.edit`
were still fully unused before this phase.

This phase repurposes the whole group for billing: `orders.view` to see
invoices, `orders.create` to issue one, `orders.edit` to void one. This
was a deliberate choice, not the path of least resistance:

- It finally gives the **`cashier`** role (which has had `orders.view` +
  `orders.create` + `menu.view` since Phase 1, and until now had
  essentially nothing real to do in this app) an actual purpose —
  cashiers can create and view invoices, matching what "cashier" should
  mean.
- It means anyone who could already log Daily Sales (manager, cashier)
  can now also issue invoices, and anyone who can edit `orders.*` things
  (manager, owner) can void one. This coupling is a real, considered
  side effect, not an accident — both capabilities are "front-of-house
  billing-adjacent" actions, and no role gains a capability outside what
  that permission group was already scoped to grant them.
- The Roles & Permissions matrix page's label for this group changed from
  "Orders & Sales" to "Billing (Invoices)" so what it's showing matches
  what it actually gates today, not its original Phase 1 intent.

If a future need arises to separate "who can log Daily Sales" from "who
can bill customers," that would need a genuinely new permission pair — not
attempted here, since nothing so far has asked for that distinction.

## Security rules design (`firestore.rules`)

### `invoices` subcollection

Straightforward compared to Phase 15 — a plain subcollection with
`restaurantId` pinned by the document path, exactly like every other
per-restaurant collection in this app. No `get()`/`exists()` calls inside
this match block at all beyond what `hasPermission()` already does
internally (itself already proven safe for this exact shape since Phase
3). Read/create/void are gated on `orders.view`/`orders.create`/
`orders.edit` respectively.

**Once issued, an invoice is immutable except for the one issued → voided
transition** — the update rule only accepts that exact status change,
scoped via `diff().affectedKeys().hasOnly([...])` to touch only
`status`/`voidedAt`/`voidedReason`/`voidedByUserId`/`updatedAt`. No amount,
line item, or customer field can ever be edited after creation. This is
the strictest correction pattern of the three already established in this
app (see the project doc's "three correction patterns" note) — chosen
because a sequentially-numbered invoice is the one document in this whole
app closest to being a real legal/financial record; a mistake is corrected
by voiding and issuing a fresh one, never by silently rewriting a numbered
document. No cross-field amount validation (e.g. re-deriving
`totalMinor` from line items server-side) — consistent with this app's
existing trust model for computed financial figures (Expenses, Daily
Sales, and P&L all trust client-computed amounts too; nothing in this
codebase re-verifies arithmetic in rules).

### `restaurants/{restaurantId}` update rule — the second branch

Issuing an invoice needs to bump `settings.nextInvoiceNumber` by exactly
1. Gating that on `restaurant.settings` (the existing, owner-only-by-
default permission for editing business info/settings) would have meant
only an owner (or someone explicitly granted `restaurant.settings`) could
ever issue an invoice — wrong, since a cashier issuing a routine bill has
no business editing GST%/business info. The new branch instead:

- Requires `orders.create` (the same permission gating creating the
  invoice document itself, so the two writes in the same transaction
  always succeed or fail together in practice).
- Uses `diff(resource.data).affectedKeys().hasOnly(['settings',
  'updatedAt'])` to lock every OTHER top-level field on the restaurant
  document (name, address, GST number, logo, `ownerId`, `status`, etc.).
- Then checks **every individual `settings` subfield except
  `nextInvoiceNumber`** stays byte-for-byte identical, and that
  `nextInvoiceNumber` increases by EXACTLY 1 — written out field-by-field
  because `affectedKeys()` only sees the top-level `settings` key
  changing, not which nested field inside the map actually moved; without
  this, a caller with only `orders.create` could smuggle a change to
  `gstPercent` or `targetFoodCostPercent` inside the same write. This is
  more verbose than a single `diff()` call but is the only way to get
  field-level granularity inside a nested map with this rules language.

### Why the create-invoice transaction is safe

`createInvoice()` (`invoiceService.ts`) reads the restaurant doc, computes
the invoice number and totals, then writes both the new invoice document
and the incremented counter in the same `runTransaction` — mirroring
`inventoryService.recordPurchase`'s established read-then-write-two-docs
shape exactly. Firestore transactions serialize concurrent writes to the
same document (the restaurant doc, here), so two invoices created at
nearly the same instant will have one transaction retry against the
now-updated counter rather than both computing the same number — the
correctness property a plain `writeBatch` (no read) couldn't have given.

## Assumptions

- **GST is applied on (subtotal + service charge)**, not on subtotal
  alone. This is the common convention for Indian restaurant billing
  (service charge, where levied, is generally treated as part of the
  taxable value) but is a deliberate, documented modeling choice here —
  **not tax advice**. If this restaurant's actual practice differs, the
  math lives in one place (`createInvoice()` in `invoiceService.ts` and
  the mirrored preview calculation in `NewInvoicePage.tsx`) and is easy to
  change.
- **Line items come from the menu only** — no free-text lines (e.g. a
  manual discount or a one-off item not on the menu), per the scope
  decision made before building this. If that's needed later, it's an
  additive change to the line-item input shape, not a redesign.
- **Only currently active AND available menu items appear** on the New
  Invoice grid — deliberately different from Daily Sales (which shows
  every active item regardless of today's availability, since it's
  logging what already happened). A bill reflects what's actually
  sellable right now.
- **No partial payments, discounts, splits, or refunds** — an invoice is
  either issued for its full computed total, or voided. If the business
  needs partial/split billing, that's a meaningfully bigger feature, not
  attempted here.

## Known issues

- **No cross-check that a line item's menu item is still active/available
  at the exact moment `createInvoice()`'s transaction commits** — the
  price snapshot always happens correctly (from whatever `menuItemsById`
  the page already loaded), but a menu item deactivated by someone else in
  the few seconds between loading the New Invoice page and clicking
  "Create Invoice" would still bill at its last-known price rather than
  being rejected. Extremely unlikely in a single-restaurant-owner-operated
  context and not worth a second live-read inside the transaction for now.
- **No invoice search/filter/date-range** on the Invoices list yet —
  same "small enough collection, add pagination/filtering later if it
  becomes a real problem" tradeoff already accepted for Expenses and the
  stock ledger.
- Same sandbox limitation as every phase: no live Firestore access from
  inside this environment. The rules design here is considerably less
  risky than Phase 15's (no top-level collection, no cross-collection
  `get()`, no invitee-email matching) — it's the same shape as every
  other per-restaurant subcollection already live-tested since Phase 3 —
  but the specific field-by-field `settings` update branch is new and
  worth checking carefully on first use.

## Build/test result

`npm run build` (includes `tsc -b`) and `npm run lint` (oxlint) both clean
— same 5 pre-existing baseline warnings, nothing new from this phase's
code.

## How to verify on your machine

1. **Deploy first**: `firebase deploy --only firestore:rules --project restaurant-management-553db`
   — new `invoices` match block plus the `restaurants` update-rule branch.
   No index changes.
2. Restart `npm run dev`, hard-refresh.
3. Go to **Billing → Invoices → New Invoice**. Enter a quantity for one or
   two menu items, optionally a customer name. Confirm the Subtotal/
   Service Charge/GST/Total preview matches your Settings percentages.
4. Click **Create Invoice**. Confirm a PDF downloads automatically and the
   invoice number matches your configured prefix (Settings →
   `invoicePrefix`) starting from `nextInvoiceNumber`.
5. Back on the Invoices list, confirm the new invoice appears with the
   right total and "Issued" status.
6. Create a second invoice and confirm its number is exactly one higher —
   this is the one behavior most worth checking carefully, since it's the
   part relying on the new transactional rules branch.
7. Try **Void** on an invoice as a role with `orders.edit` (owner/manager)
   and confirm it flips to "Voided" and can no longer be voided again.
8. If you have a cashier-role test account, confirm they can create and
   view invoices but the Void button doesn't appear for them.
9. Confirm the PDF's GST/service charge math and invoice number match what
   you saw on screen — and, since this uses your actual GST%, sanity-check
   the "GST on (subtotal + service charge)" assumption above against how
   you actually want to bill customers; this is genuinely worth a real
   look, not just a rubber-stamp.
