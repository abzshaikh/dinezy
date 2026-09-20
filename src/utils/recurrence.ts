import { addDays, lastDayOfMonth, startOfWeek } from 'date-fns';
import { format } from 'date-fns';
import type { RecurringExpenseTemplate } from '../types';

/**
 * Computes the next due date for a recurring expense template, DERIVED
 * fresh every time from `frequency`/`dayOfMonth`/`dayOfWeek`/
 * `lastGeneratedDate` — never stored, so editing a template's schedule
 * can't leave a stale due date behind (see the doc comment on
 * `RecurringExpenseTemplate` in src/types/expense.ts).
 *
 * Semantics: if never generated, the returned date can be EARLIER than
 * today (this cycle's occurrence, possibly already past) — that's
 * intentional, it means "this is due / overdue," not a bug. Once
 * generated, the next due date is always strictly after the last
 * generated date.
 */
export function computeNextDueDate(
  template: Pick<RecurringExpenseTemplate, 'frequency' | 'dayOfMonth' | 'dayOfWeek' | 'lastGeneratedDate'>,
  todayStr: string,
): string {
  const today = new Date(`${todayStr}T00:00:00`);

  if (template.frequency === 'monthly') {
    const day = template.dayOfMonth ?? 1;
    let year: number;
    let monthIndex: number;
    if (template.lastGeneratedDate) {
      const last = new Date(`${template.lastGeneratedDate}T00:00:00`);
      year = last.getFullYear();
      monthIndex = last.getMonth() + 1; // the month AFTER the last one logged
    } else {
      year = today.getFullYear();
      monthIndex = today.getMonth(); // this month's occurrence — may already be past (overdue)
    }
    // Clamp to the real last day of that month (e.g. day=31 in Feb -> 28th/29th).
    const clampedDate = new Date(year, monthIndex, 1);
    const lastDay = lastDayOfMonth(clampedDate).getDate();
    clampedDate.setDate(Math.min(day, lastDay));
    return format(clampedDate, 'yyyy-MM-dd');
  }

  // Weekly
  const targetDow = template.dayOfWeek ?? 0;
  const searchFrom = template.lastGeneratedDate
    ? addDays(new Date(`${template.lastGeneratedDate}T00:00:00`), 1) // strictly after last logged
    : startOfWeek(today, { weekStartsOn: 0 }); // this week's occurrence — may already be past (overdue)
  const diff = (targetDow - searchFrom.getDay() + 7) % 7;
  const next = addDays(searchFrom, diff);
  return format(next, 'yyyy-MM-dd');
}

/** True when a template's next due date has arrived (today or earlier). */
export function isTemplateDue(
  template: Pick<RecurringExpenseTemplate, 'frequency' | 'dayOfMonth' | 'dayOfWeek' | 'lastGeneratedDate'>,
  todayStr: string,
): boolean {
  return computeNextDueDate(template, todayStr) <= todayStr;
}

export const DAY_OF_WEEK_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
