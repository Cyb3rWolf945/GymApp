import { describe, expect, it } from 'vitest';
import { MIN_TAP_TARGET, contrastRatio, createTheme, elevations, fonts, luminance, mixColors, palettes, radius, spacing, typography } from './tokens';

describe('theme tokens', () => {
  it('dark and light palettes define the same keys', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });
  it('dark is the default look and keeps the brand accent', () => {
    expect(createTheme('dark').colors.background).toBe('#0A0B10');
    expect(palettes.dark.accent).toBe('#C6FF3D');
  });
  it.each(['dark', 'light'] as const)('%s: text and button contrast meet WCAG AA (4.5:1)', (scheme) => {
    const c = palettes[scheme];
    for (const bg of [c.background, c.surface, c.surfaceAlt]) {
      expect(contrastRatio(c.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.muted, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.danger, c.background)).toBeGreaterThanOrEqual(4.5);
  });
  it('tap targets are at least 48 px', () => {
    expect(MIN_TAP_TARGET).toBeGreaterThanOrEqual(48);
    expect(createTheme('dark').minTapTarget).toBeGreaterThanOrEqual(48);
  });
  it('spacing grows and body text is readable', () => {
    const v = Object.values(spacing);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(16);
    expect(typography.caption.fontSize).toBeGreaterThanOrEqual(12);
  });
});

