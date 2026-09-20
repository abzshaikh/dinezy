/**
 * Centralized money handling. ALL monetary amounts are stored and computed
 * as integers in "minor units" (paise for INR: 1 rupee = 100 paise) to avoid
 * floating-point drift in financial calculations. Never store or compute
 * money as a JS float — always go through these helpers.
 *
 * A field named `xxxMinor` on any type/document is money in minor units.
 */

const CURRENCY_MINOR_UNIT_FACTOR: Record<string, number> = {
  INR: 100,
  USD: 100,
  GBP: 100,
  EUR: 100,
  AED: 100,
  JPY: 1, // Yen has no minor unit in practice
};

function factorFor(currency: string): number {
  return CURRENCY_MINOR_UNIT_FACTOR[currency] ?? 100;
}

/** Converts a decimal major-unit amount (e.g. rupees) entered by a user into integer minor units. */
export function toMinor(amount: number, currency = 'INR'): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = factorFor(currency);
  return Math.round(amount * factor);
}

/** Converts integer minor units back into a decimal major-unit number, for editing/display math. */
export function fromMinor(amountMinor: number, currency = 'INR'): number {
  const factor = factorFor(currency);
  return amountMinor / factor;
}

const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'en-IE',
  AED: 'ar-AE',
  JPY: 'ja-JP',
};

/** Formats integer minor units as a localized currency string, e.g. 25000 -> "₹250.00". */
export function formatCurrency(amountMinor: number, currency = 'INR'): string {
  const major = fromMinor(amountMinor, currency);
  const locale = CURRENCY_LOCALE[currency] ?? 'en-IN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: factorFor(currency) === 1 ? 0 : 2,
    maximumFractionDigits: factorFor(currency) === 1 ? 0 : 2,
  }).format(major);
}

/** Compact currency for tight spaces like chart axes, e.g. 1250000 minor -> "₹12.5K". */
export function formatCompactCurrency(amountMinor: number, currency = 'INR'): string {
  const major = fromMinor(amountMinor, currency);
  const locale = CURRENCY_LOCALE[currency] ?? 'en-IN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(major);
}

/** Formats a plain number with thousands separators, e.g. 12500 -> "12,500". */
export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(value);
}

/** Formats a ratio (0-1) as a percentage string, e.g. 0.6455 -> "64.55%". */
export function formatPercent(ratio: number, fractionDigits = 2): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

/** Safe percentage calculation that never divides by zero. */
export function calculatePercentage(part: number, whole: number): number {
  if (!whole) return 0;
  return part / whole;
}

/** Sums an array of integer minor-unit amounts safely (still integer arithmetic). */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, a) => total + (Number.isFinite(a) ? a : 0), 0);
}
