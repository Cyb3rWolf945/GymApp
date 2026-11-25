import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ACTIVITY_LEVELS, ALLERGENS, BUDGETS, COOKING_MINUTES, CONTRAINDICATIONS, CUT_PACES, DIETS, DISLIKE_OPTIONS, EQUIPMENT,
  COACH_STYLES, EXERCISE_LEVELS, FREE_TEXT_MAX, GOALS, LOCATIONS, MEALS_PER_DAY, Limits, SESSION_MINUTES, SEXES, UNIT_SYSTEMS, WEEKDAYS,
  type CoachStyle, type PartialAnswers, type StepId, cmToFtIn, cmToIn, inToCm, kgToLb, lbToKg,
} from '@gymapp/shared';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Button, Card, ChipGroup, Chip, Slider, Text, TextField } from '../ui';
import { Field } from './FieldErrors';

const c = en.onboarding.steps;
type Opt<T extends string | number> = { value: T; label: string };
const opts = <T extends string>(values: readonly T[], labels: Record<T, string>): Opt<T>[] => values.map((v) => ({ value: v, label: labels[v] }));
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface StepProps {
  answers: PartialAnswers;
  update: (patch: PartialAnswers) => void;
  /** Called by the welcome and consents screens, which have their own button. */
  onContinue: () => void;
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {title ? <Text variant="bodyStrong">{title}</Text> : null}
      {children}
    </View>
  );
}

/** Sliders need a value from the start: set defaults once so "Continue" works without touching them. */
function useDefaults(patch: PartialAnswers, missing: boolean, update: StepProps['update']) {
  useEffect(() => {
    if (missing) update(patch);
  }, [missing]);
}

function Welcome({ onContinue }: StepProps) {
  return <Button label={c.welcome.cta} onPress={onContinue} />;
}

function Goal({ answers, update }: StepProps) {
  return (
    <Field name="goalType">
      <ChipGroup options={opts(GOALS, c.goal.options)} value={answers.goalType ? [answers.goalType] : []} onChange={(v) => update({ goalType: v[0] })} />
    </Field>
  );
}

function Basics({ answers, update }: StepProps) {
  const units = answers.units ?? 'metric';
  useDefaults({ units: 'metric', age: 30, heightCm: 170, weightKg: 70 }, answers.age === undefined, update);
  const imperial = units === 'imperial';
  const heightCm = answers.heightCm ?? 170;
  const weightKg = answers.weightKg ?? 70;
  const fmtHeight = (inches: number) => {
    const { feet, inches: i } = cmToFtIn(inToCm(inches));
    return `${feet}′ ${Math.round(i)}″`;
  };
  return (
    <>
      <Section>
        <Field name="units">
          <ChipGroup options={opts(UNIT_SYSTEMS, c.basics.units)} value={[units]} onChange={(v) => v[0] && update({ units: v[0] })} />
        </Field>
        <Field name="sex">
          <ChipGroup options={opts(SEXES, c.basics.sex)} value={answers.sex ? [answers.sex] : []} onChange={(v) => update({ sex: v[0] })} />
        </Field>
      </Section>
      <Field name="age">
        <Slider label={c.basics.age} value={answers.age ?? 30} min={Limits.age.min} max={Limits.age.max} onChange={(age) => update({ age })} />
      </Field>
      <Field name="heightCm">
        {imperial ? (
          <Slider label={c.basics.height} value={Math.round(cmToIn(heightCm))} min={40} max={98} format={fmtHeight} onChange={(i) => update({ heightCm: Math.round(inToCm(i)) })} />
        ) : (
          <Slider label={c.basics.height} value={heightCm} min={Limits.heightCm.min} max={Limits.heightCm.max} format={(v) => `${v} cm`} onChange={(heightCm) => update({ heightCm })} />
        )}
      </Field>
      <Field name="weightKg">
        {imperial ? (
          <Slider label={c.basics.weight} value={Math.round(kgToLb(weightKg))} min={66} max={550} format={(v) => `${v} lb`} onChange={(lb) => update({ weightKg: round1(lbToKg(lb)) })} />
        ) : (
          <Slider label={c.basics.weight} value={weightKg} min={30} max={250} step={0.5} format={(v) => `${v} kg`} onChange={(weightKg) => update({ weightKg })} />
        )}
      </Field>
    </>
  );
}

