import { normalizeDigits } from './digits';

/**
 * Normalizes a Lebanese phone number to E.164 (+961…). Accepts local formats
 * ("03 123 456", "71123456", "07 721 234"), "+961…", "00961…" and Arabic
 * digits. Returns null when it is not a plausible Lebanese number.
 *
 * Lebanese numbering after +961:
 *  - Mobiles: 3 + 6 digits; 70, 71, 76, 78, 79, 81 + 6 digits
 *  - Landlines: area code 1, 4, 5, 6, 7, 8, 9 + 6 digits
 *    (Saida / South is 07; Iqlim El Kharroub / Chouf is 05 and 07)
 *
 * This only checks the format. It does NOT verify that the person controls the
 * number — that requires a configured SMS/OTP provider.
 */
export function normalizeLebanesePhone(input: string): string | null {
  let d = normalizeDigits(input).replace(/[\s().\-_/]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('961')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (/^(?:70|71|76|78|79|81)\d{6}$/.test(d)) return `+961${d}`;
  if (/^3\d{6}$/.test(d)) return `+961${d}`;
  if (/^[145679]\d{6}$/.test(d) || /^8\d{6}$/.test(d)) return `+961${d}`;
  return null;
}

export function isLebaneseMobile(e164: string): boolean {
  return /^\+961(?:3\d{6}|(?:70|71|76|78|79|81)\d{6})$/.test(e164);
}

/** "+96171123456" → "71 123 456" for display to authorized staff only. */
export function formatLebanesePhone(e164: string): string {
  const d = e164.replace(/^\+961/, '');
  if (d.length === 8) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  if (d.length === 7) return `0${d.slice(0, 1)} ${d.slice(1, 4)} ${d.slice(4)}`;
  return e164;
}

/** Masks a phone for logs and low-privilege views: +961 71 *** 456 */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  return `${e164.slice(0, 6)}***${e164.slice(-3)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
}
