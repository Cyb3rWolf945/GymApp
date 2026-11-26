import { describe, expect, it } from 'vitest';
import { PAID_TIERS } from './pricing';
import { DEFAULT_SELECTION, isSelected, moveSelection, selectInterval, selectTier } from './planSelection';

describe('plan selection (E-65)', () => {
  it('Pro and Annual are the default', () => {
    expect(DEFAULT_SELECTION).toEqual({ tier: 'pro', interval: 'year' });
  });
  it('exactly one card is selected, never two', () => {
    for (const tier of PAID_TIERS) {
      const sel = selectTier(DEFAULT_SELECTION, tier);
      expect(PAID_TIERS.filter((t) => isSelected(sel, t))).toEqual([tier]);
    }
  });
  it('picking Basic or Elite un-selects Pro (Pro is only labelled "Most popular")', () => {
    expect(isSelected(selectTier(DEFAULT_SELECTION, 'basic'), 'pro')).toBe(false);
    expect(isSelected(selectTier(DEFAULT_SELECTION, 'elite'), 'pro')).toBe(false);
    expect(isSelected(selectTier(selectTier(DEFAULT_SELECTION, 'elite'), 'pro'), 'pro')).toBe(true);
  });
  it('the selection survives switching Monthly and Annual, both ways', () => {
    const elite = selectTier(DEFAULT_SELECTION, 'elite');
    const monthly = selectInterval(elite, 'month');
    expect(monthly).toEqual({ tier: 'elite', interval: 'month' });
    expect(selectInterval(monthly, 'year')).toEqual({ tier: 'elite', interval: 'year' });
    expect(selectTier(monthly, 'basic')).toEqual({ tier: 'basic', interval: 'month' }); // and the interval survives a new pick
  });
  it('an unknown tier or the same choice changes nothing', () => {
    expect(selectTier(DEFAULT_SELECTION, 'platinum')).toBe(DEFAULT_SELECTION);
    expect(selectTier(DEFAULT_SELECTION, undefined)).toBe(DEFAULT_SELECTION);
    expect(selectTier(DEFAULT_SELECTION, 'pro')).toBe(DEFAULT_SELECTION);
    expect(selectInterval(DEFAULT_SELECTION, 'year')).toBe(DEFAULT_SELECTION);
  });
  it('arrow keys move the selection in card order and wrap', () => {
    expect(moveSelection({ tier: 'basic', interval: 'year' }, 'ArrowRight').tier).toBe('pro');
    expect(moveSelection({ tier: 'pro', interval: 'year' }, 'ArrowDown').tier).toBe('elite');
    expect(moveSelection({ tier: 'elite', interval: 'year' }, 'ArrowRight').tier).toBe('basic');
    expect(moveSelection({ tier: 'basic', interval: 'year' }, 'ArrowLeft').tier).toBe('elite');
    expect(moveSelection({ tier: 'pro', interval: 'month' }, 'ArrowUp')).toEqual({ tier: 'basic', interval: 'month' });
  });
  it('other keys change nothing', () => {
    for (const key of ['Enter', ' ', 'Tab', 'a']) expect(moveSelection(DEFAULT_SELECTION, key)).toBe(DEFAULT_SELECTION);
  });
});
