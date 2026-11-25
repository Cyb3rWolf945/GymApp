import { describe, expect, it } from 'vitest';
import {
  BREAKPOINTS, CONTENT_MAX_WIDTH, DEFAULT_GRID_COLUMNS, MIN_TAP_TARGET, SCREEN_PADDING, SIDE_NAV_WIDTH, breakpointFor, cellWidth, columnsFor, spacing,
} from './tokens';

describe('breakpointFor', () => {
  it('maps the exact edges: 599 is compact, 600 medium, 1023 medium, 1024 expanded', () => {
    expect(breakpointFor(599)).toBe('compact');
    expect(breakpointFor(600)).toBe('medium');
    expect(breakpointFor(1023)).toBe('medium');
    expect(breakpointFor(1024)).toBe('expanded');
  });
  it('maps typical devices', () => {
    for (const [w, bp] of [[320, 'compact'], [390, 'compact'], [430, 'compact'], [768, 'medium'], [834, 'medium'], [1180, 'expanded'], [1440, 'expanded'], [2560, 'expanded']] as const) {
      expect(breakpointFor(w), String(w)).toBe(bp);
    }
  });
  it('treats zero, negative and non-numeric widths as compact', () => {
    for (const w of [0, -1, Number.NaN, Number.NEGATIVE_INFINITY]) expect(breakpointFor(w), String(w)).toBe('compact');
    expect(breakpointFor(Number.POSITIVE_INFINITY)).toBe('expanded');
  });
  it('uses the documented breakpoint tokens', () => {
    expect(BREAKPOINTS).toEqual({ compact: 0, medium: 600, expanded: 1024 });
  });
});

describe('content width and padding', () => {
  it('caps reading screens near 720 px and dashboards near 1200 px', () => {
    expect(CONTENT_MAX_WIDTH.reading).toBe(720);
    expect(CONTENT_MAX_WIDTH.dashboard).toBe(1200);
  });
  it('uses spacing tokens that grow with the breakpoint, and keeps the phone padding every screen already has', () => {
    expect(SCREEN_PADDING.compact).toBe(spacing.xl);
    expect(SCREEN_PADDING.compact).toBeLessThan(SCREEN_PADDING.medium);
    expect(SCREEN_PADDING.medium).toBeLessThan(SCREEN_PADDING.expanded);
    for (const p of Object.values(SCREEN_PADDING)) expect(Object.values(spacing)).toContain(p);
  });
  it('gives the side navigation room for its labels and tap targets', () => {
    expect(SIDE_NAV_WIDTH.medium).toBeGreaterThanOrEqual(MIN_TAP_TARGET * 3);
    expect(SIDE_NAV_WIDTH.expanded).toBeGreaterThanOrEqual(SIDE_NAV_WIDTH.medium);
    expect(SIDE_NAV_WIDTH.expanded).toBeLessThan(BREAKPOINTS.expanded / 3);
  });
});

describe('grid columns', () => {
  it('is 1 / 2 / 3 columns for compact / medium / expanded by default', () => {
    expect(DEFAULT_GRID_COLUMNS).toEqual({ compact: 1, medium: 2, expanded: 3 });
    expect(columnsFor('compact')).toBe(1);
    expect(columnsFor('medium')).toBe(2);
    expect(columnsFor('expanded')).toBe(3);
  });
  it('can be configured per breakpoint and never goes below one column', () => {
    expect(columnsFor('expanded', { expanded: 4 })).toBe(4);
    expect(columnsFor('medium', { expanded: 4 })).toBe(2);
    expect(columnsFor('compact', { compact: 0 })).toBe(1);
    expect(columnsFor('medium', { medium: -3 })).toBe(1);
    expect(columnsFor('medium', { medium: 2.9 })).toBe(2);
  });
  it('splits a container into equal cells with the gaps taken out', () => {
    expect(cellWidth(1000, 1, 16)).toBe(1000);
    expect(cellWidth(1000, 2, 16)).toBe(492); // (1000 - 16) / 2
    expect(cellWidth(1000, 3, 16)).toBe(322); // (1000 - 32) / 3, rounded down so the row never overflows
    expect(2 * cellWidth(1000, 2, 16) + 16).toBeLessThanOrEqual(1000);
    expect(3 * cellWidth(1000, 3, 16) + 2 * 16).toBeLessThanOrEqual(1000);
  });
  it('never returns a negative width', () => {
    expect(cellWidth(10, 3, 16)).toBe(0);
    expect(cellWidth(0, 2, 8)).toBe(0);
  });
});
