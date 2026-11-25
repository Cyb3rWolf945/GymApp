import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { type Scheme, type Theme, createTheme, palettes } from './tokens';

export * from './tokens';

/** Back-compat for code written before the design system: the dark palette. */
export const colors = palettes.dark;

const ThemeContext = createContext<Theme>(createTheme('dark'));

/** Dark is the default. Pass `scheme="light"` (or wire it to a setting) to switch. */
export function ThemeProvider({ scheme = 'dark', children }: { scheme?: Scheme; children: ReactNode }) {
  const theme = useMemo(() => createTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);
