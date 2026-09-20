# Phase 13 Report — Recurring Expenses

## Why this phase, and why now

Same autonomous continuation as Phase 12 — recurring expenses (rent,
subscriptions, anything that repeats on a schedule) was next on the
candidate list, and unlike billing/invoicing or re-adding team members, it
needed no genuinely new judgment calls about scope that would be worth
pausing to ask about.

## What was implemented

- **Recurring Expenses** page (`Expenses → Recurring Expenses`,
  `/app/expenses/recurring`) — set up a template for a cost that repeats:
  category, a typical amount, optional vendor/note, and a schedule (monthly
  on a chosen day-of-month, or weekly on a chosen day-of-week).
- Each template shows its **next due date**, computed fresh every time from
  the schedule (never stored — see "Business logic" below) — highlighted
  and marked "(due)" once that date has arrived, with a page-level banner
  summarizing how many are due.
- A **"Log expense"** button on each active template opens the exact same
  New Expense dialog used everywhere else in the app, prefilled from the
  template (category/amount/vendor/note) but fully editable before saving —
  the actual bill is sometimes a little different from the usual amount,
  and this app's whole design philosophy (manual EOD stock entry, no
  Orders/POS) is "the user reviews and confirms, nothing happens silently."
  Saving logs a completely normal `Expense` document (shows up everywhere
  Expenses already show up — the Expenses list, the P&L, the Sales Report's
  net profit) and marks the template's "last generated" date so its next
  due date rolls forward.
