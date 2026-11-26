import { describe, expect, it } from 'vitest';
import { PAID_TIERS } from '@gymapp/shared';
import { en } from '../copy/en';

const rows = en.paywall.compare.rows;
const has = (v: boolean | string) => v !== false;

describe('the plan comparison table', () => {
  it('has a row per feature, each named once', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length);
  });
  it('never gives a higher plan less than a lower one', () => {
    for (const r of rows) {
      expect(has(r.pro) || !has(r.basic), `${r.label}: Pro has what Basic has`).toBe(true);
      expect(has(r.elite) || !has(r.pro), `${r.label}: Elite has what Pro has`).toBe(true);
    }
  });
  it('covers the tiers the paywall sells, and every plan has a name', () => {
    for (const tier of PAID_TIERS) expect(en.paywall.plans[tier].name.length).toBeGreaterThan(0);
    for (const r of rows) for (const tier of PAID_TIERS) expect(r[tier], `${r.label} / ${tier}`).not.toBeUndefined();
  });
  it("lists the paid-only features the plan cards promise, so the two never disagree", () => {
    const labels = rows.map((r) => r.label.toLowerCase());
    for (const f of ['meal plan and recipes', 'shopping list', 'weekly auto-adjustments']) expect(labels).toContain(f);
    expect(en.paywall.plans.pro.features.join(' ').toLowerCase()).toContain('meal plan');
    expect(en.paywall.plans.elite.features.join(' ').toLowerCase()).toContain('weekly auto-adjustments');
  });
});
