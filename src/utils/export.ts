/**
 * Small shared helpers for client-side file exports (Phase 11's P&L CSV/PDF
 * export is the first consumer; any future "download this as a file"
 * feature should reuse these rather than re-inventing them).
 */

/**
 * Triggers a browser download of in-memory text content — no server round
 * trip, works entirely client-side. Creates a short-lived object URL on an
 * invisible anchor, clicks it, then cleans both up immediately.
 */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escapes a single CSV field per RFC 4180 — wraps in double quotes (doubling
 * any embedded quotes) whenever the value contains a comma, quote, or
 * newline. Numbers pass through as plain digits (Excel/Sheets need an
 * unquoted numeric-looking string to treat a column as numbers, not text).
 */
export function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Joins fields into one CSV row (no trailing newline — the caller joins rows with \r\n). */
export function toCsvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(',');
}

/** Turns a free-text name into a safe filename fragment: lowercase, alphanumeric, single hyphens. */
export function safeFilenamePart(value: string, fallback = 'export'): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return cleaned || fallback;
}
