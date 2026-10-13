import { getLocale } from '@/lib/i18n';

/**
 * Inline bilingual label for staff screens: renders Arabic by default and English
 * when the dashboard language is switched. Keeps each page's wording next to its markup.
 */
export async function L({ ar, en }: { ar: string; en: string }) {
  return (await getLocale()) === 'en' ? en : ar;
}
