import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  startOfYear,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  format,
  parseISO,
} from 'date-fns';
import type { DailySalesEntry } from '../types/sales';
import type { Expense } from '../types/expense';

/**
 * Powers the Dashboard trend chart's period switcher. Each granularity has a
 * fixed lookback window (below) chosen so the chart always renders a
 * readable number of points (roughly 12-14) rather than the axis getting
 * crowded on "Days" or sparse on "Years".
 */
export type TrendGranularity = 'day' | 'week' | 'month' | 'year';

const WEEK_OPTS = { weekStartsOn: 1 as const }; // Monday — matches resolveDateRangePreset('thisWeek') elsewhere in this app

/** The Firestore-query-friendly [start, end] window for a given granularity, ending "now". */
export function resolveTrendWindow(granularity: TrendGranularity, now: Date = new Date()): { start: Date; end: Date } {
  const end = endOfDay(now);
  switch (granularity) {
    case 'day':
      return { start: startOfDay(subDays(now, 13)), end }; // last 14 days
    case 'week':
      return { start: startOfWeek(subWeeks(now, 11), WEEK_OPTS), end }; // last 12 weeks
    case 'month':
      return { start: startOfMonth(subMonths(now, 11)), end }; // last 12 months
    case 'year':
      return { start: startOfYear(subYears(now, 4)), end }; // last 5 years
  }
}

export interface TrendBucket {
  /** yyyy-MM-dd of the bucket's start — also the key used to line up aggregated data (see bucketTrendData). */
  key: string;
  /** Short label for the chart's x-axis, e.g. "12 Aug", "Mar 26", "2026". */
  label: string;
  /** Fuller label for the tooltip, e.g. "Tue, 12 Aug 2026", "Week of 10 Aug 2026". */
  fullLabel: string;
}

/** The ordered list of empty buckets to plot for a granularity — every period in the window appears even if no data fell into it, so gaps in recording show up as a dip to zero rather than a missing point. */
export function buildTrendBuckets(granularity: TrendGranularity, now: Date = new Date()): TrendBucket[] {
  const { start, end } = resolveTrendWindow(granularity, now);
  switch (granularity) {
    case 'day':
      return eachDayOfInterval({ start, end }).map((d) => ({
        key: format(d, 'yyyy-MM-dd'),
        label: format(d, 'd MMM'),
        fullLabel: format(d, 'EEE, d MMM yyyy'),
      }));
    case 'week':
      return eachWeekOfInterval({ start, end }, WEEK_OPTS).map((d) => {
        const weekStart = startOfWeek(d, WEEK_OPTS);
        const weekEnd = endOfWeek(d, WEEK_OPTS);
        return {
          key: format(weekStart, 'yyyy-MM-dd'),
          label: format(weekStart, 'd MMM'),
          fullLabel: `Week of ${format(weekStart, 'd MMM yyyy')} – ${format(weekEnd, 'd MMM yyyy')}`,
        };
      });
    case 'month':
      return eachMonthOfInterval({ start, end }).map((d) => ({
        key: format(startOfMonth(d), 'yyyy-MM-dd'),
        label: format(d, 'MMM yy'),
        fullLabel: format(d, 'MMMM yyyy'),
      }));
    case 'year':
      return eachYearOfInterval({ start, end }).map((d) => ({
        key: format(startOfYear(d), 'yyyy-MM-dd'),
        label: format(d, 'yyyy'),
        fullLabel: format(d, 'yyyy'),
      }));
  }
}

/** Maps one `yyyy-MM-dd` entry date to the bucket key it belongs to at a given granularity — the inverse of buildTrendBuckets' `key`. */
function bucketKeyForDate(dateStr: string, granularity: TrendGranularity): string {
  const d = parseISO(dateStr);
  switch (granularity) {
    case 'day':
      return dateStr;
    case 'week':
      return format(startOfWeek(d, WEEK_OPTS), 'yyyy-MM-dd');
    case 'month':
      return format(startOfMonth(d), 'yyyy-MM-dd');
    case 'year':
      return format(startOfYear(d), 'yyyy-MM-dd');
  }
}

export interface TrendPoint extends TrendBucket {
  revenueMinor: number;
  expensesMinor: number;
  /** Gross sales profit for the bucket minus its active expenses — same formula as PnLPage's netProfitMinor and the Dashboard stat cards. */
  profitMinor: number;
}

/**
 * Aggregates raw `dailySales`/`expenses` rows (already fetched for the
 * whole window by the caller — one range query each, same pattern as the
 * stat cards above) into one point per bucket. A single pass building
 * per-bucket sums in a Map, rather than filtering the full array once per
 * bucket, so this stays cheap even at "Years" granularity with a wide
 * window.
 */
export function bucketTrendData(
  granularity: TrendGranularity,
  buckets: TrendBucket[],
  salesEntries: DailySalesEntry[],
  expenses: Expense[],
): TrendPoint[] {
  const revenueByKey = new Map<string, number>();
  const grossProfitByKey = new Map<string, number>();
  const expensesByKey = new Map<string, number>();

  for (const entry of salesEntries) {
    if (entry.quantitySold <= 0) continue;
    const key = bucketKeyForDate(entry.date, granularity);
    revenueByKey.set(key, (revenueByKey.get(key) ?? 0) + (entry.revenueMinor ?? 0));
    grossProfitByKey.set(key, (grossProfitByKey.get(key) ?? 0) + (entry.profitMinor ?? 0));
  }
  for (const expense of expenses) {
    if (expense.isVoided) continue;
    const key = bucketKeyForDate(expense.expenseDate, granularity);
    expensesByKey.set(key, (expensesByKey.get(key) ?? 0) + (expense.amountMinor ?? 0));
  }

  return buckets.map((bucket) => {
    const revenueMinor = revenueByKey.get(bucket.key) ?? 0;
    const grossProfitMinor = grossProfitByKey.get(bucket.key) ?? 0;
    const expensesMinor = expensesByKey.get(bucket.key) ?? 0;
    return {
      ...bucket,
      revenueMinor,
      expensesMinor,
      profitMinor: grossProfitMinor - expensesMinor,
    };
  });
}
