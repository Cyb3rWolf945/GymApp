import { type Copy, en } from './en';

export { glossary } from './en';
export type { Copy };

// i18n-ready: add a locale here (same shape as `en`) and `getCopy` picks it up. EN only for now.
export const locales = { en } as const;
export type Locale = keyof typeof locales;
export const DEFAULT_LOCALE: Locale = 'en';

/** Resolve copy for a locale tag like "en-GB"; falls back to English. */
export function getCopy(locale?: string): Copy {
  const lang = (locale ?? DEFAULT_LOCALE).toLowerCase().split(/[-_]/)[0];
  return (locales as Record<string, Copy>)[lang] ?? locales[DEFAULT_LOCALE];
}
