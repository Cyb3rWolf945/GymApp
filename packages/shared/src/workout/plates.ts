import { kgToLb, lbToKg } from '../calc/index.ts';

// E-56: plate calculator and warm-up sets. Pure functions; the logger and Settings only show what these return.
// Weights are in the unit given (kg or lb). The app stores kg: convert at the edges with `toUnit` / `fromUnit`.

export type PlateUnit = 'kg' | 'lb';

export const DEFAULT_BAR: Record<PlateUnit, number> = { kg: 20, lb: 45 };
/** Plates a gym usually has, heaviest first. */
export const DEFAULT_PLATES: Record<PlateUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};
/** Choices offered in Settings. */
export const PLATE_CHOICES: Record<PlateUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5],
  lb: [55, 45, 35, 25, 10, 5, 2.5, 1.25],
};
export const BAR_RANGE: Record<PlateUnit, { min: number; max: number }> = { kg: { min: 5, max: 30 }, lb: { min: 10, max: 70 } };

export interface PlateConfig {
  unit: PlateUnit;
  /** Weight of the empty bar. */
  bar: number;
  /** Plate sizes the gym has (any order; duplicates and bad values are ignored). Each size is available in any number. */
  plates: readonly number[];
}

export const defaultPlateConfig = (unit: PlateUnit): PlateConfig => ({ unit, bar: DEFAULT_BAR[unit], plates: DEFAULT_PLATES[unit] });

