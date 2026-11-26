import type { Scheme } from './tokens';

// E-57: Appearance. The person picks System (default), Dark or Light. Pure rules, so they are unit-tested.

export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export const isThemePreference = (v: unknown): v is ThemePreference => typeof v === 'string' && (THEME_PREFERENCES as readonly string[]).includes(v);
/** Anything unknown (nothing saved, a bad value) is the default: System. */
export const parseThemePreference = (v: unknown): ThemePreference => (isThemePreference(v) ? v : DEFAULT_THEME_PREFERENCE);

/** The scheme to draw. System follows the OS; when the OS says nothing (null), the app's own look: dark. */
export function resolveScheme(preference: ThemePreference, system: string | null | undefined): Scheme {
  if (preference === 'dark' || preference === 'light') return preference;
  return system === 'light' ? 'light' : 'dark';
}

/** Where the choice is saved on the device (localStorage on the web: the page reads it before React starts). */
export const THEME_STORAGE_KEY = 'fuelift.theme';
