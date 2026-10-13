import { formatDateBeirut, formatDateTimeBeirut, formatUSD, type Locale } from '@dar/shared';

export const usd = (cents: number | null | undefined, locale: Locale = 'en') => (cents === null || cents === undefined ? '—' : formatUSD(cents, locale));
export const date = (v: string | Date | null | undefined, locale: Locale = 'ar') => (v ? formatDateBeirut(v, locale) : '—');
export const dateTime = (v: string | Date | null | undefined, locale: Locale = 'ar') => (v ? formatDateTimeBeirut(v, locale) : '—');
export const centsToInput = (cents: number) => (cents / 100).toFixed(2);
