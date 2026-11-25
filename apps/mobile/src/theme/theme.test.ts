import { describe, expect, it } from 'vitest';
import { MIN_TAP_TARGET, contrastRatio, createTheme, palettes, spacing, typography } from './tokens';

describe('theme tokens', () => {
  it('dark and light palettes define the same keys', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });
  it('dark is the default look and keeps the brand accent', () => {
    expect(createTheme('dark').colors.background).toBe('#0B0B0F');
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
      for (const [name, fg] of Object.entries({ text: c.text, muted: c.muted, accent: c.accent, danger: c.danger, success: c.success })) {
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
