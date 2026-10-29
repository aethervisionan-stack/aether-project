"use client";

import { en, type Messages } from "@/locales/en";
import { es } from "@/locales/es";
import { pt } from "@/locales/pt";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "pt" | "es";

const STORAGE_KEY = "aether-lang";
const DICTS: Record<Locale, Messages> = { en, pt, es };
const HTML_LANG: Record<Locale, string> = { en: "en", pt: "pt-BR", es: "es" };

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "pt" || stored === "es") return stored;
  return "en";
}

type I18nContextValue = {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ locale, t: DICTS[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function interpolate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    template,
  );
}

export function translateError(
  messages: Messages,
  code: keyof Messages["errors"] | null,
  minSol?: number,
) {
  if (!code) return null;
  if (code === "min_sol" && minSol !== undefined) {
    return interpolate(messages.errors.min_sol, { min: String(minSol) });
  }
  return messages.errors[code];
}
