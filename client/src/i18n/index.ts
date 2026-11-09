/**
 * Compact HUD i18n: dictionaries + t()/msg() helpers + localStorage persistence.
 * Shares storage key with the marketing site LanguageSelector when same origin.
 */

import { en } from "./locales/en";
import { es } from "./locales/es";
import { pt } from "./locales/pt";
import type { HudMessages, Locale } from "./types";

export type { HudMessages, Locale } from "./types";

const STORAGE_KEY = "aether-lang";
const DICTS: Record<Locale, HudMessages> = { pt, en, es };
const HTML_LANG: Record<Locale, string> = { pt: "pt-BR", en: "en", es: "es" };

let current: Locale = "pt";
const listeners = new Set<(locale: Locale) => void>();

function isLocale(value: string | null | undefined): value is Locale {
  return value === "pt" || value === "en" || value === "es";
}

/** Prefer stored choice; else browser es/en; default Portuguese (BR). */
export function detectLocale(): Locale {
  if (typeof window === "undefined") return "pt";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("pt")) return "pt";
  return "pt";
}

export function getLocale(): Locale {
  return current;
}

export function msg(): HudMessages {
  return DICTS[current];
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number | null | undefined>,
): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value == null ? "" : String(value)),
    template,
  );
}

/** Translate via a leaf string already taken from msg(); optional `{var}` fill. */
export function t(
  template: string,
  vars?: Record<string, string | number | null | undefined>,
): string {
  return interpolate(template, vars);
}

export function setLocale(next: Locale): void {
  if (!isLocale(next) || next === current) {
    if (isLocale(next) && typeof document !== "undefined") {
      document.documentElement.lang = HTML_LANG[next];
    }
    return;
  }
  current = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = HTML_LANG[next];
  }
  for (const listener of listeners) {
    listener(next);
  }
}

export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call once at HUD boot before mount. */
export function initI18n(): Locale {
  current = detectLocale();
  if (typeof document !== "undefined") {
    document.documentElement.lang = HTML_LANG[current];
  }
  return current;
}
