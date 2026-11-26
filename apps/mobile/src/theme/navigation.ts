import { type Palette, type Scheme, palettes } from './tokens';

/** The colours React Navigation (expo-router) paints behind and around screens, built from the app's palette. */
export interface NavigationColors {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
}

/**
 * The navigation theme's colours from a palette: the page background behind every screen, the card (tab bar, header) in
 * the surface colour, text, border, the brand colour as `primary` and the danger colour for badges. Without this React
 * Navigation uses its own light theme and flashes it while screens mount and fade.
 */
export function navigationColors(palette: Palette): NavigationColors {
  return {
    primary: palette.accent,
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
    notification: palette.danger,
  };
}

/** The same, by scheme. `dark` tells React Navigation which kind of theme this is. */
export const navigationTheme = (scheme: Scheme): { dark: boolean; colors: NavigationColors } => ({
  dark: scheme === 'dark',
  colors: navigationColors(palettes[scheme]),
});
