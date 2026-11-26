import { PAID_TIERS, type PaidTier } from './pricing.ts';

// E-65: the plan cards are a single-choice group. Pure rules, so they are unit-tested; the picker only draws them.

export type PlanInterval = 'month' | 'year';
export interface PlanSelection {
  tier: PaidTier;
  interval: PlanInterval;
}

/** Pro is pre-selected and Annual is the default. "Most popular" is a label on Pro, not a selection. */
export const DEFAULT_SELECTION: PlanSelection = { tier: 'pro', interval: 'year' };

export const isPaidTier = (v: unknown): v is PaidTier => typeof v === 'string' && (PAID_TIERS as readonly string[]).includes(v);

/** Selecting a tier keeps the interval. An unknown tier changes nothing. */
export function selectTier(sel: PlanSelection, tier: unknown): PlanSelection {
  return isPaidTier(tier) && tier !== sel.tier ? { ...sel, tier } : sel;
}

/** Switching Monthly / Annual keeps the selected tier. */
export function selectInterval(sel: PlanSelection, interval: PlanInterval): PlanSelection {
  return interval !== sel.interval ? { ...sel, interval } : sel;
}

/** Exactly one tier is selected: true only for the selected one. */
export const isSelected = (sel: PlanSelection, tier: PaidTier): boolean => sel.tier === tier;

/** Arrow keys move the selection through the cards in order and wrap around. */
export function moveSelection(sel: PlanSelection, key: string, tiers: readonly PaidTier[] = PAID_TIERS): PlanSelection {
  const forward = key === 'ArrowRight' || key === 'ArrowDown';
  const back = key === 'ArrowLeft' || key === 'ArrowUp';
  if (!forward && !back) return sel;
  const i = tiers.indexOf(sel.tier);
  if (i < 0 || tiers.length === 0) return sel;
  const next = tiers[(i + (forward ? 1 : tiers.length - 1)) % tiers.length];
  return { ...sel, tier: next };
}