function Target({ answers, update }: StepProps) {
  const imperial = answers.units === 'imperial';
  const current = answers.weightKg ?? 70;
  const target = answers.targetWeightKg ?? current;
  return (
    <>
      <Field name="targetWeightKg">
        {imperial ? (
          <Slider label={c.target.targetLabel} value={Math.round(kgToLb(target))} min={66} max={550} format={(v) => `${v} lb`} onChange={(lb) => update({ targetWeightKg: round1(lbToKg(lb)) })} />
        ) : (
          <Slider label={c.target.targetLabel} value={target} min={30} max={250} step={0.5} format={(v) => `${v} kg`} onChange={(targetWeightKg) => update({ targetWeightKg })} />
        )}
      </Field>
      {answers.goalType === 'cut' ? (
        <Section title={c.target.paceLabel}>
          <ChipGroup options={opts(CUT_PACES, c.target.pace)} value={answers.cutPace ? [answers.cutPace] : []} onChange={(v) => update({ cutPace: v[0] })} />
        </Section>
      ) : null}
    </>
  );
}

function Experience({ answers, update }: StepProps) {
  const lifts = answers.referenceLifts ?? {};
  const set = (k: 'squatKg' | 'benchKg' | 'deadliftKg', v: number) => update({ referenceLifts: { ...lifts, [k]: v === 0 ? undefined : v } });
  const fmt = (v: number) => (v === 0 ? c.experience.notSet : `${v} kg`);
  return (
    <>
      <Field name="experience">
        <ChipGroup options={opts(EXERCISE_LEVELS, c.experience.options)} value={answers.experience ? [answers.experience] : []} onChange={(v) => update({ experience: v[0] })} />
      </Field>
      <Section title={c.experience.liftsTitle}>
        <Field name="referenceLifts.squatKg">
          <Slider label={c.experience.squat} value={lifts.squatKg ?? 0} min={0} max={300} step={2.5} format={fmt} onChange={(v) => set('squatKg', v)} />
        </Field>
        <Field name="referenceLifts.benchKg">
          <Slider label={c.experience.bench} value={lifts.benchKg ?? 0} min={0} max={250} step={2.5} format={fmt} onChange={(v) => set('benchKg', v)} />
        </Field>
        <Field name="referenceLifts.deadliftKg">
          <Slider label={c.experience.deadlift} value={lifts.deadliftKg ?? 0} min={0} max={350} step={2.5} format={fmt} onChange={(v) => set('deadliftKg', v)} />
        </Field>
      </Section>
    </>
  );
}

function Availability({ answers, update }: StepProps) {
  useDefaults({ daysPerWeek: 3, sessionMinutes: 45 }, answers.daysPerWeek === undefined, update);
  return (
    <>
      <Field name="daysPerWeek">
        <Slider label={c.availability.days} value={answers.daysPerWeek ?? 3} min={Limits.days.min} max={Limits.days.max} onChange={(daysPerWeek) => update({ daysPerWeek })} />
      </Field>
      <Field name="sessionMinutes">
        <Section title={c.availability.minutes}>
          <ChipGroup
            options={SESSION_MINUTES.map((m) => ({ value: String(m), label: `${m} min` }))}
            value={answers.sessionMinutes ? [String(answers.sessionMinutes)] : []}
            onChange={(v) => v[0] && update({ sessionMinutes: Number(v[0]) as 30 | 45 | 60 | 90 })}
          />
        </Section>
      </Field>
      <Section title={c.availability.preferred}>
        <ChipGroup multiple options={opts(WEEKDAYS, c.availability.weekdays)} value={answers.preferredDays ?? []} onChange={(preferredDays) => update({ preferredDays })} />
      </Section>
    </>
  );
}

function Equipment({ answers, update }: StepProps) {
  return (
    <>
      <Field name="location">
        <ChipGroup options={opts(LOCATIONS, c.equipment.location)} value={answers.location ? [answers.location] : []} onChange={(v) => update({ location: v[0] })} />
      </Field>
      <Field name="equipment">
        <Section title={c.equipment.equipmentTitle}>
          <ChipGroup multiple options={opts(EQUIPMENT, c.equipment.equipment)} value={answers.equipment ?? []} onChange={(equipment) => update({ equipment })} />
        </Section>
      </Field>
    </>
  );
}

function Injuries({ answers, update }: StepProps) {
  const note = answers.injuryNote ?? '';
  return (
    <>
      <ChipGroup multiple options={opts(CONTRAINDICATIONS, c.injuries.zones)} value={answers.contraindications ?? []} onChange={(contraindications) => update({ contraindications })} />
      <Field name="injuryNote">
        <TextField
          multiline
          maxLength={FREE_TEXT_MAX}
          value={note}
          placeholder={c.injuries.notePlaceholder}
          accessibilityLabel={c.injuries.notePlaceholder}
          onChangeText={(injuryNote) => update({ injuryNote })}
        />
        <Text variant="caption" tone="muted">{c.injuries.noteLimit(note.length)}</Text>
      </Field>
    </>
  );
}

