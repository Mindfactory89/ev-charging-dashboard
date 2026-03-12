import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  detectInitialLocale,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  formatNumber,
  formatWeekdayLabel,
  normalizeLocale,
  persistLocale,
  setActiveLocale,
  translate,
} from "./runtime.js";

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  supportedLocales: SUPPORTED_LOCALES,
  t: (key) => key,
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => detectInitialLocale());

  const setLocale = useCallback((nextLocale) => {
    const normalized = normalizeLocale(nextLocale) || DEFAULT_LOCALE;
    setActiveLocale(normalized);
    persistLocale(normalized);
    setLocaleState(normalized);
  }, []);

  setActiveLocale(locale);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      supportedLocales: SUPPORTED_LOCALES,
      t: (key, values) => translate(locale, key, values),
      formatNumber: (value, options) => formatNumber(value, options, locale),
      formatCurrency: (value, options) => formatCurrency(value, options, locale),
      formatDate: (value, options) => formatDate(value, options, locale),
      formatMonthLabel: (value) => formatMonthLabel(value, locale),
      formatWeekdayLabel: (value) => formatWeekdayLabel(value, locale),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
