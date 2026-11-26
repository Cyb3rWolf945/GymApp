import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { type ThemePreference, DEFAULT_THEME_PREFERENCE, THEME_STORAGE_KEY, parseThemePreference, resolveScheme } from './preference';
import { type Scheme, type Theme, createTheme } from './tokens';

export * from './tokens';
export * from './preference';
export * from './navigation';
export { useBreakpoint } from './useBreakpoint';

const ThemeContext = createContext<Theme>(createTheme('dark'));

/** A fixed scheme (tests, previews). The app itself uses `AppThemeProvider`, which follows the saved preference. */
export function ThemeProvider({ scheme = 'dark', children }: { scheme?: Scheme; children: ReactNode }) {
  const theme = useMemo(() => createTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

const PreferenceContext = createContext<{ preference: ThemePreference; setPreference: (p: ThemePreference) => void }>({
  preference: DEFAULT_THEME_PREFERENCE,
  setPreference: () => {},
});

/** System (default), Dark or Light. Saved on the device and applied at once; System follows the OS live. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((v) => setPreferenceState(parseThemePreference(v)), () => {});
  }, []);
  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme = resolveScheme(preference, system);
  const theme = useMemo(() => createTheme(scheme), [scheme]);
  // The page itself (behind the app, during fades and overscroll) and the root view follow the scheme too, so no screen
  // change ever reveals a colour other than the theme background.
  useEffect(() => {
    const bg = theme.colors.background;
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      for (const el of [document.documentElement, document.body, document.getElementById('root')]) if (el) el.style.backgroundColor = bg;
      document.documentElement.style.colorScheme = scheme;
      document.documentElement.dataset.scheme = scheme;
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
    } else {
      // Android and iOS: the window behind the root view, which transitions would otherwise show in white.
      void SystemUI.setBackgroundColorAsync(bg).catch(() => {});
    }
  }, [theme, scheme]);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return (
    <PreferenceContext.Provider value={value}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </PreferenceContext.Provider>
  );
}

export const useTheme = (): Theme => useContext(ThemeContext);
export const useThemePreference = () => useContext(PreferenceContext);