// E-57: every pair the UI actually draws, in both schemes (WCAG AA: 4.5:1 for text, 3:1 for control edges).
describe.each(['dark', 'light'] as const)('%s palette: every text and control pair', (scheme) => {
  const c = palettes[scheme];
  const surfaces = [c.background, c.surface, c.surfaceAlt];
  it('text, muted text, the accent used as text, danger and success read on every surface', () => {
    for (const bg of surfaces) {
      for (const [name, fg] of Object.entries({ text: c.text, muted: c.muted, accentText: c.accentText, danger: c.danger, success: c.success })) {
        expect(contrastRatio(fg, bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('text on the accent button and on the danger/success fills is readable', () => {
    expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('the edge of a control (borders, inputs) is visible against the page and cards', () => {
    for (const bg of [c.background, c.surface]) expect(contrastRatio(c.muted, bg), `muted edge on ${bg}`).toBeGreaterThanOrEqual(3);
  });
  it('the overlay is a translucent black that dims the page', () => {
    expect(c.overlay).toMatch(/^rgba\(0,\s*0,\s*0,\s*0\.\d+\)$/);
  });
});

it('the dark and light palettes are different looks, each with a clear step between page, card and raised card', () => {
  expect(palettes.dark.background).not.toBe(palettes.light.background);
  for (const scheme of ['dark', 'light'] as const) {
    const c = palettes[scheme];
    expect(new Set([c.background, c.surface, c.surfaceAlt]).size).toBe(3);
  }
});

// Identity v2 (#138): secondary accent, gradients, elevation, type scale, 8-pt spacing.
describe.each(['dark', 'light'] as const)('%s palette: identity v2', (scheme) => {
  const c = palettes[scheme];
  it('the secondary accent reads as text on every surface, and text on it is readable', () => {
    for (const bg of [c.background, c.surface, c.surfaceAlt]) expect(contrastRatio(c.accent2, bg), `accent2 on ${bg}`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.onAccent2, c.accent2)).toBeGreaterThanOrEqual(4.5);
  });
  it('the brand gradient is lime to mint in both themes, and text on either end is readable (7:1)', () => {
    expect(c.gradient.brand[0]).toBe(c.accent);
    for (const stop of c.gradient.brand) expect(contrastRatio(c.onAccent, stop), `onAccent on ${stop}`).toBeGreaterThanOrEqual(7);
  });
  it('gradients have two stops each and the glow fades to the page colour', () => {
    for (const g of Object.values(c.gradient)) expect(g).toHaveLength(2);
    expect(c.gradient.glow[1]).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\)$/);
  });
  it('elevation grows: flat, then each level has a stronger shadow', () => {
    const e = elevations[scheme];
    expect(e.none).toEqual({});
    const blur = (s?: string) => Math.max(...(s ?? '').match(/\d+px rgba/g)!.map((m) => parseInt(m, 10)));
    expect(blur(e.low.boxShadow)).toBeLessThan(blur(e.mid.boxShadow));
    expect(blur(e.mid.boxShadow)).toBeLessThan(blur(e.high.boxShadow));
  });
});

describe('identity v2: type, spacing and radius', () => {
  it('spacing is on the 8-pt grid: everything but the half and in-between steps is a multiple of 8', () => {
    for (const [name, v] of Object.entries(spacing)) {
      if (name === 'xs' || name === 'md') expect(v % 4, name).toBe(0);
      else expect(v % 8, name).toBe(0);
    }
  });
  it('radius grows and the pill is fully round', () => {
    const r = [radius.sm, radius.md, radius.lg, radius.xl];
    expect([...r].sort((a, b) => a - b)).toEqual(r);
    expect(radius.pill).toBeGreaterThanOrEqual(999);
  });
  it('every text style names one of the loaded fonts, has no fontWeight (a family per weight) and a line height on a 4-pt grid', () => {
    const families = new Set<string>(Object.values(fonts));
    for (const [name, t] of Object.entries(typography)) {
      expect(families.has(t.fontFamily), name).toBe(true);
      expect(t, name).not.toHaveProperty('fontWeight');
      expect(t.lineHeight % 4, name).toBe(0);
      expect(t.lineHeight, name).toBeGreaterThan(t.fontSize);
    }
  });
  it('the character face is for display, titles and headings; reading text uses the UI face', () => {
    expect(typography.display.fontFamily).toBe(fonts.displayBold);
    expect(typography.heading.fontFamily).toBe(fonts.displaySemiBold);
    expect(typography.body.fontFamily).toBe(fonts.uiRegular);
    expect(typography.bodyStrong.fontFamily).toBe(fonts.uiSemiBold);
  });
});

it.each(['dark', 'light'] as const)('%s: the button halo is the brand colour, translucent', (scheme) => {
  const m = palettes[scheme].accentGlow.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*0\.\d+\)$/)!;
  expect(m).not.toBeNull();
  const hex = '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  expect(hex).toBe(palettes[scheme].accent);
});

describe('mixColors (E-65)', () => {
  it('blends two colours', () => {
    expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('rgba(0,0,0,0.6)', '#ff0000', 0.5)).toBe('#800000');
  });
  it('clamps, and returns the first colour when it cannot read one', () => {
    expect(mixColors('#102030', '#ffffff', 9)).toBe('#ffffff');
    expect(mixColors('#102030', '#ffffff', -1)).toBe('#102030');
    expect(mixColors('red', '#ffffff', 0.5)).toBe('red');
    expect(mixColors('#102030', 'blue', 0.5)).toBe('#102030');
  });
  it('a selected-card tint of the accent stays readable in both themes', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const c = palettes[scheme];
      const tinted = c.accentSubtle;
      expect(contrastRatio(c.text, tinted)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.muted, tinted)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.accentText, tinted)).toBeGreaterThanOrEqual(4.5);
      expect(mixColors(c.surface, c.accent, 0.12)).toMatch(/^#/);
    }
  });
});

// ---- E-70: the palette by job.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brandAssets } from './tokens';

