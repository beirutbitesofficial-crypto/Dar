/** Conversions between Prisma BIGINT columns and the integer-cents numbers used by @dar/shared. */
export function toCents(v: bigint | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'bigint' ? Number(v) : v;
  if (!Number.isSafeInteger(n)) throw new Error('Money value outside safe integer range');
  return n;
}

export function toCentsOrNull(v: bigint | null | undefined): number | null {
  return v === null || v === undefined ? null : toCents(v);
}

export function big(n: number): bigint {
  if (!Number.isSafeInteger(n)) throw new Error('Money value must be an integer number of cents');
  return BigInt(n);
}

/** Prisma @db.Date columns come back as UTC-midnight Date objects. */
export function dateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function toDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export const ref = (prefix: string, n: number) => `${prefix}-${1000 + n}`;
