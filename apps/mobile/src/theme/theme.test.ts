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