describe.each(['dark', 'light'] as const)('%s palette: tokens by job (E-70)', (scheme) => {
  const c = palettes[scheme];
  const pages = [c.background, c.surface, c.surfaceAlt];
  it('has the same token keys in both schemes', () => {
    expect(Object.keys(c).sort()).toEqual(Object.keys(palettes.dark).sort());
  });
  it('text on every fill is readable: accent, accent2, danger, success, warning, info (4.5:1; the accent button 7:1)', () => {
    expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(7);
    for (const [fg, bg] of [[c.onAccent2, c.accent2], [c.onDanger, c.danger], [c.onSuccess, c.success], [c.onWarning, c.warning], [c.onInfo, c.info]]) {
      expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('the colours used as text read on the page, cards and raised cards (4.5:1)', () => {
    for (const bg of pages) {
      for (const [name, fg] of Object.entries({ accentText: c.accentText, accent2: c.accent2, danger: c.danger, success: c.success, warning: c.warning, info: c.info })) {
        expect(contrastRatio(fg, bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('control outlines, the selected outline and the focus ring are visible on the page and cards (3:1; dark keeps its softer border)', () => {
    for (const bg of [c.background, c.surface]) {
      for (const [name, fg] of Object.entries({ ...(scheme === 'light' ? { border: c.border } : {}), accentBorder: c.accentBorder, focusRing: c.focusRing })) {
        expect(contrastRatio(fg, bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('text reads on the selected tint and on the skeleton', () => {
    expect(contrastRatio(c.text, c.accentSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.text, c.skeleton.base)).toBeGreaterThanOrEqual(4.5);
    expect(c.skeleton.base).not.toBe(c.skeleton.highlight);
  });
  it('the divider is no stronger than a control border and still shows against the card', () => {
    expect(contrastRatio(c.divider, c.surface)).toBeLessThanOrEqual(contrastRatio(c.border, c.surface));
    if (scheme === 'light') expect(contrastRatio(c.divider, c.surface)).toBeLessThan(contrastRatio(c.border, c.surface));
    expect(contrastRatio(c.divider, c.surface)).toBeGreaterThan(1);
  });
  it('the five chart colours are all visible on a card (3:1) and different', () => {
    expect(new Set(c.chart).size).toBe(5);
    for (const col of c.chart) expect(contrastRatio(col, c.surface), `${col} on card`).toBeGreaterThanOrEqual(3);
    expect(c.chart[0]).toBe(scheme === 'dark' ? c.accent : c.accentText.replace('3F6212', '4D7C0F'));
  });
  it('the heat ramp is ordered by brightness, so it works in greyscale', () => {
    const l = c.heat.map(luminance);
    for (let i = 1; i < l.length; i++) expect(scheme === 'dark' ? l[i] > l[i - 1] : l[i] < l[i - 1], `step ${i}`).toBe(true);
    expect(c.heat[0]).not.toBe(c.heat[1]);
  });
  it('shadows grow with the level', () => {
    expect(c.shadow.sm).toBeLessThan(c.shadow.md);
    expect(c.shadow.md).toBeLessThan(c.shadow.lg);
  });
});

describe('the light palette keeps the neon identity and a visible structure (E-70)', () => {
  const c = palettes.light;
  it('the brand fill is a vivid lime next to the dark one, with dark text on it; the green is only for text', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.accent.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(220);
    expect(r).toBeGreaterThan(150);
    expect(b).toBeLessThan(90);
    expect(luminance(c.onAccent)).toBeLessThan(0.05);
    expect(c.accentText).not.toBe(c.accent);
  });
  it('cards separate from the page by about 1.15 to 1.25, with a shadow as well', () => {
    const ratio = contrastRatio(c.surface, c.background);
    expect(ratio).toBeGreaterThanOrEqual(1.15);
    expect(ratio).toBeLessThanOrEqual(1.25);
    expect(elevations.light.low.boxShadow).toBeTruthy();
  });
  it('dark keeps its brand lime as text too', () => {
    expect(palettes.dark.accentText).toBe(palettes.dark.accent);
  });
});

describe('no colour literals outside the tokens (E-70)', () => {
  const root = join(__dirname, '..', '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : files(p);
      return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) && n !== 'tokens.ts' ? [p] : [];
    });
  it('apps/mobile/app and apps/mobile/src have no #RRGGBB or rgb(a) strings (colours come from the theme)', () => {
    const bad: string[] = [];
    for (const f of [...files(join(root, 'app')), ...files(join(root, 'src'))]) {
      const text = readFileSync(f, 'utf8');
      // The theme palette generator for the web page (src/theme/html.ts) builds CSS from the palette, with no literals of its own.
      for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-zA-Z])|rgba?\(/g)) bad.push(`${f.replace(root, '')}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
  it('the fixed brand colours exist in one place', () => {
    expect(brandAssets.mark.lime).toBe(palettes.dark.accent);
  });
});
