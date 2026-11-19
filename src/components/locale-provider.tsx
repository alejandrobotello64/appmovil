"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { chromeLabel } from "@/lib/i18n/chrome";
import {
  isLocale,
  LOCALE_STORAGE_KEY,
  translate,
  type Locale,
} from "@/lib/i18n/messages";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
  /** Traduce chrome UI partiendo del texto en español del código. */
  c: (esText: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dataset.locale = locale;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    const initial = isLocale(stored) ? stored : "es";
    setLocaleState(initial);
    applyLocale(initial);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    applyLocale(next);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => translate(locale, key, fallback),
    [locale]
  );

  const c = useCallback((esText: string) => chromeLabel(locale, esText), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, c }),
    [locale, setLocale, t, c]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}

export const localeInitScript = `(function(){try{var l=localStorage.getItem('${LOCALE_STORAGE_KEY}');if(l!=='es'&&l!=='en')l='es';var r=document.documentElement;r.lang=l;r.dataset.locale=l}catch(e){}})();`;
