import { jsPDF } from 'jspdf';
import { fromMinor } from '../../utils/money';
import { safeFilenamePart } from '../../utils/export';
import type { Invoice, Restaurant } from '../../types';

/**
 * Formats money WITHOUT a currency symbol — same reasoning as
 * `formatMoneyPlain` in `pnlExport.ts`: jsPDF's built-in fonts don't
 * support the Rupee sign, so every amount would silently render a
 * missing-glyph box for this app's INR users. Duplicated rather than
 * imported from pnlExport.ts to keep these two export modules independent
 * (reports vs. billing) — see that file's own comment for the full reasoning.
 */
function formatMoneyPlain(amountMinor: number, currency: string): string {
  const major = fromMinor(amountMinor, currency);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(major);
  return `${currency} ${formatted}`;
}

/** Generates a simple, printable A4 invoice PDF and triggers a browser download. */
export function exportInvoiceToPdf(invoice: Invoice, restaurant: Restaurant): void {
  const currency = restaurant.currency;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - marginX;
  const lineHeight = 18;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(restaurant.restaurantName, marginX, y);
  doc.setFontSize(14);
  doc.text('INVOICE', rightX, y, { align: 'right' });
  y += lineHeight;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  const addressLine = [restaurant.address, restaurant.city, restaurant.state, restaurant.pincode]
    .filter(Boolean)
    .join(', ');
  if (addressLine) {
    doc.text(addressLine, marginX, y);
  }
  doc.text(invoice.invoiceNumber, rightX, y, { align: 'right' });
  y += lineHeight * 0.8;
  if (restaurant.gstNumber) {
    doc.text(`GSTIN: ${restaurant.gstNumber}`, marginX, y);
  }
  doc.text(invoice.invoiceDate, rightX, y, { align: 'right' });
  doc.setTextColor(0);
  y += lineHeight * 1.6;

  if (invoice.customerName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Bill to: ${invoice.customerName}`, marginX, y);
    y += lineHeight * 1.4;
  }

  // Table header
  doc.setDrawColor(200);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Item', marginX, y);
  doc.text('Qty', rightX - 220, y, { align: 'right' });
  doc.text('Price', rightX - 110, y, { align: 'right' });
  doc.text('Amount', rightX, y, { align: 'right' });
  y += 6;
  doc.line(marginX, y, rightX, y);
  y += lineHeight;

  doc.setFont('helvetica', 'normal');
  for (const line of invoice.lineItems) {
    doc.text(line.menuItemName, marginX, y, { maxWidth: rightX - 230 - marginX });
    doc.text(String(line.quantity), rightX - 220, y, { align: 'right' });
    doc.text(formatMoneyPlain(line.unitPriceMinor, currency), rightX - 110, y, { align: 'right' });
    doc.text(formatMoneyPlain(line.lineTotalMinor, currency), rightX, y, { align: 'right' });
    y += lineHeight;
  }

  y += 6;
  doc.line(marginX, y, rightX, y);
  y += lineHeight;

  function row(label: string, value: string, opts: { bold?: boolean } = {}) {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.text(label, rightX - 220, y);
    doc.text(value, rightX, y, { align: 'right' });
    y += lineHeight;
  }

  row('Subtotal', formatMoneyPlain(invoice.subtotalMinor, currency));
  if (invoice.serviceChargePercent > 0) {
    row(`Service Charge (${invoice.serviceChargePercent}%)`, formatMoneyPlain(invoice.serviceChargeMinor, currency));
  }
  if (invoice.gstPercent > 0) {
    row(`GST (${invoice.gstPercent}%)`, formatMoneyPlain(invoice.gstMinor, currency));
  }
  doc.setDrawColor(0);
  doc.line(rightX - 220, y - lineHeight + 6, rightX, y - lineHeight + 6);
  row('Total', formatMoneyPlain(invoice.totalMinor, currency), { bold: true });

  if (invoice.status === 'voided') {
    y += lineHeight * 0.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(200, 0, 0);
    doc.text('VOIDED', marginX, y);
    doc.setTextColor(0);
  }

  if (invoice.note) {
    y += lineHeight * 1.4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    const wrapped = doc.splitTextToSize(`Note: ${invoice.note}`, rightX - marginX);
    doc.text(wrapped, marginX, y);
    doc.setTextColor(0);
  }

  doc.save(`invoice-${safeFilenamePart(invoice.invoiceNumber, 'invoice')}.pdf`);
}