function Activity({ answers, update }: StepProps) {
  return (
    <Field name="activity">
      <ChipGroup options={opts(ACTIVITY_LEVELS, c.activity.options)} value={answers.activity ? [answers.activity] : []} onChange={(v) => update({ activity: v[0] })} />
    </Field>
  );
}

function Diet({ answers, update }: StepProps) {
  return (
    <>
      <Field name="diet">
        <ChipGroup options={opts(DIETS, c.diet.diet)} value={answers.diet ? [answers.diet] : []} onChange={(v) => update({ diet: v[0] })} />
      </Field>
      <Field name="mealsPerDay">
        <Section title={c.diet.meals}>
          <ChipGroup
            options={MEALS_PER_DAY.map((m) => ({ value: String(m), label: String(m) }))}
            value={answers.mealsPerDay ? [String(answers.mealsPerDay)] : []}
            onChange={(v) => v[0] && update({ mealsPerDay: Number(v[0]) as 3 | 4 | 5 | 6 })}
          />
        </Section>
      </Field>
    </>
  );
}

function Allergies({ answers, update }: StepProps) {
  useDefaults({ allergens: [], dislikes: [] }, answers.allergens === undefined, update);
  return (
    <>
      <Section title={c.allergies.allergensTitle}>
        <ChipGroup multiple options={opts(ALLERGENS, c.allergies.allergens)} value={answers.allergens ?? []} onChange={(allergens) => update({ allergens })} />
      </Section>
      <Section title={c.allergies.dislikesTitle}>
        <ChipGroup multiple options={DISLIKE_OPTIONS.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))} value={answers.dislikes ?? []} onChange={(dislikes) => update({ dislikes })} />
      </Section>
    </>
  );
}

function Budget({ answers, update }: StepProps) {
  return (
    <>
      <Section title={c.budget.budgetTitle}>
        <ChipGroup options={opts(BUDGETS, c.budget.budget)} value={answers.budget ? [answers.budget] : []} onChange={(v) => update({ budget: v[0] })} />
      </Section>
      <Section title={c.budget.cookingTitle}>
        <ChipGroup
          options={COOKING_MINUTES.map((m) => ({ value: String(m), label: c.budget.cookingMinutes(m) }))}
          value={answers.cookingMinutes ? [String(answers.cookingMinutes)] : []}
          onChange={(v) => update({ cookingMinutes: v[0] ? (Number(v[0]) as 15 | 30 | 45 | 60) : undefined })}
        />
      </Section>
    </>
  );
}

/** Three styles, each with a one-line example. */
function CoachStyleStep({ answers, update }: StepProps) {
  return (
    <Section>
      <ChipGroup
        options={COACH_STYLES.map((v) => ({ value: v, label: en.coach.styles[v].label }))}
        value={answers.coachStyle ? [answers.coachStyle] : []}
        onChange={(v) => update({ coachStyle: (v[0] as CoachStyle | undefined) ?? undefined })}
      />
      {COACH_STYLES.map((v) => (
        <Text key={v} tone="muted">{`${en.coach.styles[v].label}: ${en.coach.styles[v].example}`}</Text>
      ))}
    </Section>
  );
}

const CONSENT_KEYS = ['terms', 'privacy', 'healthData', 'disclaimer'] as const;

function Consents({ answers, update }: StepProps) {
  const cur = answers.consents;
  const base = { terms: false, privacy: false, healthData: false, disclaimer: false, notifications: false, ...cur };
  const toggle = (k: keyof typeof base) => update({ consents: { ...base, [k]: !base[k] } as never });
  const router = useRouter();
  const links = [
    ['terms', c.consents.readTerms],
    ['privacy', c.consents.readPrivacy],
    ['health', c.consents.readHealth],
  ] as const;
  return (
    <Card style={{ gap: 12 }}>
      {CONSENT_KEYS.map((k) => (
        <Field key={k} name={`consents.${k}`}>
          <Chip label={c.consents[k]} selected={base[k]} onPress={() => toggle(k)} />
        </Field>
      ))}
      <Chip label={c.consents.notifications} selected={base.notifications} onPress={() => toggle('notifications')} />
      {links.map(([doc, label]) => (
        <Button key={doc} label={label} variant="ghost" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc } })} />
      ))}
    </Card>
  );
}

export const STEP_BODIES: Record<StepId, (p: StepProps) => ReactNode> = {
  welcome: Welcome,
  goal: Goal,
  basics: Basics,
  target: Target,
  experience: Experience,
  availability: Availability,
  equipment: Equipment,
  injuries: Injuries,
  activity: Activity,
  diet: Diet,
  allergies: Allergies,
  budget: Budget,
  coachStyle: CoachStyleStep,
  consents: Consents,
};
