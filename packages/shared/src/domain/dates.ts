import { DomainError } from './errors';

/**
 * Calendar dates are plain 'YYYY-MM-DD' strings interpreted in Asia/Beirut.
 * Rental periods, due dates and availability are calendar dates — never
 * timestamps — so there is no daylight-saving or UTC-offset drift.
 */
export type ISODate = string;
export const APP_TIME_ZONE = 'Asia/Beirut';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(date: ISODate): { y: number; m: number; d: number } {
  const match = ISO_RE.exec(date);
  if (!match) throw new DomainError('DATE_INVALID', `Invalid date: ${date}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) throw new DomainError('DATE_INVALID', `Invalid date: ${date}`);
  return { y, m, d };
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toEpochDay(date: ISODate): number {
  const { y, m, d } = parseISODate(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromEpochDay(day: number): ISODate {
  const dt = new Date(day * 86_400_000);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toEpochDay(b) - toEpochDay(a);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0; // ISO strings sort lexicographically
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return compareDates(a, b) <= 0 ? a : b;
}

/**
 * Adds n months keeping the anchor day where possible and clamping to the
 * month end otherwise (Jan 31 + 1 month = Feb 28/29, + 2 months = Mar 31).
 */
export function addMonthsAnchored(start: ISODate, months: number, anchorDay?: number): ISODate {
  const { y, m, d } = parseISODate(start);
  const anchor = anchorDay ?? d;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISODate(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
}

/** Today's calendar date in Beirut. */
export function todayInBeirut(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatDateBeirut(value: Date | string, locale: 'ar' | 'en' = 'ar'): string {
  const date = typeof value === 'string' && ISO_RE.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-LB-u-nu-latn' : 'en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatDateTimeBeirut(value: Date | string, locale: 'ar' | 'en' = 'ar'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-LB-u-nu-latn' : 'en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
