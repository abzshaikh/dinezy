import { jsPDF } from 'jspdf';
import { fromMinor } from '../../utils/money';
import { downloadTextFile, safeFilenamePart, toCsvRow } from '../../utils/export';

/**
 * Everything the P&L export needs, computed once in `PnLPage.tsx` and
 * passed in here — this module has no Firestore/React dependency of its
 * own, just data in, file out. Deliberately mirrors the shape of the
 * on-screen Statement card so the exported file and what the user is
 * looking at can never drift apart.
 */
export interface PnLExportData {
  restaurantName: string;
  currency: string;
  startDate: string;
  endDate: string;
  revenueMinor: number;
  costMinor: number;
  grossProfitMinor: number;
  grossMarginPct: number;
  canSeeExpenses: boolean;
  expensesByCategory: { categoryName: string; totalMinor: number; count: number }[];
  totalExpensesMinor: number;
  netProfitMinor: number;
  netMarginPct: number;
}

function baseFilename(data: PnLExportData): string {
  return `pnl-${safeFilenamePart(data.restaurantName, 'restaurant')}-${data.startDate}-to-${data.endDate}`;
}

/** Formats minor units as a plain decimal number (no currency symbol) — the right shape for a spreadsheet column Excel/Sheets will treat as numeric, not text. */
function majorDecimal(amountMinor: number, currency: string): string {
  return fromMinor(amountMinor, currency).toFixed(currency === 'JPY' ? 0 : 2);
}

export function exportPnLToCsv(data: PnLExportData): void {
  const amt = (m: number) => majorDecimal(m, data.currency);
  const rows: string[] = [];

  rows.push(toCsvRow(['Profit & Loss', data.restaurantName]));
  rows.push(toCsvRow(['Period', `${data.startDate} to ${data.endDate}`]));
  rows.push(toCsvRow(['Currency', data.currency]));
  rows.push('');
  rows.push(toCsvRow(['Line', 'Amount']));
  rows.push(toCsvRow(['Revenue', amt(data.revenueMinor)]));
  rows.push(toCsvRow(['Food Cost (COGS)', amt(-data.costMinor)]));
  rows.push(toCsvRow(['Gross Profit', amt(data.grossProfitMinor)]));
  rows.push(toCsvRow(['Gross Margin %', data.grossMarginPct.toFixed(1)]));

  if (data.canSeeExpenses) {
    rows.push('');
    rows.push(toCsvRow(['Expense Category', '# of entries', 'Total', '% of expenses']));
    for (const c of data.expensesByCategory) {
      const pct = data.totalExpensesMinor > 0 ? ((c.totalMinor / data.totalExpensesMinor) * 100).toFixed(1) : '0.0';
      rows.push(toCsvRow([c.categoryName, c.count, amt(-c.totalMinor), pct]));
    }
    rows.push(toCsvRow(['Total Expenses', '', amt(-data.totalExpensesMinor), '']));
    rows.push('');
    rows.push(toCsvRow(['Net Profit', amt(data.netProfitMinor)]));
    rows.push(toCsvRow(['Net Margin %', data.netMarginPct.toFixed(1)]));
  }

  // \r\n line endings and a leading UTF-8 BOM: Excel on Windows (this user's
  // machine) otherwise mis-detects the encoding of the ₹/currency-adjacent
  // text and can garble it, and treats a plain \n-only CSV inconsistently.
  const csv = '﻿' + rows.join('\r\n');
  downloadTextFile(`${baseFilename(data)}.csv`, csv, 'text/csv;charset=utf-8');
}

/**
 * Formats money WITHOUT a currency symbol (`"INR 12,500.00"`, not
 * `"₹12,500.00"`) — deliberate, not an oversight. jsPDF's built-in fonts
 * (Helvetica/Times/Courier, the only ones available without embedding a
 * custom font file, which would meaningfully bloat this app) only support
 * the WinAnsi character set. The Rupee sign (₹) isn't in it — it would
 * render as a missing-glyph box, silently corrupting every amount in the
 * PDF for this user's actual (INR) restaurant. Spelling out the currency
 * code sidesteps the whole font problem for every currency this app
 * supports, not just INR.
 */
function formatMoneyPlain(amountMinor: number, currency: string): string {
  const major = fromMinor(amountMinor, currency);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(major);
  return `${currency} ${formatted}`;
}

export function exportPnLToPdf(data: PnLExportData): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - marginX;
  const lineHeight = 18;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Profit & Loss', marginX, y);
  y += lineHeight;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(data.restaurantName, marginX, y);
  y += lineHeight * 0.8;
  doc.setTextColor(100);
  doc.text(`${data.startDate} to ${data.endDate}`, marginX, y);
  doc.setTextColor(0);
  y += lineHeight * 1.6;

  function row(label: string, value: string, opts: { bold?: boolean; indent?: boolean } = {}) {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(11);
    doc.text(label, marginX + (opts.indent ? 16 : 0), y);
    doc.text(value, rightX, y, { align: 'right' });
    y += lineHeight;
  }

  function rule() {
    doc.setDrawColor(200);
    doc.line(marginX, y - lineHeight + 6, rightX, y - lineHeight + 6);
  }

  function caption(text: string) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(text, marginX, y);
    doc.setTextColor(0);
    y += lineHeight * 1.3;
  }

  row('Revenue', formatMoneyPlain(data.revenueMinor, data.currency));
  row('Food Cost (COGS)', `(${formatMoneyPlain(data.costMinor, data.currency)})`);
  rule();
  row('Gross Profit', formatMoneyPlain(data.grossProfitMinor, data.currency), { bold: true });
  caption(`${data.grossMarginPct.toFixed(1)}% gross margin`);

  if (data.canSeeExpenses) {
    if (data.expensesByCategory.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text('No expenses recorded in this range.', marginX + 16, y);
      doc.setTextColor(0);
      y += lineHeight;
    } else {
      for (const c of data.expensesByCategory) {
        row(`${c.categoryName} (${c.count})`, `(${formatMoneyPlain(c.totalMinor, data.currency)})`, { indent: true });
      }
    }
    row('Total Expenses', `(${formatMoneyPlain(data.totalExpensesMinor, data.currency)})`);
    rule();
    row('Net Profit', formatMoneyPlain(data.netProfitMinor, data.currency), { bold: true });
    caption(`${data.netMarginPct.toFixed(1)}% net margin`);
  }

  y += lineHeight * 0.4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  const disclaimer =
    'This P&L uses recipe-based food cost (from Daily Sales) and logged Expenses only - it does not allocate ' +
    'costs like rent across days, include payroll taxes or depreciation, or use an inventory-formula COGS ' +
    '(Beginning + Purchases - Ending). Treat it as an accurate operating P&L, not a full accounting statement.';
  const wrapped = doc.splitTextToSize(disclaimer, rightX - marginX);
  doc.text(wrapped, marginX, y);

  doc.save(`${baseFilename(data)}.pdf`);
}
