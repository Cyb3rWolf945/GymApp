import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ThemePreference, DEFAULT_THEME_PREFERENCE, parseThemePreference, resolveScheme } from './preference';
import { type Scheme, type Theme, createTheme } from './tokens';

export * from './tokens';
export * from './preference';
export { useBreakpoint } from './useBreakpoint';

const ThemeContext = createContext<Theme>(createTheme('dark'));

/** A fixed scheme (tests, previews). The app itself uses `AppThemeProvider`, which follows the saved preference. */
export function ThemeProvider({ scheme = 'dark', children }: { scheme?: Scheme; children: ReactNode }) {
  const theme = useMemo(() => createTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

const STORAGE_KEY = 'fuelift.theme';
const PreferenceContext = createContext<{ preference: ThemePreference; setPreference: (p: ThemePreference) => void }>({
  preference: DEFAULT_THEME_PREFERENCE,
  setPreference: () => {},
});

/** System (default), Dark or Light. Saved on the device and applied at once; System follows the OS live. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((v) => setPreferenceState(parseThemePreference(v)), () => {});
  }, []);
  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme = resolveScheme(preference, system);
  const theme = useMemo(() => createTheme(scheme), [scheme]);
  // On the web the page itself (behind the app and during overscroll) and form controls follow the scheme too.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = theme.colors.background;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.dataset.scheme = scheme;
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
