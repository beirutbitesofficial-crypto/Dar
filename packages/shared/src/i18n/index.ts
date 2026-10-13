import { ar } from './ar';
import { en } from './en';

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<typeof ar>;
export type Locale = 'ar' | 'en';

export const dictionaries: Record<Locale, Dictionary> = { ar, en };
export const DEFAULT_LOCALE: Locale = 'ar';
export const isRTL = (locale: Locale) => locale === 'ar';

const COUNT_WORDS = {
  bedrooms: { ar: ['غرفة نوم', 'غرف نوم'], en: ['Bedroom', 'Bedrooms'] },
  bathrooms: { ar: ['حمام', 'حمامات'], en: ['Bathroom', 'Bathrooms'] },
  floors: { ar: ['طابق', 'طوابق'], en: ['Floor', 'Floors'] },
} as const;

/** "1 Bedroom" / "3 Bedrooms" · "1 غرفة نوم" / "3 غرف نوم" (Arabic uses the plural for 3–10, singular otherwise). */
export function countLabel(locale: Locale, n: number, kind: keyof typeof COUNT_WORDS): string {
  const [one, many] = COUNT_WORDS[kind][locale];
  const plural = locale === 'ar' ? n >= 2 && n <= 10 : n !== 1;
  return `${n} ${plural ? many : one}`;
}

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string ? never : { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
export type TKey = Paths<Dictionary>;

/** Looks up "section.key" and fills {placeholders}. Falls back to Arabic, then the key. */
export function translate(locale: Locale, key: TKey | string, vars?: Record<string, string | number>): string {
  const lookup = (dict: unknown): string | undefined => {
    let cur: any = dict;
    for (const part of key.split('.')) cur = cur?.[part];
    return typeof cur === 'string' ? cur : undefined;
  };
  const raw = lookup(dictionaries[locale]) ?? lookup(dictionaries.ar) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? `{${v}}`)) : raw;
}

/** Maps an API error code to a user-facing message. */
export function errorMessage(locale: Locale, code: string | undefined): string {
  const errors = dictionaries[locale].errors as Record<string, string>;
  return (code && errors[code]) || errors.GENERIC!;
}

export { ar, en };