/** Checks stored settings: unknown or silly values go back to the defaults. */
export function normalizePlateConfig(raw: Partial<PlateConfig> | null | undefined, unit: PlateUnit): PlateConfig {
  const d = defaultPlateConfig(unit);
  const r = BAR_RANGE[unit];
  const bar = typeof raw?.bar === 'number' && Number.isFinite(raw.bar) && raw.bar >= r.min && raw.bar <= r.max ? raw.bar : d.bar;
  const plates = [...new Set((raw?.plates ?? []).filter((p) => typeof p === 'number' && Number.isFinite(p) && p > 0 && p <= 100))].sort((a, b) => b - a);
  return { unit, bar, plates: plates.length > 0 ? plates : d.plates };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const toUnit = (kg: number, unit: PlateUnit): number => round2(unit === 'lb' ? kgToLb(kg) : kg);
export const fromUnit = (weight: number, unit: PlateUnit): number => round2(unit === 'lb' ? lbToKg(weight) : weight);

// Plates are matched on hundredths so 1.25 and 2.5 never drift.
const cents = (n: number) => Math.round(n * 100);

/** Fewest plates (per side) that make exactly `side` (hundredths), or null. Plate sizes in hundredths. */
function fewestPlates(side: number, sizes: readonly number[]): number[] | null {
  if (side === 0) return [];
  const best: (number | undefined)[] = new Array(side + 1).fill(undefined);
  const last: number[] = new Array(side + 1).fill(0);
  best[0] = 0;
  for (let w = 1; w <= side; w += 1) {
    for (const s of sizes) {
      if (s > w) continue;
      const prev = best[w - s];
      if (prev === undefined) continue;
      // Ties go to the heavier plate (sizes are sorted heaviest first, and `<` keeps the first found).
      if (best[w] === undefined || prev + 1 < best[w]!) {
        best[w] = prev + 1;
        last[w] = s;
      }
    }
  }
  if (best[side] === undefined) return null;
  const out: number[] = [];
  for (let w = side; w > 0; w -= last[w]) out.push(last[w]);
  return out;
}

export interface PlateStack {
  plate: number;
  count: number;
}

export type PlateResult =
  | { ok: true; weight: number; perSide: PlateStack[]; barOnly: boolean }
  | { ok: false; reason: 'invalid' | 'below_bar' | 'not_loadable'; /** Closest weights the bar can make, if any. */ nearest: { lower: number | null; higher: number | null } };

/** Plates per side for a total weight on the bar. Impossible weights say why and what is close. */
export function platesPerSide(weight: number, cfg: PlateConfig): PlateResult {
  const sizes = [...new Set(cfg.plates.filter((p) => p > 0).map(cents))].sort((a, b) => b - a);
  const none = { lower: null, higher: null };
  if (!Number.isFinite(weight) || weight <= 0 || !(cfg.bar > 0) || sizes.length === 0) return { ok: false, reason: 'invalid', nearest: none };
  if (cents(weight) < cents(cfg.bar)) return { ok: false, reason: 'below_bar', nearest: { lower: null, higher: round2(cfg.bar) } };
  const side = (cents(weight) - cents(cfg.bar)) / 2;
  if (Number.isInteger(side)) {
    const stack = fewestPlates(side, sizes);
    if (stack) {
      const counts = new Map<number, number>();
      for (const s of stack) counts.set(s, (counts.get(s) ?? 0) + 1);
      return { ok: true, weight: round2(weight), barOnly: stack.length === 0, perSide: [...counts].sort((a, b) => b[0] - a[0]).map(([s, n]) => ({ plate: s / 100, count: n })) };
    }
  }
  return { ok: false, reason: 'not_loadable', nearest: nearestLoadable(weight, cfg) };
}

/** The loadable totals just below and above `weight` (the bar alone counts). */
export function nearestLoadable(weight: number, cfg: PlateConfig): { lower: number | null; higher: number | null } {
  const smallest = Math.min(...cfg.plates.filter((p) => p > 0).map(cents));
  if (!Number.isFinite(smallest) || !Number.isFinite(weight)) return { lower: null, higher: null };
  const step = smallest * 2; // the smallest change in total weight, in hundredths
  const base = cents(cfg.bar);
  const k = (cents(weight) - base) / step;
  const total = (n: number) => round2((base + n * step) / 100);
  const loadable = (n: number) => n >= 0 && platesPerSide(total(n), cfg).ok;
  let lo = Math.floor(k);
  let hi = Math.ceil(k);
  while (lo >= 0 && !loadable(lo)) lo -= 1;
  for (let i = 0; i < 2000 && !loadable(hi); i += 1) hi += 1;
  return { lower: lo >= 0 ? total(lo) : null, higher: loadable(hi) ? total(hi) : null };
}

/** Rounds a target to the closest loadable total (never below the bar). Ties go down. */
export function roundToLoadable(weight: number, cfg: PlateConfig): number {
  if (!Number.isFinite(weight) || weight <= cfg.bar) return cfg.bar;
  if (platesPerSide(weight, cfg).ok) return round2(weight);
  const { lower, higher } = nearestLoadable(weight, cfg);
  if (lower === null) return higher ?? cfg.bar;
  if (higher === null) return lower;
  return weight - lower <= higher - weight ? lower : higher;
}

// ---- Warm-up sets

/** Barbell compound lifts that get warm-up suggestions (slugs of the exercise catalog). */
export const BARBELL_COMPOUNDS: ReadonlySet<string> = new Set([
  'barbell-back-squat', 'barbell-front-squat', 'barbell-bench-press', 'incline-barbell-bench-press', 'close-grip-bench-press',
  'conventional-deadlift', 'sumo-deadlift', 'barbell-romanian-deadlift', 'standing-barbell-overhead-press', 'barbell-bent-over-row',
  'barbell-hip-thrust',
]);

/** The first barbell compound lift of the workout (by plan order), or null. */
export function firstBarbellCompound(slugs: readonly string[]): string | null {
  return slugs.find((s) => BARBELL_COMPOUNDS.has(s)) ?? null;
}

/** Warm-up steps: the empty bar, then percentages of the working weight. */
export const WARMUP_STEPS: readonly { pct: number; reps: number }[] = [
  { pct: 0, reps: 10 }, // the empty bar
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 2 },
];

export interface WarmupSet {
  /** Weight in the person's unit (loadable). */
  weight: number;
  /** The same in kg, as it is stored. */
  weightKg: number;
  reps: number;
}

/**
 * Warm-up sets for a first working weight (kg): bar × 10, 40% × 5, 60% × 3, 80% × 2, each rounded to a loadable weight.
 * Steps that land on the bar or on the same weight as the step before, or reach the working weight, are dropped.
 * No sets when the working weight is the bar or less, or is not a usable number.
 */
export function warmupSets(workingKg: number, cfg: PlateConfig): WarmupSet[] {
  if (!Number.isFinite(workingKg) || workingKg <= 0) return [];
  const working = toUnit(workingKg, cfg.unit);
  if (working <= cfg.bar) return [];
  const out: WarmupSet[] = [];
  for (const step of WARMUP_STEPS) {
    const w = step.pct === 0 ? cfg.bar : roundToLoadable(working * step.pct, cfg);
    if (w >= working) continue;
    if (out.length > 0 && w <= out[out.length - 1].weight) continue;
    out.push({ weight: w, weightKg: fromUnit(w, cfg.unit), reps: step.reps });
  }
  return out;
}
