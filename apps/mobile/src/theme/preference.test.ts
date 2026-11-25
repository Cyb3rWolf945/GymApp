import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_PREFERENCE, THEME_PREFERENCES, parseThemePreference, resolveScheme } from './preference';

describe('appearance preference', () => {
  it('has System, Dark and Light, and System is the default', () => {
    expect([...THEME_PREFERENCES]).toEqual(['system', 'dark', 'light']);
    expect(DEFAULT_THEME_PREFERENCE).toBe('system');
  });
  it('anything unknown means System', () => {
    for (const v of [undefined, null, '', 'auto', 'DARK', 3, {}]) expect(parseThemePreference(v)).toBe('system');
    for (const p of THEME_PREFERENCES) expect(parseThemePreference(p)).toBe(p);
  });
  it('Dark and Light ignore the OS', () => {
    for (const os of ['light', 'dark', null, undefined]) {
      expect(resolveScheme('dark', os)).toBe('dark');
      expect(resolveScheme('light', os)).toBe('light');
    }
  });
  it('System follows the OS, and is dark when the OS says nothing', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', undefined)).toBe('dark');
    expect(resolveScheme('system', 'unspecified')).toBe('dark');
  });
});
