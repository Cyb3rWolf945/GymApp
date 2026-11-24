export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type CutPace = 'slow' | 'moderate' | 'aggressive';
export type Goal =
  | { type: 'cut'; pace: CutPace }
  | { type: 'bulk' }
  | { type: 'recomp' };

/** Profile flags that make an aggressive cut unsafe. */
export type RiskFlag = 'under_18' | 'pregnant' | 'breastfeeding' | 'eating_disorder_history' | 'medical_condition';

export interface Profile {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activity: ActivityLevel;
  flags?: RiskFlag[];
}

export class CalcError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'AGGRESSIVE_CUT_REFUSED',
    message: string,
  ) {
    super(message);
    this.name = 'CalcError';
  }
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };
/** Target weekly loss in kg per pace. */
export const CUT_KG_PER_WEEK: Record<CutPace, number> = { slow: 0.25, moderate: 0.5, aggressive: 0.75 };
const KCAL_PER_KG_FAT = 7700;
/** Max deficit: 25% of TDEE and never above 1000 kcal. */
export const MAX_DEFICIT_PCT = 0.25;
export const MAX_DEFICIT_KCAL = 1000;
export const BULK_SURPLUS_PCT = 0.1;
export const PROTEIN_MIN_G_PER_KG = 1.6;
export const PROTEIN_MAX_G_PER_KG = 2.2;
export const FAT_MIN_G_PER_KG = 0.6;
export const FAT_MIN_PCT = 0.2;
const KCAL_PROTEIN = 4;
const KCAL_CARB = 4;
const KCAL_FAT = 9;

function assertProfile(p: Profile): void {
  const ok = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
  if (!ok(p.age, 14, 100)) throw new CalcError('INVALID_INPUT', 'Age must be between 14 and 100.');
  if (!ok(p.weightKg, 30, 400)) throw new CalcError('INVALID_INPUT', 'Weight must be between 30 and 400 kg.');
  if (!ok(p.heightCm, 100, 250)) throw new CalcError('INVALID_INPUT', 'Height must be between 100 and 250 cm.');
}

/** Mifflin-St Jeor, kcal/day. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'weightKg' | 'heightCm'>): number {
  assertProfile({ ...p, activity: 'sedentary' });
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_MULTIPLIERS[p.activity];
}

export interface CalorieTarget {
  bmr: number;
  tdee: number;
  /** Daily kcal after goal adjustment and safety floor. */
  kcal: number;
  /** Signed kcal vs TDEE actually applied (negative = deficit). */
  adjustment: number;
  /** True if the deficit cap or kcal floor changed the requested target. */
  capped: boolean;
}

export function calorieTarget(p: Profile, goal: Goal): CalorieTarget {
  const base = tdee(p);
  let adjustment = 0;
  let capped = false;

  if (goal.type === 'cut') {
    if (goal.pace === 'aggressive' && (p.flags?.length ?? 0) > 0) {
      throw new CalcError('AGGRESSIVE_CUT_REFUSED', 'An aggressive cut is not available for this profile.');
    }
    const wanted = (CUT_KG_PER_WEEK[goal.pace] * KCAL_PER_KG_FAT) / 7;
    const cap = Math.min(base * MAX_DEFICIT_PCT, MAX_DEFICIT_KCAL);
    capped = wanted > cap;
    adjustment = -Math.min(wanted, cap);
  } else if (goal.type === 'bulk') {
    adjustment = base * BULK_SURPLUS_PCT;
  }

  let kcal = base + adjustment;
  const floor = MIN_KCAL[p.sex];
  if (kcal < floor) {
    kcal = floor;
    adjustment = floor - base;
    capped = true;
  }
  return { bmr: bmr(p), tdee: base, kcal: Math.round(kcal), adjustment: Math.round(adjustment), capped };
}

export interface Macros {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

const DEFAULT_PROTEIN_G_PER_KG: Record<Goal['type'], number> = { cut: 2.2, recomp: 2.0, bulk: 1.8 };

export function macros(kcal: number, weightKg: number, goal: Goal['type'], proteinGPerKg?: number): Macros {
  if (!(kcal > 0) || !(weightKg > 0)) throw new CalcError('INVALID_INPUT', 'kcal and weight must be positive.');
  const clamp = (v: number) => Math.min(PROTEIN_MAX_G_PER_KG, Math.max(PROTEIN_MIN_G_PER_KG, v));
  let protein = clamp(proteinGPerKg ?? DEFAULT_PROTEIN_G_PER_KG[goal]) * weightKg;
  const fat = Math.max(FAT_MIN_G_PER_KG * weightKg, (FAT_MIN_PCT * kcal) / KCAL_FAT);
  let carbsKcal = kcal - protein * KCAL_PROTEIN - fat * KCAL_FAT;
  if (carbsKcal < 0) {
    // Very low kcal: trim protein down to its minimum before giving up carbs.
    const minProtein = PROTEIN_MIN_G_PER_KG * weightKg;
    protein = Math.max(minProtein, (kcal - fat * KCAL_FAT) / KCAL_PROTEIN);
    carbsKcal = Math.max(0, kcal - protein * KCAL_PROTEIN - fat * KCAL_FAT);
  }
  return {
    kcal: Math.round(kcal),
    proteinG: Math.round(protein),
    fatG: Math.round(fat),
    carbsG: Math.round(carbsKcal / KCAL_CARB),
  };
}

export interface DayTargets {
  training: Macros;
  rest: Macros;
}

/**
 * Split the daily target into training vs rest days. Weekly calories stay equal
 * to 7 × target; training days get `boostPct` more, rest days absorb the difference.
 * Protein and fat stay put; carbs move.
 */
export function trainingRestSplit(
  dailyKcal: number,
  weightKg: number,
  goal: Goal['type'],
  trainingDaysPerWeek: number,
  sex: Sex,
  boostPct = 0.1,
): DayTargets {
  if (!Number.isInteger(trainingDaysPerWeek) || trainingDaysPerWeek < 0 || trainingDaysPerWeek > 7) {
    throw new CalcError('INVALID_INPUT', 'Training days must be an integer from 0 to 7.');
  }
  if (trainingDaysPerWeek === 0 || trainingDaysPerWeek === 7) {
    const m = macros(dailyKcal, weightKg, goal);
    return { training: m, rest: m };
  }
  const floor = MIN_KCAL[sex];
  const rest = trainingDaysPerWeek;
  const restDays = 7 - rest;
  let trainKcal = dailyKcal * (1 + boostPct);
  let restKcal = (7 * dailyKcal - rest * trainKcal) / restDays;
  if (restKcal < floor) {
    restKcal = Math.min(floor, dailyKcal);
    trainKcal = (7 * dailyKcal - restDays * restKcal) / rest;
  }
  const base = macros(dailyKcal, weightKg, goal);
  const withKcal = (k: number): Macros => {
    const kcal = Math.round(k);
    const carbs = Math.max(0, (kcal - base.proteinG * KCAL_PROTEIN - base.fatG * KCAL_FAT) / KCAL_CARB);
    return { kcal, proteinG: base.proteinG, fatG: base.fatG, carbsG: Math.round(carbs) };
  };
  return { training: withKcal(trainKcal), rest: withKcal(restKcal) };
}
