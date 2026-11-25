import { type OnboardingAnswers, OnboardingAnswersSchema, type PartialAnswers } from './schema.ts';

/** What gets written to `profiles` when the account is created. */
export interface ProfileUpdate {
  sex: 'male' | 'female';
  /** Approximate: the app asks for age, not a date. 1 July of (this year − age). */
  birth_date: string;
  height_cm: number;
  weight_kg: number;
  goal: OnboardingAnswers['goalType'];
  experience: OnboardingAnswers['experience'];
  units: OnboardingAnswers['units'];
  /** Only present when the person picked one: otherwise the column keeps its value (Calm by default). */
  coach_style?: NonNullable<OnboardingAnswers['coachStyle']>;
  onboarding: Record<string, unknown>;
}

/** Drop empty optionals so profiles.onboarding stays small; keeps the keys the plan generator reads. */
function compact(a: OnboardingAnswers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0 && k !== 'contraindications' && k !== 'allergens') continue;
    out[k] = v;
  }
  delete out.coachStyle; // lives in profiles.coach_style
  if (a.referenceLifts && Object.values(a.referenceLifts).every((v) => v === undefined)) delete out.referenceLifts;
  return out;
}

export function toProfileUpdate(answers: PartialAnswers, now = new Date()): ProfileUpdate {
  const a = OnboardingAnswersSchema.parse(answers);
  return {
    sex: a.sex,
    birth_date: `${now.getUTCFullYear() - a.age}-07-01`,
    height_cm: a.heightCm,
    weight_kg: a.weightKg,
    goal: a.goalType,
    experience: a.experience,
    units: a.units,
    ...(a.coachStyle ? { coach_style: a.coachStyle } : {}),
    onboarding: { ...compact(a), version: 1 },
  };
}
