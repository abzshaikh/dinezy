# Phase 11 Report — P&L Export (CSV + PDF)

## ⚠️ Action needed on your machine: `npm install`

**This is the first phase to add a new dependency** (`jspdf`, for the PDF
export). Every phase before this one only changed files you already had —
this one needs one extra step:

```
npm install
```

Run that once in your project folder before `npm run dev` picks up Phase
11's changes, or the PDF export button will throw a "Failed to resolve
import jspdf" error (the CSV export doesn't need it and will work either
way). This also means you'll see `package.json`/`package-lock.json` among
the changed files this phase — normal, that's `npm install jspdf` recording
itself.

## Why this phase, and why now

Asked what to build after Phase 10, you picked P&L export — the Phase 7
P&L report has only ever been viewable on-screen, with no way to save or
share a copy. Asked CSV or PDF, you said both: CSV for pulling the numbers
into a spreadsheet/accounting tool, PDF for a clean printable/shareable
statement.

## What was implemented

- Two buttons on the P&L page (`/app/reports/pnl`), next to the date range:
  **Export CSV** and **Export PDF**. Both export exactly the range
  currently on screen — change the date range first, then export.
- **CSV**: restaurant name, period, currency, then the same Revenue → Food
  Cost → Gross Profit → (expense category breakdown) → Total Expenses →
  Net Profit lines shown in the on-screen Statement card, as plain decimal
  numbers (no currency symbol) so spreadsheet software treats the Amount
  column as numeric, not text. Downloads instantly, no new dependency.
- **PDF**: the same statement laid out as a simple printable page — title,
  restaurant name, date range, the statement lines with a rule under Gross
  Profit and under Net Profit, the expense breakdown, and the same
  "this isn't a full accounting statement" disclaimer that's already on
  the page. Built with `jspdf` (see the dependency note above).

## Files created

- `src/utils/export.ts` — shared file-download helpers (`downloadTextFile`,
  CSV field/row escaping, filename sanitizing). Written generically so a
  future export feature (Menu Costing export, expense export, whatever
  comes next) can reuse it instead of re-solving CSV escaping and download
  triggering from scratch.
- `src/features/reports/pnlExport.ts` — the two export functions
  (`exportPnLToCsv`, `exportPnLToPdf`), given a plain data object computed
  by `PnLPage.tsx` — this module has no Firestore/React dependency of its
  own, just data in, file out.
- `PHASE_11_REPORT.md` — this report.

## Files modified

- `src/features/reports/PnLPage.tsx` — added the two export buttons and
  the `PnLExportData` object passed to them (built from the exact same
  `totals`/`expensesByCategory`/etc. values the Statement card already
  renders, so the exported file and the on-screen numbers can never
  disagree).
- `package.json` / `package-lock.json` — added `jspdf` (^4.2.1).
- `README.md` — bumped to "Phase 11 of 12".

## Database collections affected

None. This is a pure client-side export of data the page already queried
(Phase 7's `listDailySalesForRange`/`listExpensesForRange`) — no new reads,
no new collections, no rules or index changes, no Firestore deploy needed
this phase.

## Business logic worth noting

- **PDF money is formatted WITHOUT a currency symbol** — `"INR 12,500.00"`,
  not `"₹12,500.00"`. This is deliberate, not a bug: `jspdf`'s built-in
  fonts (Helvetica/Times/Courier — the only ones available without
  embedding a custom font file, which would meaningfully bloat the app)
  only support the WinAnsi character set, which does NOT include the Rupee
  sign. Using the symbol would have silently rendered a missing-glyph box
  in place of ₹ on every amount in the PDF — for this specific user, on
  every single line. Spelling out the currency code sidesteps the problem
  for every currency this app supports, not just INR. The CSV export has
  no such restriction (plain decimal numbers, no symbol at all, since a
  spreadsheet column should be numeric anyway).
- **The CSV includes a UTF-8 BOM** (`﻿` at the very start of the
  file). Without it, Excel on Windows — this user's platform — can
  mis-detect the encoding of a UTF-8 CSV and garble any non-ASCII
  character. Nothing in the current CSV content is non-ASCII (money is
  plain digits, no currency symbol), but category/restaurant names could
  contain accented characters or other Unicode down the line, so the BOM
  is included now rather than becoming a "why did this break" surprise
  later.
- **The export always reflects the currently-selected date range** — there
  is no "export everything" or a separate export-specific date picker.
  Change the range, the numbers on screen update, and so does what the
  next export click produces. This matches how every other range-scoped
  view in the app already works (Sales Report, the P&L itself).
- **`html2canvas` shows up in the production bundle** as a side effect of
  `jspdf`'s own dependency tree (it's part of jsPDF's optional
  image-capture feature, which this app never calls) — adds roughly 47KB
  gzipped to the bundle. Not something this phase's code uses directly;
  flagging it here only so a future "why is the bundle bigger" investigation
  doesn't have to rediscover it.

## Assumptions

- **One page, A4, portrait.** A P&L for a very long date range with many
  expense categories could in principle run past one page — `jspdf` will
  NOT auto-paginate text placed with plain `.text()` calls the way this
  phase uses them, so a page long enough to overflow will have its last
  rows print off the bottom edge, cut off rather than flowing onto a page
  2. For the range presets this app offers (up to "This Year") and a
  realistic number of expense categories, this shouldn't come up in
  practice, but a future revisit should add pagination logic if it does.
- **No logo in the PDF.** Restaurant Profile (Phase 8) has a Cloudinary
  logo — this phase's PDF is text-only. Adding the logo image is a
  reasonable small follow-up (jsPDF supports `addImage()`) if wanted.

## Remaining / known issues

- Same sandbox limitation as every prior phase: this container's network
  egress is restricted, so the actual browser download flow (an anchor
  click producing a saved file, or `jspdf`'s `.save()`) could only be
  exercised at the Node/library level from inside this environment — both
  `jsPDF` document generation and the CSV row-escaping logic were smoke
  tested directly (a real PDF byte stream was produced; a comma-containing
  field round-tripped through the CSV escaper correctly), but the actual
  "click Export CSV/PDF in Chrome and check the downloaded file" step needs
  to happen on your machine.
- Phases 3 through 11 all remain not-yet-live-tested by you against the
  real project (Phase 11's export buttons specifically have never been
  clicked in a real browser).

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` shows only
the same 5 pre-existing warnings from Phase 1/2 context files (fast-refresh
hints, set-state-in-effect) — nothing new from Phase 11 code. `jsPDF`
document generation and CSV field escaping were additionally smoke-tested
directly under Node (see "Remaining / known issues" above) since this
sandbox can't drive an actual browser download.

## How to verify on your machine

1. **Run `npm install` first** (see the action-needed note at the top) —
   this phase added a dependency, unlike every phase before it.
2. No rules or index deploy needed — nothing in `firestore.rules` changed
   this phase at all.
3. Restart `npm run dev`, hard-refresh the browser.
4. Open **Reports → Profit & Loss**, pick a range with some data in it.
5. Click **Export CSV** — confirm a `.csv` file downloads, and that opening
   it in Excel/Sheets shows the same numbers as the on-screen Statement
   card (Revenue, Food Cost, Gross Profit, expense categories, Total
   Expenses, Net Profit).
6. Click **Export PDF** — confirm a `.pdf` file downloads, opens cleanly,
   and every amount shows as e.g. "INR 12,500.00" rather than a broken/
   missing character.
7. Change the date range and export again — confirm both files reflect the
   new range, not the old one.
