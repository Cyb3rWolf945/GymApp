import { describe, expect, it } from 'vitest';
import { WEEKDAYS, buildToday, dateKey, mealProgress, toggleEaten, trainingWeekdays, weekdayOf, type RecipeCandidate, type TodayMeals } from '../index';

const at = (iso: string) => new Date(`${iso}T12:00:00`); // local noon
// 2026-11-23 is a Monday.
const MON = at('2026-11-23'), TUE = at('2026-11-24'), WED = at('2026-11-25'), SUN = at('2026-11-29');

describe('weekdays', () => {
  it('maps dates to Monday-first weekdays', () => {
    expect(weekdayOf(MON)).toBe('mon');
    expect(weekdayOf(SUN)).toBe('sun');
    expect(WEEKDAYS[0]).toBe('mon');
  });
  it('spreads training days by default', () => {
    expect(trainingWeekdays(3)).toEqual(['mon', 'wed', 'fri']);
    expect(trainingWeekdays(2)).toEqual(['mon', 'thu']);
    expect(trainingWeekdays(6)).toHaveLength(6);
  });
  it('uses preferred days, fills gaps and trims extras', () => {
    expect(trainingWeekdays(3, ['tue', 'thu', 'sat'])).toEqual(['tue', 'thu', 'sat']);
    expect(trainingWeekdays(3, ['sat'])).toEqual(['mon', 'wed', 'sat']);
    expect(trainingWeekdays(2, ['sat', 'tue', 'sun'])).toEqual(['tue', 'sat']);
    expect(new Set(trainingWeekdays(4, ['mon', 'mon'])).size).toBe(4);
    expect(trainingWeekdays(0)).toEqual([]);
  });
});

const line = (slug: string) => ({ exerciseSlug: slug, sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90 });
const workoutResult = { plan: { split: 'full_body', rationale: 'x', days: [
  { name: 'Day A', exercises: [line('squat'), line('row')] }, { name: 'Day B', exercises: [line('press')] }, { name: 'Day C', exercises: [line('squat')] },
] } };
const meal = (recipeSlug: string, portions: number, name = 'M') => ({ name, recipeSlug, portions });
const day = (dayType: 'training' | 'rest', slugs: string[]) => ({ dayType, kcal: 2000, proteinG: 1, carbsG: 1, fatG: 1, meals: slugs.map((s, i) => meal(s, 1, `Meal ${i + 1}`)) });
const nutritionResult = { plan: { rationale: 'x', days: [day('training', ['big', 'big']), day('rest', ['small', 'small'])] } };
const recipes: RecipeCandidate[] = [
  { slug: 'big', name: 'Big bowl', diet: 'omnivore', kcal: 900, protein_g: 60, carbs_g: 90, fat_g: 25, allergens: [] },
  { slug: 'small', name: 'Small bowl', diet: 'omnivore', kcal: 400, protein_g: 30, carbs_g: 40, fat_g: 10, allergens: [] },
];
const build = (date: Date, over: object = {}) => buildToday({ workoutResult, nutritionResult, date, exerciseNames: new Map([['squat', 'Back squat']]), recipes, ...over });

describe('buildToday', () => {
  it('shows the right plan day on a training day, with names and estimated minutes', () => {
    const v = build(WED); // default schedule for 3 days: mon, wed, fri → Wednesday is plan day 2
    expect(v.workout).toMatchObject({ kind: 'workout', dayName: 'Day B', exercises: [{ slug: 'press', name: 'press', sets: 3, reps: '8–12' }] });
    expect((v.workout as { minutes: number }).minutes).toBeGreaterThan(5);
    expect((build(MON).workout as { exercises: { name: string }[] }).exercises[0].name).toBe('Back squat');
  });
  it('shows a rest day with the next workout', () => {
    expect(build(TUE).workout).toEqual({ kind: 'rest', next: { weekday: 'wed', dayName: 'Day B' } });
    expect(build(SUN).workout).toEqual({ kind: 'rest', next: { weekday: 'mon', dayName: 'Day A' } }); // wraps to next week
  });
  it('honours preferred days', () => {
    const v = build(TUE, { preferredDays: ['tue', 'thu', 'sat'] });
    expect(v.workout).toMatchObject({ kind: 'workout', dayName: 'Day A' });
  });
  it('picks the meal day by training or rest', () => {
    expect(build(MON).meals?.dayType).toBe('training');
    expect(build(TUE).meals?.dayType).toBe('rest');
    expect(build(MON).meals?.totals.kcal).toBe(1800);
    expect(build(TUE).meals?.meals[0]).toMatchObject({ recipe: 'Small bowl', kcal: 400, proteinG: 30 });
  });
  it('falls back to the first meal day when the plan lacks that type', () => {
    const only = { plan: { rationale: 'x', days: [day('training', ['big', 'big'])] } };
    expect(build(TUE, { nutritionResult: only }).meals?.dayType).toBe('training');
  });
  it('returns nulls for missing or malformed plans', () => {
    expect(build(MON, { workoutResult: null, nutritionResult: { plan: 5 } })).toEqual({ workout: null, meals: null });
  });
});

describe('meal progress', () => {
  const meals = build(MON).meals as TodayMeals;
  it('toggles eaten meals, sorted', () => {
    expect(toggleEaten([], 1)).toEqual([1]);
    expect(toggleEaten([1], 0)).toEqual([0, 1]);
    expect(toggleEaten([0, 1], 0)).toEqual([1]);
  });
  it('sums what was eaten and compares it with the target', () => {
    const p = mealProgress(meals, [0], 2000);
    expect(p).toMatchObject({ eatenCount: 1, total: 2, eaten: { kcal: 900, proteinG: 60, carbsG: 90, fatG: 25 }, fraction: 0.45 });
  });
  it('uses the planned kcal without a target, and caps at 100%', () => {
    expect(mealProgress(meals, [0, 1]).fraction).toBe(1);
    expect(mealProgress(meals, [0, 1], 1000).fraction).toBe(1);
    expect(mealProgress(meals, []).fraction).toBe(0);
  });
  it('keys days by local date', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