- Templates can be edited, paused (without losing history), or deleted
  (deleting only removes the reminder — any expenses already logged from it
  are untouched, since they're independent documents).

## Files created

- `src/utils/recurrence.ts` — pure `computeNextDueDate()`/`isTemplateDue()`
  functions (no Firestore/React dependency), plus `DAY_OF_WEEK_LABELS`.
  Smoke-tested directly under Node against four cases (monthly day-31
  clamping into February, a monthly rollover after logging, a weekly
  overdue case, and a weekly rollover after logging) — all four produced
  the expected date. See "Business logic" below for the exact semantics.
- `src/features/expenses/RecurringExpensesPage.tsx` — the page.
- `src/features/expenses/RecurringExpenseTemplateFormDialog.tsx` — the
  create/edit template dialog.
- `PHASE_13_REPORT.md` — this report.

## Files modified

- `src/types/expense.ts` — added `RecurrenceFrequency`,
  `RecurringExpenseTemplate`, `SaveRecurringExpenseTemplateInput`.
- `src/services/expenseService.ts` — added
  `listRecurringExpenseTemplates`, `createRecurringExpenseTemplate`,
  `updateRecurringExpenseTemplate`, `setRecurringExpenseTemplateActive`,
  `deleteRecurringExpenseTemplate`, `markRecurringExpenseGenerated`.
- `src/utils/validation.ts` — added `recurringExpenseTemplateSchema`.
- `src/features/expenses/ExpenseFormDialog.tsx` — added the
  `initialValues` prop (see Phase 12's report) that this phase's "Log
  expense" flow uses to prefill from a template.
- `src/app/navConfig.ts` — added the "Recurring Expenses" nav item.
- `src/App.tsx` — added the `/app/expenses/recurring` route.
- `firestore.rules` — new `recurringExpenseTemplates` match block (see
  below — this one has a real permission subtlety, not just a comment).
- `README.md` — bumped to "Phase 13 of 13" (see "A note on the phase
  count" below).

## Database collections affected

New: `restaurants/{restaurantId}/recurringExpenseTemplates`. No composite
index needed — the only query is `listRecurringExpenseTemplates`, a single
`orderBy('createdAt')` with no filter.

## Business logic worth noting

- **Nothing here creates an `Expense` document automatically.** There is no
  cron, no scheduled Cloud Function (this project is on Firebase's Spark/
  free plan — scheduled functions need Blaze billing, same constraint
  already documented for Cloudinary vs Firebase Storage). A template is
  purely a reminder + a prefill; logging the real expense is always an
  explicit save action by a person.
- **The next due date is DERIVED, never stored.** `computeNextDueDate()`
  takes `frequency`/`dayOfMonth`/`dayOfWeek`/`lastGeneratedDate` and
  computes fresh every render. This means editing a template's schedule
  (say, moving rent from the 1st to the 5th) can never leave a stale
  "next due" value behind — there's no cached field that could disagree
  with the current schedule.
- **Before a template has ever been logged, its computed due date can be in
  the PAST — that's intentional, not a bug.** It means "this occurrence
  hasn't been logged yet," shown as overdue/due-now rather than skipped.
  After the first log, the next due date is always strictly after
  `lastGeneratedDate`.
- **`dayOfMonth` is clamped to the real length of a shorter month** — a
  template set to the 31st shows a February due date of the 28th (or 29th
  in a leap year), same convention most billing systems use, rather than
  skipping February or spilling into March.
- **A real permission subtlety in `firestore.rules`, worth reading
  carefully**: managing a template (create/edit/pause/delete) needs
  `expense.edit`. But logging a due expense needs only `expense.create` —
  and the "manager" role has `expense.create` WITHOUT `expense.edit` (see
  `ROLE_PERMISSIONS` in `src/types/permissions.ts`). Logging an expense
  from a template also writes `lastGeneratedDate` back onto the template
  document itself (`markRecurringExpenseGenerated`), which is technically
  an update to a `recurringExpenseTemplates` doc. A naive rule requiring
  `expense.edit` for ANY update to that collection would have silently
  broken "Log expense" for exactly the role most likely to use it day to
  day. The rule has two update branches instead: full `expense.edit` access
  to every field, or an `expense.create`-only branch restricted (via
  `diff(resource.data).affectedKeys().hasOnly([...])`) to touching ONLY
  `lastGeneratedDate`/`updatedAt` — the same "narrow permission slice"
  pattern Phase 4 established for the ingredients three-branch rule. This
  was caught and fixed during this same build, before ever reaching your
  machine — see the inline comment in `firestore.rules` right above that
  match block for the full reasoning.
- **A `manager` can therefore log an expense from ANY active template,
  even one they didn't create and can't edit** — by design (same as being
  able to create any regular expense against any active category), not a
  gap.

## Assumptions

- **A deleted template doesn't affect expenses already logged from it** —
  there's no link from an `Expense` back to the template that produced it
  (a logged expense is just a normal, independent `Expense` document), so
  deleting the reminder can never retroactively change historical data.
- **No "skip this occurrence" action** — pausing a template stops it from
  showing as due at all (including catching up once resumed, since the due
  date is derived from `lastGeneratedDate`, not wall-clock time elapsed
  while paused). If you want to explicitly skip one occurrence without
  pausing, the practical workaround today is logging it with a $0 amount,
  which isn't an ideal UX — a real "skip" action is a reasonable follow-up
  if this comes up in practice.
- **Templates aren't restaurant-currency-aware beyond the amount field
  itself** — same currency handling as every other money field in the app
  (integer minor units, `formatCurrency`).

## A note on the phase count

The original plan was 12 phases. Phases 12 and 13 (this one) are the first
to go beyond that — the user explicitly asked to keep going and "complete
everything" from the remaining candidate list after Phase 11, so phase
numbering just continues rather than stopping at a since-exceeded original
count. `README.md` now says "Phase 13 of 13" rather than "of 12" for this
reason — expect that denominator to keep climbing as more of the candidate
list gets built out in this same continuation.

## Remaining / known issues

- Same sandbox limitation as every prior phase: no live Firestore access
  from this environment. The pure date-math in `recurrence.ts` was directly
  smoke-tested under Node (see "Files created" above) since it has no
  Firebase dependency, but the full page — creating a template, seeing it
  go "due," logging an expense from it, confirming `lastGeneratedDate`
  rolls the due date forward — needs to happen on your machine.
- Phases 3 through 13 all remain not-yet-live-tested by you against the
  real project.

## Build/test result

`npm run build` (`tsc -b && vite build`) passes clean. `oxlint` initially
flagged one NEW warning specific to this phase's code
(`react(incompatible-library)` on a `watch()` call in
`RecurringExpenseTemplateFormDialog.tsx` — the React Compiler can't safely
memoize functions `react-hook-form`'s `watch()` returns) — fixed by
switching to plain local `useState` synced from the frequency field's
`onChange` instead of calling `watch()`, which is also more consistent
with how the rest of this codebase already handles this kind of
"conditionally show a different field" pattern. Final lint result: the
same 5 pre-existing warnings from Phase 1/2 context files, nothing new
from Phase 12 or 13 code.

## How to verify on your machine

1. Deploy the new rule:
   `firebase deploy --only firestore:rules --project restaurant-management-553db`
   (no new indexes this phase).
2. Restart `npm run dev`, hard-refresh.
3. Open **Expenses → Recurring Expenses**, create one (e.g. "Rent",
   monthly, day 1). Confirm it shows a next-due date and, if that date has
   already passed this month, shows "(due)" and the info banner at the top.
4. Click **Log expense** — confirm the New Expense dialog opens prefilled
   with the template's category/amount, save it.
5. Confirm: the expense now shows up on the regular Expenses page; back on
   Recurring Expenses, the template's next-due date has moved forward to
   next month.
6. Try pausing a template, confirm its "Log expense" button disappears;
   resume it and confirm it reappears.
7. If you have a non-owner "Manager" user available to test with: confirm
   they can log an expense from a template but can't edit/pause/delete the
   template itself (those actions should be hidden or blocked for them).
