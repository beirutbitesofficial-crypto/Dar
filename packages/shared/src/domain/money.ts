import { DomainError } from './errors';
import { normalizeDigits } from './digits';

/**
 * All money is stored and computed as integer US cents ("minor units").
 * Percentages are integer basis points (1 bp = 0.01%; 250 bp = 2.5%).
 * No floating-point arithmetic is used for money anywhere in the domain.
 */
export type Cents = number;
export type BasisPoints = number;

export const CURRENCY = 'USD' as const;
/** Upper bound protects against overflow and fat-finger input: $1,000,000,000. */
export const MAX_CENTS = 100_000_000_000;

export function assertCents(value: number, field = 'amount'): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new DomainError('MONEY_NOT_INTEGER_CENTS', `${field} must be an integer number of cents`);
  }
  if (value < 0) throw new DomainError('MONEY_NEGATIVE', `${field} must not be negative`);
  if (value > MAX_CENTS) throw new DomainError('MONEY_TOO_LARGE', `${field} exceeds the maximum`);
  return value;
}

export function assertBasisPoints(value: number, field = 'rate'): BasisPoints {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new DomainError('RATE_INVALID', `${field} must be an integer between 0 and 10000 basis points`);
  }
  return value;
}

/** amount × bps / 10000, rounded half-up to the cent, using BigInt (exact). */
export function applyBasisPoints(amount: Cents, bps: BasisPoints): Cents {
  assertCents(amount);
  assertBasisPoints(bps);
  const product = BigInt(amount) * BigInt(bps);
  const rounded = (product + 5000n) / 10000n;
  return Number(rounded);
}

/** amount × numerator / denominator, rounded half-up (for day-based proration). */
export function prorate(amount: Cents, numerator: number, denominator: number): Cents {
  assertCents(amount);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0 || numerator < 0) {
    throw new DomainError('PRORATION_INVALID');
  }
  if (numerator >= denominator) return amount;
  const n = BigInt(amount) * BigInt(numerator) * 2n + BigInt(denominator);
  return Number(n / (BigInt(denominator) * 2n));
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    if (!Number.isSafeInteger(v)) throw new DomainError('MONEY_NOT_INTEGER_CENTS');
    total += v;
  }
  return total;
}

export function dollarsToCents(dollars: number): Cents {
  // Only for whole-dollar configuration constants such as the $50 default fee.
  if (!Number.isSafeInteger(dollars)) throw new DomainError('MONEY_NOT_WHOLE_DOLLARS');
  return assertCents(dollars * 100);
}

/**
 * Parses user input such as "150,000", "١٥٠٬٠٠٠", "$1,250.50" into cents.
 * Returns null when the input is not a valid non-negative amount with ≤ 2 decimals.
 */
export function parseMoneyInput(input: string): Cents | null {
  const normalized = normalizeDigits(input)
    .replace(/[\s$,٬،]/g, '') // spaces, $, comma, Arabic thousands separator, Arabic comma
    .replace(/٫/g, '.'); // Arabic decimal separator
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = '0', frac = ''] = normalized.split('.');
  const cents = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
  if (cents > BigInt(MAX_CENTS)) return null;
  return Number(cents);
}

export type DisplayLocale = 'ar' | 'en';

/**
 * Formats cents as USD. Arabic uses Latin digits, which is what most people in
 * Lebanon expect for prices. Whole-dollar amounts omit the decimals.
 */
export function formatUSD(cents: Cents, locale: DisplayLocale = 'ar'): string {
  const whole = cents % 100 === 0;
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const text = fmt.format(cents / 100);
  // In Arabic text, wrap the amount in a left-to-right isolate so "$600" is never
  // reordered by the bidi algorithm into "600 $" or "$US 600".
  return locale === 'ar' ? `\u2066${text}\u2069` : text;
}

/** Plain decimal string for CSV exports and receipts, e.g. 2500.00 */
export function centsToDecimalString(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function formatBasisPoints(bps: BasisPoints): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}%`;
}
