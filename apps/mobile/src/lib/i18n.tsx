import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DevSettings, I18nManager, Platform } from 'react-native';
import { DEFAULT_LOCALE, dictionaries, errorMessage, isRTL, translate, type Dictionary, type Locale, type TKey } from '@dar/shared';

const KEY = 'dar.locale';

/**
 * Arabic is the default. React Native applies RTL/LTR layout at startup, so
 * switching language stores the choice, sets the direction and reloads the JS
 * bundle once (Updates.reloadAsync in builds, DevSettings.reload in dev).
 */
export async function bootLocale(): Promise<Locale> {
  const stored = (await AsyncStorage.getItem(KEY)) as Locale | null;
  const locale: Locale = stored === 'en' || stored === 'ar' ? stored : DEFAULT_LOCALE;
  if (Platform.OS === 'web') {
    // react-native-web takes direction from the document; forceRTL is a no-op there,
    // so reloading would loop forever.
    applyWebDirection(locale);
    return locale;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== isRTL(locale)) {
    I18nManager.forceRTL(isRTL(locale));
    await reload();
  }
  return locale;
}

function applyWebDirection(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
}

async function reload() {
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

interface I18nValue {
  locale: Locale;
  rtl: boolean;
  dict: Dictionary;
  t: (key: TKey | string, vars?: Record<string, string | number>) => string;
  err: (code?: string) => string;
  setLocale: (l: Locale) => Promise<void>;
}

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  useEffect(() => setLocaleState(initial), [initial]);
  const setLocale = useCallback(async (l: Locale) => {
    await AsyncStorage.setItem(KEY, l);
    setLocaleState(l);
    if (Platform.OS === 'web') {
      applyWebDirection(l);
      return;
    }
    if (I18nManager.isRTL !== isRTL(l)) {
      I18nManager.forceRTL(isRTL(l));
      await reload();
    }
  }, []);
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      rtl: isRTL(locale),
      dict: dictionaries[locale],
      t: (key, vars) => translate(locale, key, vars),
      err: (code) => errorMessage(locale, code),
      setLocale,
    }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

/** Localized field picker for {ar, en} pairs. */
export function useLocalized() {
  const { locale } = useI18n();
  return (v: { ar: string; en: string | null } | null | undefined) => (v ? (locale === 'en' && v.en ? v.en : v.ar) : '');
}
