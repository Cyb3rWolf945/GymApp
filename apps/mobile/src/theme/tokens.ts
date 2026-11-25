// Design tokens. Dark first; light is supported. Pure data: no React imports, so it is unit-testable.

export type Scheme = 'dark' | 'light';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  /** Text/icon colour on top of `accent`. */
  onAccent: string;
  danger: string;
  success: string;
  overlay: string;
}

export const palettes: Record<Scheme, Palette> = {
  dark: {
    background: '#0B0B0F',
    surface: '#16161D',
    surfaceAlt: '#1F1F29',
    border: '#2E2E3B',
    text: '#F5F5F7',
    muted: '#A1A1AE',
    accent: '#C6FF3D',
    onAccent: '#0B0B0F',
    danger: '#FF7A7A',
    success: '#4ADE80',
    overlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#F6F6F8',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEEF2',
    border: '#D4D4DC',
    text: '#0B0B0F',
    muted: '#585866',
    accent: '#4D7C0F',
    onAccent: '#FFFFFF',
    danger: '#B91C1C',
    success: '#15803D',
    overlay: 'rgba(0,0,0,0.4)',
  },
};

/** One-handed gym use: every tappable thing is at least this big (px). */
export const MIN_TAP_TARGET = 48;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
// ---- Responsive layout. Widths in px (CSS pixels on web, dp on devices). Phones stay `compact`.
export const BREAKPOINTS = { compact: 0, medium: 600, expanded: 1024 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

/** `compact` below 600, `medium` from 600 to 1023, `expanded` from 1024. Anything that is not a number is `compact`. */
export function breakpointFor(width: number): Breakpoint {
  if (!(width >= BREAKPOINTS.medium)) return 'compact';
  return width >= BREAKPOINTS.expanded ? 'expanded' : 'medium';
}

/** Widest the content gets: reading screens (about 720) and dashboards (about 1200). */
export const CONTENT_MAX_WIDTH = { reading: 720, dashboard: 1200 } as const;
export type ContentVariant = keyof typeof CONTENT_MAX_WIDTH;

/** Padding around screen content. `compact` is what every screen already uses, so phones look the same. */
export const SCREEN_PADDING: Record<Breakpoint, number> = { compact: spacing.xl, medium: spacing.xxl, expanded: spacing.xxxl };

/** Width of the side navigation (left rail) on `medium` and `expanded`. */
export const SIDE_NAV_WIDTH: Record<Exclude<Breakpoint, 'compact'>, number> = { medium: 176, expanded: 224 };

/** Columns of a `ResponsiveGrid` by breakpoint. */
export type GridColumns = Record<Breakpoint, number>;
export const DEFAULT_GRID_COLUMNS: GridColumns = { compact: 1, medium: 2, expanded: 3 };

export const columnsFor = (bp: Breakpoint, columns: Partial<GridColumns> = {}): number => {
  const n = { ...DEFAULT_GRID_COLUMNS, ...columns }[bp];
  return Math.max(1, Math.floor(n));
};

/** Width of one cell in a grid of `columns` with `gap` between them (px, never negative). */
export const cellWidth = (containerWidth: number, columns: number, gap: number): number =>
  Math.max(0, Math.floor((containerWidth - gap * (columns - 1)) / columns));

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;
export type TypographyVariant = keyof typeof typography;

export interface Theme {
  scheme: Scheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  minTapTarget: number;
}

export const createTheme = (scheme: Scheme): Theme => ({
  scheme,
  colors: palettes[scheme],
  spacing,
  radius,
  typography,
  minTapTarget: MIN_TAP_TARGET,
});

// ---- contrast (WCAG) ----
const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
