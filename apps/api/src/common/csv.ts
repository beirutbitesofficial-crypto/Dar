/** CSV cell escaping, including protection against spreadsheet formula injection. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Plain numbers (including negative amounts such as reversals) stay numeric.
  const numeric = /^-?\d+(\.\d+)?$/.test(s);
  if (!numeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 BOM so Excel opens Arabic text correctly; CRLF line endings. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
