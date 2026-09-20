import {
  format,
  formatDistanceToNow,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subDays,
} from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

/** Converts a Firestore Timestamp (or plain Date/undefined) into a JS Date. */
export function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate();
  return null;
}

export function formatDate(value: Timestamp | Date | null | undefined, pattern = 'dd MMM yyyy'): string {
  const d = toDate(value);
  return d ? format(d, pattern) : '—';
}

export function formatDateTime(value: Timestamp | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy, hh:mm a') : '—';
}

export function formatRelative(value: Timestamp | Date | null | undefined): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

/** Resolves a named date-range preset into concrete start/end Dates (inclusive day bounds). */
export function resolveDateRangePreset(preset: DateRangePreset, now: Date = new Date()): DateRange {
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case 'thisWeek':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    case 'thisMonth':
      return { start: startOfMonth(now), end: endOfDay(now) };
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case 'thisYear':
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}
