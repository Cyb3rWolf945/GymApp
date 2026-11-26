// Design tokens. Dark first; light is supported. Pure data: no React imports, so it is unit-testable.

export type Scheme = 'dark' | 'light';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  /** Outlines of controls (inputs, chips, toggles): at least 3:1 against the page and the cards (WCAG 1.4.11). */
  border: string;
  /** Non-interactive separators (list rows, section rules): lighter than `border`. */
  divider: string;
  text: string;
  muted: string;
  /** The brand fill: buttons, selected fills, progress. Neon lime in both themes. Never used as text on a surface. */
  accent: string;
  /** Text/icon colour on top of `accent`. */
  onAccent: string;
  /** The brand colour as text, links and icons on a surface: the same lime in dark, a deep green in light (so it reads on white). */
  accentText: string;
  /** A tinted background for selected and hover states, with `accentBorder` as its outline. */
  accentSubtle: string;
  accentBorder: string;
  /** The soft halo under the main button: the brand colour, translucent. */
  accentGlow: string;
  /** Secondary accent (electric violet): charts, highlights and decoration next to the brand colour, never a second "primary". */
  accent2: string;
  /** Text/icon colour on top of `accent2`. */
  onAccent2: string;
  danger: string;
  onDanger: string;
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  info: string;
  onInfo: string;
  /** Keyboard focus outline: at least 3:1 against the page and the cards. */
  focusRing: string;
  overlay: string;
  /** Loading skeletons: the resting block and the highlight that sweeps over it. */
  skeleton: { base: string; highlight: string };
  /** Shadow colour, and its opacity per elevation level (cards and sheets). */
  shadow: { color: string; sm: number; md: number; lg: number };
  /** Five series colours for charts, each at least 3:1 on a card. The first is the brand. */
  chart: readonly [string, string, string, string, string];
  /** The body map ramp, from "not trained" to "very high volume". Ordered by brightness (so it reads in greyscale). */
  heat: readonly [string, string, string, string, string];
  /** Two-stop gradients (top-left to bottom-right unless noted). Decoration only: text never sits on a gradient edge. */
  gradient: {
    /** Progress fills and highlights: brand colour to mint. */
    brand: readonly [string, string];
    /** A raised card: a hair lighter at the top. */
    card: readonly [string, string];
    /** The glow behind a screen header (top to bottom): the secondary accent fading into the page. */
    glow: readonly [string, string];
  };
}

export const palettes: Record<Scheme, Palette> = {
  dark: {
    background: '#0A0B10',
    surface: '#14161D',
    surfaceAlt: '#1D202A',
    border: '#2A2E3C',
    divider: '#2A2E3C',
    text: '#F5F6FA',
    muted: '#A6AABC',
    accent: '#C6FF3D',
    onAccent: '#0A0B10',
    accentText: '#C6FF3D',
    accentSubtle: '#293221',
    accentBorder: '#C6FF3D',
    accentGlow: 'rgba(198,255,61,0.22)',
    accent2: '#9A8CFF',
    onAccent2: '#0A0B10',
    danger: '#FF7A7A',
    onDanger: '#0A0B10',
    success: '#4ADE80',
    onSuccess: '#0A0B10',
    warning: '#FFB74D',
    onWarning: '#0A0B10',
    info: '#7CB8FF',
    onInfo: '#0A0B10',
    focusRing: '#C6FF3D',
    overlay: 'rgba(0,0,0,0.6)',
    skeleton: { base: '#1D202A', highlight: '#2A2E3C' },
    shadow: { color: '#000000', sm: 0.3, md: 0.4, lg: 0.5 },
    chart: ['#C6FF3D', '#9A8CFF', '#5BE3B0', '#FFB74D', '#FF7A7A'],
    // The look the body map had before the tokens: the accent over the body tone at growing opacity, the top band hot orange.
    heat: ['#2B2E3B', '#75923B', '#92B93C', '#AFE03C', '#FF8A3D'],
    gradient: {
      brand: ['#C6FF3D', '#5BE3B0'],
      card: ['#1B1E28', '#14161D'],
      glow: ['rgba(154,140,255,0.22)', 'rgba(10,11,16,0)'],
    },
  },
  light: {
    background: '#E9ECF2',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F3F8',
    border: '#7B8195',
    divider: '#DCE0E9',
    text: '#0B0D14',
    muted: '#4F5468',
    accent: '#B8F230',
    onAccent: '#0B0D14',
    accentText: '#3F6212',
    accentSubtle: '#EEF9D0',
    accentBorder: '#5E8F0A',
    accentGlow: 'rgba(184,242,48,0.4)',
    accent2: '#5B45E8',
    onAccent2: '#FFFFFF',
    danger: '#B91C1C',
    onDanger: '#FFFFFF',
    success: '#166534',
    onSuccess: '#FFFFFF',
    warning: '#92400E',
    onWarning: '#FFFFFF',
    info: '#1D4ED8',
    onInfo: '#FFFFFF',
    focusRing: '#3F6212',
    overlay: 'rgba(0,0,0,0.4)',
    skeleton: { base: '#E3E7EF', highlight: '#F4F6FA' },
    shadow: { color: '#0B0D14', sm: 0.08, md: 0.12, lg: 0.18 },
    chart: ['#4D7C0F', '#5B45E8', '#0F766E', '#B45309', '#B91C1C'],
    heat: ['#DCE0E9', '#C9E586', '#A4D12F', '#5F9A14', '#C2410C'],
    gradient: {
      brand: ['#B8F230', '#5BE3B0'],
      card: ['#FFFFFF', '#F7F8FC'],
      glow: ['rgba(91,69,232,0.12)', 'rgba(233,236,242,0)'],
    },
  },
};

/**
 * Colours that are not the app's theme: the Fuelift mark and the sign-in providers' official marks. Fixed on purpose
 * (a logo does not change with the theme); this is the only place besides the palettes where colour literals live.
 */
export const brandAssets = {
  mark: { lime: '#C6FF3D', mint: '#5BE3B0', ink: '#0A0B10', violet: '#6D5BFF', white: '#FFFFFF' },
  google: { yellow: '#FFC107', red: '#FF3D00', green: '#4CAF50', blue: '#1976D2', border: '#8E918F', surface: '#131314', label: '#E3E3E3' },
  apple: { black: '#000000', white: '#FFFFFF' },
} as const;

/** One-handed gym use: every tappable thing is at least this big (px). */
export const MIN_TAP_TARGET = 48;

/**
 * Spacing on an 8-pt grid (4 is the half step for tight gaps, 12 the one in-between for list rows). Everything else is a
 * multiple of 8, so layouts line up on every screen.
 */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64 } as const;
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

/**
 * Motion. Every animation uses these, so the app moves as one thing. Pure data (easings are cubic-bezier points).
 * `slide` is how far a step travels while it enters; a whole step transition stays under about 300 ms.
 */
export const motion = {
  duration: { fast: 150, base: 250, slow: 400 },
  easing: {
    /** Default for things that move on screen. */
    standard: [0.2, 0, 0, 1],
    /** Things arriving: start fast, settle gently. */
    enter: [0, 0, 0, 1],
    /** Things leaving: speed up as they go. */
    exit: [0.3, 0, 1, 1],
  },
  /** Delay between a step's title, text and options entering (ms). */
  stagger: 40,
  /** A pressed button shrinks to this. */
  pressScale: 0.97,
  /** Press states use a spring (not a timed ease): quick, with a slight settle. Passed to `Animated.spring`. */
  spring: { stiffness: 420, damping: 24, mass: 0.9 },
  /** A pressed row (a list item) moves less than a button. */
  rowPressScale: 0.985,
  /** The "pop" a chosen chip or finished step makes. */
  popScale: 1.08,
  /** Horizontal travel of a step entering (px). */
  slide: 24,
} as const;
export type MotionDuration = keyof typeof motion.duration;
export type MotionEasing = keyof typeof motion.easing;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/**
 * Elevation: how far a surface floats above the page. A soft shadow (`boxShadow`, the same on web and phones) instead of
 * a hard border alone. Light mode uses lighter shadows. `none` is flat.
 */
export type Elevation = 'none' | 'low' | 'mid' | 'high';
export const elevations: Record<Scheme, Record<Elevation, { boxShadow?: string }>> = {
  dark: {
    none: {},
    low: { boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)' },
    mid: { boxShadow: '0 2px 4px rgba(0,0,0,0.4), 0 10px 24px rgba(0,0,0,0.35)' },
    high: { boxShadow: '0 4px 8px rgba(0,0,0,0.45), 0 20px 48px rgba(0,0,0,0.5)' },
  },
  light: {
    none: {},
    low: { boxShadow: '0 1px 2px rgba(11,13,20,0.08), 0 4px 12px rgba(11,13,20,0.08)' },
    mid: { boxShadow: '0 2px 4px rgba(11,13,20,0.1), 0 10px 24px rgba(11,13,20,0.12)' },
    high: { boxShadow: '0 4px 8px rgba(11,13,20,0.12), 0 20px 48px rgba(11,13,20,0.18)' },
  },
};

/**
 * Two typefaces. Space Grotesk has the character (display, titles, headings: numbers look great in it); Inter does the
 * reading (body, buttons, captions). One file per weight: custom fonts on phones need a family name per weight, so there
 * is no `fontWeight` here. They are loaded once at the root (`app/_layout.tsx`).
 */
export const fonts = {
  displayBold: 'SpaceGrotesk_700Bold',
  displaySemiBold: 'SpaceGrotesk_600SemiBold',
  uiRegular: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemiBold: 'Inter_600SemiBold',
} as const;

/** The type scale (px): 12, 14, 16, 20, 24, 34. Line heights sit on a 4-pt grid. */
export const typography = {
  display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.displaySemiBold, fontSize: 20, lineHeight: 28, letterSpacing: -0.1 },
  body: { fontFamily: fonts.uiRegular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.uiSemiBold, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.uiRegular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.uiMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
} as const;
export type TypographyVariant = keyof typeof typography;

export interface Theme {
  scheme: Scheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  /** Shadows for this scheme, by elevation level. */
  elevation: Record<Elevation, { boxShadow?: string }>;
  minTapTarget: number;
}

export const createTheme = (scheme: Scheme): Theme => ({
  scheme,
  colors: palettes[scheme],
  spacing,
  radius,
  typography,
  elevation: elevations[scheme],
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

/**
 * A colour between `a` and `b` (`t` 0 = a, 1 = b), for hover and selected tints. Reads `#rrggbb` and `rgba(r,g,b,a)`; anything
 * else returns `a` unchanged. Pure, so it is unit-tested.
 */
export function mixColors(a: string, b: string, t: number): string {
  const parse = (c: string): [number, number, number] | null => {
    const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)];
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c.trim());
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return a;
  const k = Math.min(1, Math.max(0, t));
  const m = (i: number) => Math.round(x[i] + (y[i] - x[i]) * k).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}
